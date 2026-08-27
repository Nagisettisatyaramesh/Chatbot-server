import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { requireAuth, requireCustomerScope } from "../middleware/auth";
import { asyncHandler, ApiError } from "../middleware/errorHandler";

export const customerRouter = Router();
customerRouter.use(requireAuth, requireCustomerScope);

customerRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.findUnique({ where: { id: req.auth!.customerId! } });
    if (!customer) throw new ApiError(404, "Customer not found");
    res.json(customer);
  })
);

const profileSchema = z.object({
  businessName: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).optional().nullable(),
  websiteUrl: z.string().url().optional().nullable().or(z.literal("")),
  category: z.string().max(100).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  whatsapp: z.string().max(50).optional().nullable(),
  businessHours: z.string().max(500).optional().nullable(),
  logoUrl: z.string().max(2000).optional().nullable(),
});

// PUT is intentionally scoped to req.auth.customerId only -- a customer
// admin can never target another tenant's row because the id is never
// taken from the request body.
customerRouter.put(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "Invalid profile data");
    const updated = await prisma.customer.update({
      where: { id: req.auth!.customerId! },
      data: parsed.data,
    });
    res.json(updated);
  })
);
