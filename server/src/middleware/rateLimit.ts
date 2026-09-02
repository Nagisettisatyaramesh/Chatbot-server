import rateLimit from "express-rate-limit";

// Keyed by websiteId + IP so one noisy visitor on one site can't exhaust
// another site's or another visitor's budget.
export const chatRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.body?.websiteId ?? "unknown"}:${req.ip}`,
  message: { error: "Too many messages, please slow down." },
});

// Login endpoints (customer and admin): looser than chat, but still
// protective against credential-stuffing / brute force.
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later." },
});
