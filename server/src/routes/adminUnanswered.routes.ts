import { Router } from "express";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { requireAdminSession } from "../middleware/requireAdminSession";
import { listUnansweredQuestions, resolveUnansweredQuestion, deleteUnansweredQuestion } from "../data/unansweredStore";

// Mounted at /api/admin/:websiteId/unanswered -- every question the
// chatbot couldn't answer lands here so the admin can see the real gaps
// in their knowledge base and act on them, instead of that signal just
// vanishing into a visitor's frustration.
export const adminUnansweredRouter = Router({ mergeParams: true });
adminUnansweredRouter.use(requireAdminSession);

adminUnansweredRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(listUnansweredQuestions(req.params.websiteId));
  })
);

// Marks a question as handled -- called once the admin has added a
// knowledge article (or otherwise decided it doesn't need one).
adminUnansweredRouter.post(
  "/:id/resolve",
  asyncHandler(async (req, res) => {
    const ok = resolveUnansweredQuestion(req.params.websiteId, req.params.id);
    if (!ok) throw new ApiError(404, "Question not found");
    res.status(204).send();
  })
);

adminUnansweredRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const ok = deleteUnansweredQuestion(req.params.websiteId, req.params.id);
    if (!ok) throw new ApiError(404, "Question not found");
    res.status(204).send();
  })
);
