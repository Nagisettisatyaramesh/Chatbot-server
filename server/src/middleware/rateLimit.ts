import rateLimit from "express-rate-limit";

// Public chat endpoint: keyed by clientId + IP so one noisy visitor can't
// exhaust another tenant's or another visitor's budget.
export const chatRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.body?.clientId ?? "unknown"}:${req.ip}`,
  message: { error: "Too many messages, please slow down." },
});

// Admin/auth endpoints: keyed by IP, looser but still protective against
// credential stuffing / brute force.
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later." },
});

export const adminApiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
