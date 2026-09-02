import { Router } from "express";
import { z } from "zod";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { authRateLimiter } from "../middleware/rateLimit";
import { createWebsite } from "../config/websites";
import { registerAdmin } from "../auth/adminAuth";
import { sanitizeShortField } from "../lib/security/sanitize";

export const registerRouter = Router();
registerRouter.use(authRateLimiter);

const registerSchema = z.object({
  businessName: z.string().min(2).max(200),
  websiteUrl: z.string().url(),
  category: z.string().max(100).optional(),
  humanPhone: z.string().min(5).max(30),
  address: z.string().max(300).optional(),
  hours: z.string().max(200).optional(),
  email: z.string().email().optional().or(z.literal("")),
  adminUsername: z.string().min(3).max(50),
  adminPassword: z.string().min(6).max(200),
});

// Public, self-service: anyone can register a new website and immediately
// get a working, isolated chatbot for it -- no code changes, no one
// hand-editing config files. This is what makes the tool actually
// "install on any website" rather than a fixed pair of demos.
registerRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Invalid registration data");
    const data = parsed.data;

    const website = createWebsite({
      websiteUrl: data.websiteUrl,
      businessName: sanitizeShortField(data.businessName),
      category: data.category ? sanitizeShortField(data.category) : "",
      humanPhone: data.humanPhone,
      address: data.address ?? "",
      hours: data.hours ?? "",
      email: data.email ?? "",
    });

    registerAdmin(website.websiteId, data.adminUsername.trim(), data.adminPassword);

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const widgetSrc = `${baseUrl}/widget.js`;
    const chatEndpoint = "/api/chat-semantic";
    const embedSnippet = `<script\n  src="${widgetSrc}"\n  data-website-id="${website.websiteId}"\n  data-chat-endpoint="${chatEndpoint}">\n</script>`;

    res.status(201).json({
      websiteId: website.websiteId,
      widgetSrc,
      chatEndpoint,
      embedSnippet,
      adminLoginUrl: `${baseUrl}/admin/`,
    });
  })
);
