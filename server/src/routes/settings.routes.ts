import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { requireAuth, requireCustomerScope } from "../middleware/auth";
import { asyncHandler, ApiError } from "../middleware/errorHandler";

export const settingsRouter = Router();
settingsRouter.use(requireAuth, requireCustomerScope);

settingsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const settings = await prisma.chatbotSettings.findUnique({ where: { customerId: req.auth!.customerId! } });
    if (!settings) throw new ApiError(404, "Settings not found");
    res.json({ ...settings, quickReplies: JSON.parse(settings.quickReplies || "[]") });
  })
);

const settingsSchema = z.object({
  botName: z.string().min(1).max(100).optional(),
  welcomeMessage: z.string().min(1).max(500).optional(),
  avatarUrl: z.string().max(2000).optional().nullable(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  buttonColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  quickReplies: z.array(z.string().max(80)).max(6).optional(),
  enabled: z.boolean().optional(),
  handoffWhatsapp: z.string().max(50).optional().nullable(),
  handoffPhone: z.string().max(50).optional().nullable(),
  handoffEmail: z.string().email().optional().nullable().or(z.literal("")),
  handoffEnquiryUrl: z.string().max(2000).optional().nullable(),
  leadCaptureEnabled: z.boolean().optional(),
});

settingsRouter.put(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "Invalid settings data");
    const { quickReplies, ...rest } = parsed.data;
    const updated = await prisma.chatbotSettings.update({
      where: { customerId: req.auth!.customerId! },
      data: {
        ...rest,
        ...(quickReplies ? { quickReplies: JSON.stringify(quickReplies) } : {}),
      },
    });
    res.json({ ...updated, quickReplies: JSON.parse(updated.quickReplies || "[]") });
  })
);
