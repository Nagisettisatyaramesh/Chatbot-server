import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { requireAuth, requireCustomerScope } from "../middleware/auth";
import { asyncHandler, ApiError } from "../middleware/errorHandler";

export const leadsRouter = Router();
leadsRouter.use(requireAuth, requireCustomerScope);

leadsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const leads = await prisma.lead.findMany({
      where: { customerId: req.auth!.customerId!, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
    });
    res.json(leads);
  })
);

const updateSchema = z.object({
  status: z.enum(["NEW", "CONTACTED", "CONVERTED", "CLOSED"]),
});

leadsRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "Invalid status");
    const existing = await prisma.lead.findFirst({ where: { id: req.params.id, customerId: req.auth!.customerId! } });
    if (!existing) throw new ApiError(404, "Lead not found");
    const updated = await prisma.lead.update({ where: { id: existing.id }, data: { status: parsed.data.status } });
    res.json(updated);
  })
);
