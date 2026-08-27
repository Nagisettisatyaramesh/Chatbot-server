import { Router } from "express";
import { prisma } from "../db/prisma";
import { asyncHandler, ApiError } from "../middleware/errorHandler";

export const widgetConfigRouter = Router();

// Public, unauthenticated -- but returns ONLY presentation/handoff config
// for the single customer matching clientId. No knowledge, no other
// customers' data, no secrets.
widgetConfigRouter.get(
  "/:clientId",
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.findUnique({ where: { clientId: req.params.clientId } });
    if (!customer || customer.status !== "ACTIVE") throw new ApiError(404, "Chatbot not found");

    const settings = await prisma.chatbotSettings.findUnique({ where: { customerId: customer.id } });
    if (!settings || !settings.enabled) throw new ApiError(404, "Chatbot not available");

    res.json({
      businessName: customer.businessName,
      botName: settings.botName,
      welcomeMessage: settings.welcomeMessage,
      avatarUrl: settings.avatarUrl,
      primaryColor: settings.primaryColor,
      buttonColor: settings.buttonColor,
      quickReplies: JSON.parse(settings.quickReplies || "[]"),
      leadCaptureEnabled: settings.leadCaptureEnabled,
      handoff: {
        whatsapp: settings.handoffWhatsapp,
        phone: settings.handoffPhone,
        email: settings.handoffEmail,
        enquiryUrl: settings.handoffEnquiryUrl,
      },
    });
  })
);
