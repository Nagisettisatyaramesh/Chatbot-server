import { Router } from "express";
import { z } from "zod";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { requireAdminSession } from "../middleware/requireAdminSession";
import { getKnowledgeBase, addKnowledgeItem, updateKnowledgeItem, deleteKnowledgeItem } from "../data/knowledgeStore";
import { sanitizeShortField } from "../lib/security/sanitize";

// Mounted at /api/admin/:websiteId/knowledge -- every handler is scoped to
// req.params.websiteId, which requireAdminSession has already confirmed
// this admin session was issued for.
export const adminKnowledgeRouter = Router({ mergeParams: true });
adminKnowledgeRouter.use(requireAdminSession);

adminKnowledgeRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(getKnowledgeBase(req.params.websiteId));
  })
);

const itemSchema = z.object({
  title: z.string().min(1).max(300),
  content: z.string().min(1).max(5000),
});

adminKnowledgeRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = itemSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "Title and content are required");
    const title = sanitizeShortField(parsed.data.title);
    const item = addKnowledgeItem(req.params.websiteId, title, parsed.data.content.trim());
    res.status(201).json(item);
  })
);

adminKnowledgeRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = itemSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "Title and content are required");
    const title = sanitizeShortField(parsed.data.title);
    const updated = updateKnowledgeItem(req.params.websiteId, req.params.id, title, parsed.data.content.trim());
    if (!updated) throw new ApiError(404, "Knowledge item not found");
    res.json(updated);
  })
);

adminKnowledgeRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const deleted = deleteKnowledgeItem(req.params.websiteId, req.params.id);
    if (!deleted) throw new ApiError(404, "Knowledge item not found");
    res.status(204).send();
  })
);
