import { Router } from "express";
import { prisma } from "../db/prisma";
import { requireAuth, requireCustomerScope } from "../middleware/auth";
import { asyncHandler, ApiError } from "../middleware/errorHandler";

export const conversationsRouter = Router();
conversationsRouter.use(requireAuth, requireCustomerScope);

conversationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
    const pageSize = 20;
    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where: { customerId: req.auth!.customerId! },
        orderBy: { lastMessageAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { messages: true } } },
      }),
      prisma.conversation.count({ where: { customerId: req.auth!.customerId! } }),
    ]);
    res.json({ conversations, total, page, pageSize });
  })
);

conversationsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, customerId: req.auth!.customerId! },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!conversation) throw new ApiError(404, "Conversation not found");
    res.json(conversation);
  })
);
