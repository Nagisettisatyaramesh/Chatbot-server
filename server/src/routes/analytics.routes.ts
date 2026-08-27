import { Router } from "express";
import { prisma } from "../db/prisma";
import { requireAuth, requireCustomerScope } from "../middleware/auth";
import { asyncHandler, ApiError } from "../middleware/errorHandler";

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth, requireCustomerScope);

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

analyticsRouter.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    const customerId = req.auth!.customerId!;
    const today = startOfToday();

    const [
      customer,
      totalConversations,
      conversationsToday,
      totalLeads,
      newLeads,
      answeredCount,
      handoffCount,
      uniqueVisitors,
      totalMessages,
    ] = await Promise.all([
      prisma.customer.findUnique({ where: { id: customerId } }),
      prisma.conversation.count({ where: { customerId } }),
      prisma.conversation.count({ where: { customerId, startedAt: { gte: today } } }),
      prisma.lead.count({ where: { customerId } }),
      prisma.lead.count({ where: { customerId, status: "NEW" } }),
      prisma.message.count({ where: { customerId, role: "ASSISTANT", wasFallback: false } }),
      prisma.message.count({ where: { customerId, role: "ASSISTANT", wasFallback: true } }),
      prisma.conversation.findMany({ where: { customerId }, distinct: ["visitorId"], select: { visitorId: true } }),
      prisma.message.count({ where: { customerId } }),
    ]);

    if (!customer) throw new ApiError(404, "Customer not found");

    const avgConversationLength = totalConversations > 0 ? totalMessages / totalConversations : 0;

    res.json({
      totalConversations,
      conversationsToday,
      totalLeads,
      newLeads,
      questionsAnswered: answeredCount,
      questionsTransferred: handoffCount,
      uniqueVisitors: uniqueVisitors.length,
      avgConversationLength: Math.round(avgConversationLength * 10) / 10,
      usage: {
        used: customer.messagesUsed,
        limit: customer.messageLimit,
        plan: customer.plan,
        periodStart: customer.usagePeriodStart,
      },
    });
  })
);

analyticsRouter.get(
  "/unanswered",
  asyncHandler(async (req, res) => {
    const items = await prisma.unansweredQuestion.findMany({
      where: { customerId: req.auth!.customerId!, resolved: false },
      orderBy: [{ occurrences: "desc" }, { lastAskedAt: "desc" }],
      take: 50,
    });
    res.json(items);
  })
);

// Converts an unanswered question straight into an FAQ knowledge item --
// this is how the bot "learns" over time, always scoped to this tenant.
analyticsRouter.post(
  "/unanswered/:id/convert",
  asyncHandler(async (req, res) => {
    const { answer } = req.body as { answer?: string };
    if (!answer || typeof answer !== "string" || !answer.trim()) {
      throw new ApiError(400, "An answer is required");
    }
    const question = await prisma.unansweredQuestion.findFirst({
      where: { id: req.params.id, customerId: req.auth!.customerId! },
    });
    if (!question) throw new ApiError(404, "Question not found");

    const [faq] = await prisma.$transaction([
      prisma.knowledgeItem.create({
        data: {
          customerId: req.auth!.customerId!,
          type: "FAQ",
          title: question.question,
          content: answer.trim(),
          source: "MANUAL",
          status: "ACTIVE",
        },
      }),
      prisma.unansweredQuestion.update({ where: { id: question.id }, data: { resolved: true } }),
    ]);

    res.status(201).json(faq);
  })
);
