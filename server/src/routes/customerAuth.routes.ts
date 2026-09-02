import { Router } from "express";
import { z } from "zod";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { authRateLimiter } from "../middleware/rateLimit";
import { customerLogin } from "../auth/customerAuth";

export const customerAuthRouter = Router();
customerAuthRouter.use(authRateLimiter);

const loginSchema = z.object({
  websiteId: z.string().min(1).max(100),
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
});

customerAuthRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "Invalid request");
    const { websiteId, username, password } = parsed.data;

    const result = customerLogin(websiteId, username, password);
    if (!result) throw new ApiError(401, "Invalid username or password");

    res.json({ sessionToken: result.token, name: result.name });
  })
);
