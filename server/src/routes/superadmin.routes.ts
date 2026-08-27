import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { prisma } from "../db/prisma";
import { requireAuth, requireSuperAdmin } from "../middleware/auth";
import { asyncHandler, ApiError } from "../middleware/errorHandler";

export const superAdminRouter = Router();
superAdminRouter.use(requireAuth, requireSuperAdmin);

// Every cross-tenant read/write in this router is audited -- this is the
// only part of the system permitted to see more than one tenant's data,
// and that access is deliberately logged.
async function audit(req: { auth?: { email: string; role: string } }, action: string, customerId?: string, detail?: string) {
  await prisma.auditLog.create({
    data: { actorEmail: req.auth!.email, actorRole: req.auth!.role, action, customerId, detail },
  });
}

superAdminRouter.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const [customers, activeBots, conversations, leads] = await Promise.all([
      prisma.customer.count(),
      prisma.chatbotSettings.count({ where: { enabled: true } }),
      prisma.conversation.count(),
      prisma.lead.count(),
    ]);
    await audit(req, "VIEW_GLOBAL_STATS");
    res.json({ customers, activeBots, conversations, leads });
  })
);

superAdminRouter.get(
  "/customers",
  asyncHandler(async (req, res) => {
    const customers = await prisma.customer.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { conversations: true, leads: true } } },
    });
    res.json(customers);
  })
);

function slugify(input: string): string {
  return (
    input
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 20) || "BIZ"
  );
}

const createCustomerSchema = z.object({
  businessName: z.string().min(2).max(200),
  clientId: z
    .string()
    .regex(/^[A-Za-z0-9_]{3,40}$/)
    .optional(),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8).max(200),
  plan: z.enum(["STARTER", "BUSINESS", "PREMIUM"]).optional(),
});

superAdminRouter.post(
  "/customers",
  asyncHandler(async (req, res) => {
    const parsed = createCustomerSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "Invalid customer data");
    const { businessName, ownerEmail, ownerPassword, plan } = parsed.data;

    const existingAdmin = await prisma.adminUser.findUnique({ where: { email: ownerEmail.toLowerCase() } });
    if (existingAdmin) throw new ApiError(409, "An account with this email already exists");

    let clientId = parsed.data.clientId ?? `${slugify(businessName)}_${nanoid(6).toUpperCase()}`;
    if (await prisma.customer.findUnique({ where: { clientId } })) {
      throw new ApiError(409, "That client ID is already in use");
    }

    const planLimits: Record<string, number> = { STARTER: 1000, BUSINESS: 5000, PREMIUM: 20000 };
    const passwordHash = await bcrypt.hash(ownerPassword, 12);

    const customer = await prisma.customer.create({
      data: {
        clientId,
        businessName,
        plan: plan ?? "STARTER",
        messageLimit: planLimits[plan ?? "STARTER"] ?? 1000,
        chatbotSettings: { create: {} },
        adminUsers: { create: { email: ownerEmail.toLowerCase(), passwordHash, role: "OWNER" } },
      },
    });

    await audit(req, "CREATE_CUSTOMER", customer.id, businessName);
    res.status(201).json(customer);
  })
);

const updateCustomerSchema = z.object({
  businessName: z.string().min(1).max(200).optional(),
  plan: z.enum(["STARTER", "BUSINESS", "PREMIUM"]).optional(),
  messageLimit: z.number().int().min(0).max(1000000).optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
});

superAdminRouter.put(
  "/customers/:id",
  asyncHandler(async (req, res) => {
    const parsed = updateCustomerSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "Invalid update");
    const existing = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, "Customer not found");

    const updated = await prisma.customer.update({ where: { id: existing.id }, data: parsed.data });
    await audit(req, "UPDATE_CUSTOMER", existing.id, JSON.stringify(parsed.data));
    res.json(updated);
  })
);

superAdminRouter.get(
  "/customers/:id/conversations",
  asyncHandler(async (req, res) => {
    const conversations = await prisma.conversation.findMany({
      where: { customerId: req.params.id },
      orderBy: { lastMessageAt: "desc" },
      take: 100,
    });
    await audit(req, "VIEW_CUSTOMER_CONVERSATIONS", req.params.id);
    res.json(conversations);
  })
);

superAdminRouter.get(
  "/customers/:id/leads",
  asyncHandler(async (req, res) => {
    const leads = await prisma.lead.findMany({ where: { customerId: req.params.id }, orderBy: { createdAt: "desc" } });
    await audit(req, "VIEW_CUSTOMER_LEADS", req.params.id);
    res.json(leads);
  })
);

// ---------------------------------------------------------------------
// Subscription plans (configurable limits shown to customers)
// ---------------------------------------------------------------------

superAdminRouter.get(
  "/plans",
  asyncHandler(async (_req, res) => {
    const plans = await prisma.plan.findMany({ orderBy: { messageLimit: "asc" } });
    res.json(plans);
  })
);

const planSchema = z.object({
  name: z.string().min(1).max(50),
  messageLimit: z.number().int().min(1),
  priceMonthly: z.number().min(0),
});

superAdminRouter.post(
  "/plans",
  asyncHandler(async (req, res) => {
    const parsed = planSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "Invalid plan data");
    const plan = await prisma.plan.create({ data: parsed.data });
    await audit(req, "CREATE_PLAN", undefined, plan.name);
    res.status(201).json(plan);
  })
);

superAdminRouter.put(
  "/plans/:id",
  asyncHandler(async (req, res) => {
    const parsed = planSchema.partial().safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "Invalid plan data");
    const plan = await prisma.plan.update({ where: { id: req.params.id }, data: parsed.data });
    await audit(req, "UPDATE_PLAN", undefined, plan.name);
    res.json(plan);
  })
);

superAdminRouter.get(
  "/audit-log",
  asyncHandler(async (_req, res) => {
    const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    res.json(logs);
  })
);
