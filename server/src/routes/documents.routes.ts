import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";
import { prisma } from "../db/prisma";
import { requireAuth, requireCustomerScope } from "../middleware/auth";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { env } from "../config/env";
import { extractTextFromFile, chunkText } from "../lib/documents/parse";

export const documentsRouter = Router();
documentsRouter.use(requireAuth, requireCustomerScope);

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = path.join(env.uploadDir, req.auth!.customerId!);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).slice(0, 10);
      cb(null, `${nanoid(16)}${ext}`);
    },
  }),
  limits: { fileSize: env.maxUploadMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new ApiError(400, "Unsupported file type. Allowed: PDF, DOC, DOCX, TXT"));
      return;
    }
    cb(null, true);
  },
});

documentsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const docs = await prisma.document.findMany({
      where: { customerId: req.auth!.customerId! },
      orderBy: { createdAt: "desc" },
    });
    res.json(docs);
  })
);

documentsRouter.post(
  "/",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, "No file uploaded");
    const customerId = req.auth!.customerId!;

    const doc = await prisma.document.create({
      data: {
        customerId,
        filename: req.file.originalname,
        fileUrl: req.file.path,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        status: "PROCESSING",
      },
    });

    try {
      const text = await extractTextFromFile(req.file.path, req.file.mimetype);
      const chunks = chunkText(text);
      if (chunks.length === 0) throw new Error("No extractable text found in document");

      await prisma.$transaction([
        ...chunks.map((content, i) =>
          prisma.knowledgeItem.create({
            data: {
              customerId,
              type: "DOCUMENT_CHUNK",
              title: `${req.file!.originalname} (part ${i + 1})`,
              content,
              source: "DOCUMENT",
              status: "ACTIVE",
              documentId: doc.id,
            },
          })
        ),
        prisma.document.update({ where: { id: doc.id }, data: { status: "READY" } }),
      ]);

      res.status(201).json({ ...doc, status: "READY", chunkCount: chunks.length });
    } catch (err) {
      await prisma.document.update({
        where: { id: doc.id },
        data: { status: "FAILED", errorMessage: err instanceof Error ? err.message : "Processing failed" },
      });
      res.status(201).json({ ...doc, status: "FAILED" });
    }
  })
);

documentsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const doc = await prisma.document.findFirst({
      where: { id: req.params.id, customerId: req.auth!.customerId! },
    });
    if (!doc) throw new ApiError(404, "Document not found");

    await prisma.$transaction([
      prisma.knowledgeItem.deleteMany({ where: { documentId: doc.id, customerId: req.auth!.customerId! } }),
      prisma.document.delete({ where: { id: doc.id } }),
    ]);

    fs.unlink(doc.fileUrl, () => void 0);
    res.status(204).send();
  })
);
