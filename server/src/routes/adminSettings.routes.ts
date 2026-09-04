import { Router } from "express";
import { z } from "zod";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { requireAdminSession } from "../middleware/requireAdminSession";
import { getWebsiteConfig, setCustomApiUrl } from "../config/websites";

// Mounted at /api/admin/:websiteId/settings -- lets a business connect (or
// disconnect) their own database AFTER registration, once their backend
// implements CUSTOMER_API_CONTRACT.md. Their backend may not have existed
// yet when they first signed up.
export const adminSettingsRouter = Router({ mergeParams: true });
adminSettingsRouter.use(requireAdminSession);

adminSettingsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const site = getWebsiteConfig(req.params.websiteId);
    if (!site) throw new ApiError(404, "Website not found");
    res.json({ customApiUrl: site.customApiUrl ?? "" });
  })
);

const updateSchema = z.object({
  customApiUrl: z.string().url().optional().or(z.literal("")),
});

adminSettingsRouter.put(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Invalid settings");
    const updated = setCustomApiUrl(req.params.websiteId, parsed.data.customApiUrl ?? "");
    if (!updated) throw new ApiError(404, "Website not found");
    res.json({ customApiUrl: updated.customApiUrl ?? "" });
  })
);
