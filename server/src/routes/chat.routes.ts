import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { chatRateLimiter } from "../middleware/rateLimit";
import { sanitizePlainText, sanitizeShortField } from "../lib/security/sanitize";
import { looksLikeInjectionAttempt } from "../lib/security/promptInjection";
import { retrieveKnowledge, hasSufficientConfidence } from "../lib/retrieval/search";
import { buildSystemPrompt } from "../lib/ai/systemPrompt";
import { runChatTurn } from "../lib/ai/claude";
import { checkAndTrackUsage, recordUnansweredQuestion } from "../lib/usage";
import { isAiConfigured } from "../config/env";

export const chatRouter = Router();
chatRouter.use(chatRateLimiter);

const LIMIT_MESSAGE =
  "This chatbot has reached its monthly conversation limit. Please contact the business directly.";

interface HandoffConfig {
  whatsapp: string | null;
  phone: string | null;
  email: string | null;
  enquiryUrl: string | null;
}

// ---------------------------------------------------------------------
// This function is the single tenant-resolution choke point for chat.
// clientId -> Customer lookup happens exactly once, here, and every
// downstream call (retrieval, AI prompt, usage, persistence) is scoped to
// the resulting customer.id. No other code path may accept a raw
// customerId from the public widget.
// ---------------------------------------------------------------------
async function resolveActiveCustomer(clientId: string) {
  const customer = await prisma.customer.findUnique({ where: { clientId } });
  if (!customer || customer.status !== "ACTIVE") return null;
  return customer;
}

const chatSchema = z.object({
  clientId: z.string().min(1).max(100),
  visitorId: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  conversationId: z.string().max(100).optional(),
});

chatRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "Invalid request");
    const { clientId, visitorId, conversationId } = parsed.data;
    const message = sanitizePlainText(parsed.data.message);
    if (!message) throw new ApiError(400, "Empty message");

    const customer = await resolveActiveCustomer(clientId);
    if (!customer) throw new ApiError(404, "Chatbot not found or inactive");

    const settings = await prisma.chatbotSettings.findUnique({ where: { customerId: customer.id } });
    if (!settings || !settings.enabled) throw new ApiError(404, "Chatbot not available");

    const handoff: HandoffConfig = {
      whatsapp: settings.handoffWhatsapp,
      phone: settings.handoffPhone,
      email: settings.handoffEmail,
      enquiryUrl: settings.handoffEnquiryUrl,
    };

    // Resolve or create the conversation, always scoped to this customer.
    let conversation = conversationId
      ? await prisma.conversation.findFirst({ where: { id: conversationId, customerId: customer.id } })
      : null;
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { customerId: customer.id, visitorId: sanitizeShortField(visitorId) },
      });
    }

    await prisma.message.create({
      data: { conversationId: conversation.id, customerId: customer.id, role: "USER", content: message },
    });

    // Usage gate -- checked before any AI call so a maxed-out tenant never
    // triggers a paid API call.
    const usage = await checkAndTrackUsage(customer);
    if (!usage.allowed) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          customerId: customer.id,
          role: "ASSISTANT",
          content: LIMIT_MESSAGE,
          wasFallback: true,
        },
      });
      return res.json({
        conversationId: conversation.id,
        message: LIMIT_MESSAGE,
        quickReplies: [],
        humanHandoff: true,
        handoff,
      });
    }

    if (looksLikeInjectionAttempt(message)) {
      console.warn(`[security] possible prompt injection attempt from visitor on customer ${customer.id}`);
    }

    // Tenant-scoped retrieval -- WHERE customerId = customer.id, enforced
    // inside retrieveKnowledge itself.
    const knowledge = await retrieveKnowledge(customer.id, message);
    const retrievalConfident = hasSufficientConfidence(knowledge);

    let answer: string;
    let sufficient: boolean;
    let quickReplies: string[] = [];

    if (!retrievalConfident) {
      sufficient = false;
      answer = "I'm sorry, I don't have enough information to answer that. Would you like to speak with our team?";
    } else if (!isAiConfigured()) {
      // No ANTHROPIC_API_KEY set -- rather than hiding a confident knowledge
      // match behind the generic AI-unavailable fallback, surface the
      // matched article verbatim. This lets a business test that its
      // knowledge base and retrieval are wired up correctly before ever
      // adding an AI key. It is never a guess: it's exactly the content the
      // business itself entered.
      sufficient = true;
      answer = knowledge[0].content;
    } else {
      const systemPrompt = buildSystemPrompt(
        {
          businessName: customer.businessName,
          category: customer.category,
          description: customer.description,
          botName: settings.botName,
        },
        knowledge
      );
      const result = await runChatTurn(systemPrompt, message);
      answer = result.answer;
      sufficient = result.sufficient;
      quickReplies = result.quickReplies;
    }

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        customerId: customer.id,
        role: "ASSISTANT",
        content: answer,
        wasFallback: !sufficient,
        confidence: knowledge[0]?.score ?? 0,
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), status: sufficient ? conversation.status : "HANDED_OFF" },
    });

    if (!sufficient) {
      await recordUnansweredQuestion(customer.id, message);
    }

    res.json({
      conversationId: conversation.id,
      message: answer,
      quickReplies,
      humanHandoff: !sufficient,
      handoff: !sufficient ? handoff : null,
    });
  })
);

