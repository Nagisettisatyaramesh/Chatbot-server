import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { nanoid } from "nanoid";
import { prisma } from "../db/prisma";
import { signToken } from "../middleware/auth";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { authRateLimiter } from "../middleware/rateLimit";
import { sanitizeShortField } from "../lib/security/sanitize";

export const authRouter = Router();

authRouter.use(authRateLimiter);

const registerSchema = z.object({
  businessName: z.string().min(2).max(200),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  clientIdPrefix: z.string().regex(/^[A-Za-z0-9_]{2,20}$/).optional(),
});

function slugify(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20) || "BIZ";
}

// Self-serve signup: creates a brand new tenant (Customer) plus its first
// OWNER admin user. This is how additional customers get added without
// ever touching chatbot code -- everything downstream keys off customerId.
authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "Invalid registration data");
    const { businessName, email, password, clientIdPrefix } = parsed.data;

    const existing = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) throw new ApiError(409, "An account with this email already exists");

    const base = slugify(clientIdPrefix ?? businessName);
    let clientId = `${base}_${nanoid(6).toUpperCase()}`;
    // extremely unlikely collision, but guard anyway
    for (let i = 0; i < 3 && (await prisma.customer.findUnique({ where: { clientId } })); i++) {
      clientId = `${base}_${nanoid(6).toUpperCase()}`;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const customer = await prisma.customer.create({
      data: {
        clientId,
        businessName: sanitizeShortField(businessName),
        chatbotSettings: { create: {} },
        adminUsers: {
          create: { email: email.toLowerCase(), passwordHash, role: "OWNER" },
        },
      },
      include: { adminUsers: true },
    });

    const admin = customer.adminUsers[0];
    const token = signToken({ sub: admin.id, email: admin.email, role: "OWNER", customerId: customer.id });

    res.status(201).json({
      token,
      customer: { id: customer.id, clientId: customer.clientId, businessName: customer.businessName },
    });
  })
);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "Invalid credentials");
    const { email, password } = parsed.data;

    const admin = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase() } });
    if (!admin) throw new ApiError(401, "Invalid email or password");

    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) throw new ApiError(401, "Invalid email or password");

    if (admin.customerId) {
      const customer = await prisma.customer.findUnique({ where: { id: admin.customerId } });
      if (!customer || customer.status !== "ACTIVE") {
        throw new ApiError(403, "This account has been disabled. Contact support.");
      }
    }

    await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });

    const token = signToken({
      sub: admin.id,
      email: admin.email,
      role: admin.role as "OWNER" | "STAFF" | "SUPER_ADMIN",
      customerId: admin.customerId,
    });

    res.json({ token, role: admin.role, customerId: admin.customerId });
  })
);
