import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { requireAuth, requireCustomerScope } from "../middleware/auth";
import { asyncHandler, ApiError } from "../middleware/errorHandler";

export const knowledgeRouter = Router();
knowledgeRouter.use(requireAuth, requireCustomerScope);

const TYPES = ["ABOUT", "SERVICE", "FAQ", "POLICY", "DOCUMENT_CHUNK", "WEBSITE"] as const;

// Every query below is scoped by req.auth.customerId -- this router is the
// primary CRUD surface for tenant knowledge and must never accept a
// customerId from the client.

knowledgeRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const items = await prisma.knowledgeItem.findMany({
      where: {
        customerId: req.auth!.customerId!,
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { updatedAt: "desc" },
    });
    res.json(items);
  })
);

const createSchema = z.object({
  type: z.enum(TYPES),
  title: z.string().min(1).max(300),
  content: z.string().min(1).max(20000),
  price: z.string().max(100).optional().nullable(),
  status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]).optional(),
});

knowledgeRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "Invalid knowledge item");
    const item = await prisma.knowledgeItem.create({
      data: {
        customerId: req.auth!.customerId!,
        source: "MANUAL",
        ...parsed.data,
      },
    });
    res.status(201).json(item);
  })
);

const updateSchema = createSchema.partial();

knowledgeRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "Invalid knowledge item");

    // Ownership check before mutation: the row must belong to this tenant.
    const existing = await prisma.knowledgeItem.findFirst({
      where: { id: req.params.id, customerId: req.auth!.customerId! },
    });
    if (!existing) throw new ApiError(404, "Knowledge item not found");

    const updated = await prisma.knowledgeItem.update({
      where: { id: existing.id },
      data: parsed.data,
    });
    res.json(updated);
  })
);

knowledgeRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = await prisma.knowledgeItem.findFirst({
      where: { id: req.params.id, customerId: req.auth!.customerId! },
    });
    if (!existing) throw new ApiError(404, "Knowledge item not found");
    await prisma.knowledgeItem.delete({ where: { id: existing.id } });
    res.status(204).send();
  })
);