// ---------------------------------------------------------------------
// Lead capture mini state machine -- deterministic, not AI-driven, so a
// visitor's free text can never be misinterpreted into skipping a step or
// injecting into the lead record.
// ---------------------------------------------------------------------

const LEAD_STEPS = ["NAME", "MOBILE", "EMAIL", "REQUIREMENT"] as const;
type LeadStep = (typeof LEAD_STEPS)[number];

const STEP_PROMPTS: Record<LeadStep, string> = {
  NAME: "I'd be happy to help you with an enquiry. May I know your name?",
  MOBILE: "Thanks! What's the best mobile number to reach you on?",
  EMAIL: "Got it. What's your email address? (You can type 'skip' to skip this)",
  REQUIREMENT: "Great, one last thing -- could you briefly describe what you need help with?",
};

const startSchema = z.object({
  clientId: z.string().min(1).max(100),
  visitorId: z.string().min(1).max(200),
  conversationId: z.string().max(100).optional(),
});

chatRouter.post(
  "/lead/start",
  asyncHandler(async (req, res) => {
    const parsed = startSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "Invalid request");
    const { clientId, visitorId, conversationId } = parsed.data;

    const customer = await resolveActiveCustomer(clientId);
    if (!customer) throw new ApiError(404, "Chatbot not found or inactive");

    let conversation = conversationId
      ? await prisma.conversation.findFirst({ where: { id: conversationId, customerId: customer.id } })
      : null;
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { customerId: customer.id, visitorId: sanitizeShortField(visitorId) },
      });
    }

    conversation = await prisma.conversation.update({
      where: { id: conversation.id },
      data: { leadStage: "NAME" },
    });

    await prisma.message.create({
      data: { conversationId: conversation.id, customerId: customer.id, role: "ASSISTANT", content: STEP_PROMPTS.NAME },
    });

    res.json({ conversationId: conversation.id, message: STEP_PROMPTS.NAME });
  })
);

const replySchema = z.object({
  clientId: z.string().min(1).max(100),
  conversationId: z.string().min(1).max(100),
  answer: z.string().min(1).max(500),
});

chatRouter.post(
  "/lead/reply",
  asyncHandler(async (req, res) => {
    const parsed = replySchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "Invalid request");
    const { clientId, conversationId, answer } = parsed.data;
    const clean = sanitizeShortField(answer);

    const customer = await resolveActiveCustomer(clientId);
    if (!customer) throw new ApiError(404, "Chatbot not found or inactive");

    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, customerId: customer.id },
    });
    if (!conversation || !conversation.leadStage) throw new ApiError(400, "No active enquiry in progress");

    await prisma.message.create({
      data: { conversationId: conversation.id, customerId: customer.id, role: "USER", content: clean },
    });

    const stepIndex = LEAD_STEPS.indexOf(conversation.leadStage as LeadStep);
    const fieldByStep: Record<LeadStep, keyof { name: string; mobile: string; email: string; requirement: string }> = {
      NAME: "name",
      MOBILE: "mobile",
      EMAIL: "email",
      REQUIREMENT: "requirement",
    };

    // Fetch/prepare an in-progress lead row keyed by conversationId.
    let lead = await prisma.lead.findFirst({ where: { conversationId: conversation.id } });
    if (!lead) {
      lead = await prisma.lead.create({ data: { customerId: customer.id, conversationId: conversation.id } });
    }

    const value = clean.toLowerCase() === "skip" ? null : clean;
    await prisma.lead.update({
      where: { id: lead.id },
      data: { [fieldByStep[conversation.leadStage as LeadStep]]: value },
    });

    const nextStepIndex = stepIndex + 1;
    if (nextStepIndex < LEAD_STEPS.length) {
      const nextStep = LEAD_STEPS[nextStepIndex];
      await prisma.conversation.update({ where: { id: conversation.id }, data: { leadStage: nextStep } });
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          customerId: customer.id,
          role: "ASSISTANT",
          content: STEP_PROMPTS[nextStep],
        },
      });
      return res.json({ conversationId: conversation.id, message: STEP_PROMPTS[nextStep], done: false });
    }

    const doneMessage = "Thank you! Our team has received your enquiry and will get back to you shortly.";
    await prisma.conversation.update({ where: { id: conversation.id }, data: { leadStage: null } });
    await prisma.message.create({
      data: { conversationId: conversation.id, customerId: customer.id, role: "ASSISTANT", content: doneMessage },
    });

    res.json({ conversationId: conversation.id, message: doneMessage, done: true });
  })
);
