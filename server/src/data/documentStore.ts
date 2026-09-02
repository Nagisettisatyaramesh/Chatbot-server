import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

export interface DocumentRecord {
  id: string;
  filename: string; // original filename, shown to the admin and used on download
  storedFilename: string; // randomized name actually on disk under data/uploads/<websiteId>/
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  chunkIds: string[]; // the KnowledgeItem ids this document's text was split into
}

const DATA_DIR = path.resolve(__dirname, "../../data/documents-meta");

function filePathFor(websiteId: string): string {
  const safeId = websiteId.replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(DATA_DIR, `${safeId}.json`);
}

function readAll(websiteId: string): DocumentRecord[] {
  try {
    return JSON.parse(fs.readFileSync(filePathFor(websiteId), "utf-8"));
  } catch {
    return [];
  }
}

function writeAll(websiteId: string, docs: DocumentRecord[]): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(filePathFor(websiteId), JSON.stringify(docs, null, 2), "utf-8");
}

export function listDocuments(websiteId: string): DocumentRecord[] {
  return readAll(websiteId);
}

export function addDocumentRecord(
  websiteId: string,
  filename: string,
  storedFilename: string,
  mimeType: string,
  sizeBytes: number,
  chunkIds: string[]
): DocumentRecord {
  const docs = readAll(websiteId);
  const record: DocumentRecord = { id: randomUUID(), filename, storedFilename, mimeType, sizeBytes, uploadedAt: new Date().toISOString(), chunkIds };
  docs.push(record);
  writeAll(websiteId, docs);
  return record;
}

export function getDocumentRecord(websiteId: string, documentId: string): DocumentRecord | null {
  return readAll(websiteId).find((d) => d.id === documentId) ?? null;
}

// Returns the removed record (so the caller can also delete its knowledge
// chunks) or null if no matching document was found for this website.
export function removeDocumentRecord(websiteId: string, documentId: string): DocumentRecord | null {
  const docs = readAll(websiteId);
  const idx = docs.findIndex((d) => d.id === documentId);
  if (idx === -1) return null;
  const [removed] = docs.splice(idx, 1);
  writeAll(websiteId, docs);
  return removed;
}
