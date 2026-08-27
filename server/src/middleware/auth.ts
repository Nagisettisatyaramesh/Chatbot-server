import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface AuthPayload {
  sub: string; // admin user id
  email: string;
  role: "OWNER" | "STAFF" | "SUPER_ADMIN";
  customerId: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, env.jwtSecret) as AuthPayload;
    req.auth = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Ensures the caller is a customer-scoped admin (OWNER/STAFF) and attaches
// nothing extra -- routes must still filter every query by req.auth.customerId.
export function requireCustomerScope(req: Request, res: Response, next: NextFunction) {
  if (!req.auth || !req.auth.customerId) {
    return res.status(403).json({ error: "This action requires a customer account" });
  }
  next();
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.auth || req.auth.role !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Super admin access required" });
  }
  next();
}
