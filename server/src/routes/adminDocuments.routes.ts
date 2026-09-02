import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { requireAdminSession } from "../middleware/requireAdminSession";
import { extractTextFromFile, chunkText } from "../lib/documents/parse";
import { addKnowledgeItem, deleteKnowledgeItem } from "../data/knowledgeStore";
import { listDocuments, addDocumentRecord, removeDocumentRecord, getDocumentRecord } from "../data/documentStore";

// Mounted at /api/admin/:websiteId/documents -- lets a business upload a
// PDF/DOC/DOCX/TXT file (a brochure, FAQ sheet, price list, etc.) and have
// its text become searchable knowledge. This is the fix for websites the
// chatbot can't read directly (client-rendered single-page apps, sites
// behind login, or businesses with no website at all) -- upload the
// document instead, same tenant isolation guarantees as everything else.
export const adminDocumentsRouter = Router({ mergeParams: true });
adminDocumentsRouter.use(requireAdminSession);

const UPLOAD_DIR = path.resolve(__dirname, "../../data/uploads");
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = path.join(UPLOAD_DIR, req.params.websiteId.replace(/[^a-zA-Z0-9_-]/g, ""));
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).slice(0, 10);
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new ApiError(400, "Unsupported file type. Allowed: PDF, DOC, DOCX, TXT"));
      return;
    }
    cb(null, true);
  },
});

adminDocumentsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(listDocuments(req.params.websiteId));
  })
);

adminDocumentsRouter.post(
  "/",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, "No file uploaded");
    const websiteId = req.params.websiteId;

    try {
      const text = await extractTextFromFile(req.file.path, req.file.mimetype);
      const chunks = chunkText(text);
      if (chunks.length === 0) throw new ApiError(400, "No extractable text found in this file");

      const chunkIds = chunks.map((content, i) => addKnowledgeItem(websiteId, `${req.file!.originalname} (part ${i + 1})`, content).id);
      const record = addDocumentRecord(websiteId, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size, chunkIds);

      res.status(201).json({ ...record, chunkCount: chunkIds.length });
    } catch (err) {
      fs.unlink(req.file.path, () => void 0);
      if (err instanceof ApiError) throw err;
      console.error("[admin-documents] extraction failed:", err);
      throw new ApiError(400, "Could not read this file -- it may be corrupted, password-protected, or scanned images without selectable text.");
    }
  })
);

// Lets the admin view/download the exact file they uploaded (not just the
// extracted knowledge text) -- served with the ORIGINAL filename even
// though it's stored on disk under a randomized name.
adminDocumentsRouter.get(
  "/:id/file",
  asyncHandler(async (req, res) => {
    const record = getDocumentRecord(req.params.websiteId, req.params.id);
    if (!record) throw new ApiError(404, "Document not found");
    const safeWebsiteId = req.params.websiteId.replace(/[^a-zA-Z0-9_-]/g, "");
    const filePath = path.join(UPLOAD_DIR, safeWebsiteId, record.storedFilename);
    if (!fs.existsSync(filePath)) throw new ApiError(404, "The uploaded file is no longer available on the server");
    res.download(filePath, record.filename);
  })
);

adminDocumentsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const removed = removeDocumentRecord(req.params.websiteId, req.params.id);
    if (!removed) throw new ApiError(404, "Document not found");
    for (const chunkId of removed.chunkIds) deleteKnowledgeItem(req.params.websiteId, chunkId);
    const safeWebsiteId = req.params.websiteId.replace(/[^a-zA-Z0-9_-]/g, "");
    fs.unlink(path.join(UPLOAD_DIR, safeWebsiteId, removed.storedFilename), () => void 0);
    res.status(204).send();
  })
);
