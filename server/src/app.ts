import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { env } from "./config/env";
import { authRouter } from "./routes/auth.routes";
import { customerRouter } from "./routes/customer.routes";
import { settingsRouter } from "./routes/settings.routes";
import { knowledgeRouter } from "./routes/knowledge.routes";
import { documentsRouter } from "./routes/documents.routes";
import { websiteImportRouter } from "./routes/websiteImport.routes";
import { chatRouter } from "./routes/chat.routes";
import { widgetConfigRouter } from "./routes/widgetConfig.routes";
import { conversationsRouter } from "./routes/conversations.routes";
import { leadsRouter } from "./routes/leads.routes";
import { analyticsRouter } from "./routes/analytics.routes";
import { superAdminRouter } from "./routes/superadmin.routes";
import { adminApiRateLimiter } from "./middleware/rateLimit";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(express.json({ limit: "1mb" }));

  // The widget itself and the public chat/config endpoints must be
  // reachable from ANY origin, since it is embedded on arbitrary third
  // party websites. Tenant isolation there is enforced by clientId
  // lookup, not by CORS -- see chat.routes.ts / widgetConfig.routes.ts.
  app.use("/widget.js", cors());
  app.use("/api/chat", cors());
  app.use("/api/widget", cors());

  // The admin/super-admin API is restricted to the configured dashboard origin(s).
  const adminCors = cors({ origin: env.adminCorsOrigin, credentials: true });

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.get("/widget.js", (_req, res) => {
    res.sendFile(path.resolve(__dirname, "../../widget/dist/widget.js"));
  });

  // Dev-only: serves the sample embed pages used to manually verify tenant
  // isolation end-to-end (two "different websites" using the same widget.js).
  if (env.nodeEnv === "development") {
    app.use("/demo", cors(), express.static(path.resolve(__dirname, "../../test-sites")));
  }

  app.use("/api/chat", chatRouter);
  app.use("/api/widget/config", widgetConfigRouter);

  app.use("/api/auth", adminCors, authRouter);
  app.use("/api/customer", adminCors, adminApiRateLimiter, customerRouter);
  app.use("/api/chatbot/settings", adminCors, adminApiRateLimiter, settingsRouter);
  app.use("/api/knowledge", adminCors, adminApiRateLimiter, knowledgeRouter);
  app.use("/api/documents", adminCors, adminApiRateLimiter, documentsRouter);
  app.use("/api/website-import", adminCors, adminApiRateLimiter, websiteImportRouter);
  app.use("/api/conversations", adminCors, adminApiRateLimiter, conversationsRouter);
  app.use("/api/leads", adminCors, adminApiRateLimiter, leadsRouter);
  app.use("/api/analytics", adminCors, adminApiRateLimiter, analyticsRouter);
  app.use("/api/superadmin", adminCors, adminApiRateLimiter, superAdminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
