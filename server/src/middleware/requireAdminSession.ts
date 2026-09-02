import { Request, Response, NextFunction } from "express";
import { isValidAdminSession } from "../auth/adminAuth";

// Admin routes take websiteId from the URL param and require a session
// token (header) that was issued FOR THAT SAME websiteId -- an admin
// logged into one website's portal can never act on another website's
// knowledge base with that same token.
export function requireAdminSession(req: Request, res: Response, next: NextFunction) {
  const websiteId = req.params.websiteId;
  const token = req.headers["x-admin-session"] as string | undefined;
  if (!isValidAdminSession(token, websiteId)) {
    return res.status(401).json({ error: "Admin login required" });
  }
  next();
}
