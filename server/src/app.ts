import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { chatRouter } from "./routes/chat.routes";
import { chatSemanticRouter } from "./routes/chatSemantic.routes";
import { websiteConfigRouter } from "./routes/websiteConfig.routes";
import { customerAuthRouter } from "./routes/customerAuth.routes";
import { adminAuthRouter } from "./routes/adminAuth.routes";
import { adminKnowledgeRouter } from "./routes/adminKnowledge.routes";
import { adminDocumentsRouter } from "./routes/adminDocuments.routes";
import { registerRouter } from "./routes/register.routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(express.json({ limit: "256kb" }));

  // Open CORS everywhere: the widget is meant to be embedded on arbitrary
  // third-party sites, and isolation is enforced by websiteId lookup in
  // the chat engine, not by which origin is calling.
  app.use(cors());

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.get("/widget.js", (_req, res) => {
    res.sendFile(path.resolve(__dirname, "../../widget/dist/widget.js"));
  });

  // The local demo "websites" used for testing website-content ingestion
  // and cross-website isolation. In a real deployment, each business's
  // WEBSITE_URL would point at their own real site instead.
  app.use("/sites", express.static(path.resolve(__dirname, "../public/sites")));

  // The simple admin portal (plain HTML/JS -- see public/admin/).
  app.use("/admin", express.static(path.resolve(__dirname, "../public/admin")));

  // Side-by-side keyword vs. semantic comparison harness (see public/compare/).
  app.use("/compare", express.static(path.resolve(__dirname, "../public/compare")));

  // Self-service "install this on your website" sign-up page.
  app.use("/register", express.static(path.resolve(__dirname, "../public/register")));

  app.use("/api/chat", chatRouter);
  app.use("/api/chat-semantic", chatSemanticRouter);
  app.use("/api/website-config", websiteConfigRouter);
  app.use("/api/login", customerAuthRouter);
  app.use("/api/register", registerRouter);
  app.use("/api/admin/login", adminAuthRouter);
  app.use("/api/admin/:websiteId/knowledge", adminKnowledgeRouter);
  app.use("/api/admin/:websiteId/documents", adminDocumentsRouter);

  // A single landing page linking to every tool -- registered last so it
  // never shadows the more specific static routes above.
  app.use("/", express.static(path.resolve(__dirname, "../public/home")));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
