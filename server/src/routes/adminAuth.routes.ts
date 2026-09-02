import { Router } from "express";
import { z } from "zod";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { authRateLimiter } from "../middleware/rateLimit";
import { adminLogin } from "../auth/adminAuth";

export const adminAuthRouter = Router();
adminAuthRouter.use(authRateLimiter);

const loginSchema = z.object({
  websiteId: z.string().min(1).max(100),
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
});

adminAuthRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "Invalid request");
    const { websiteId, username, password } = parsed.data;

    const token = adminLogin(websiteId, username, password);
    if (!token) throw new ApiError(401, "Invalid admin username or password");

    res.json({ sessionToken: token });
  })
);
