import { Router } from "express";
import { getWebsiteConfig } from "../config/websites";
import { asyncHandler, ApiError } from "../middleware/errorHandler";

export const websiteConfigRouter = Router();

// Public, unauthenticated -- returns only display/handoff info needed to
// render the widget for ONE website, resolved by websiteId. No knowledge,
// no other website's data, no secrets (no AI key, no database contents).
websiteConfigRouter.get(
  "/:websiteId",
  asyncHandler(async (req, res) => {
    const site = getWebsiteConfig(req.params.websiteId);
    if (!site) throw new ApiError(404, "Unknown website");

    res.json({
      businessName: site.businessName,
      humanPhone: site.humanPhone,
    });
  })
);
