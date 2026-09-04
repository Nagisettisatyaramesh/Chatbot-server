import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

// Every time the chatbot has to give the fixed fallback message, that's a
// real gap in the knowledge base -- logged here so the admin can review
// what visitors actually asked and add a proper answer, instead of that
// signal being silently lost.
export interface UnansweredQuestion {
  id: string;
  message: string;
  count: number;
  firstAskedAt: string;
  lastAskedAt: string;
  resolved: boolean;
}

const DATA_DIR = path.resolve(__dirname, "../../data/unanswered");

function filePathFor(websiteId: string): string {
  const safeId = websiteId.replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(DATA_DIR, `${safeId}.json`);
}

function readAll(websiteId: string): UnansweredQuestion[] {
  try {
    return JSON.parse(fs.readFileSync(filePathFor(websiteId), "utf-8"));
  } catch {
    return [];
  }
}

function writeAll(websiteId: string, items: UnansweredQuestion[]): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(filePathFor(websiteId), JSON.stringify(items, null, 2), "utf-8");
}

// Same question asked again while still unresolved just bumps the count
// and timestamp, rather than cluttering the list with duplicates -- the
// count itself is a useful signal for which gaps matter most.
export function recordUnansweredQuestion(websiteId: string, message: string): void {
  const trimmed = message.trim();
  if (!trimmed) return;
  const items = readAll(websiteId);
  const now = new Date().toISOString();
  const existing = items.find((q) => !q.resolved && q.message.toLowerCase() === trimmed.toLowerCase());
  if (existing) {
    existing.count += 1;
    existing.lastAskedAt = now;
  } else {
    items.unshift({ id: randomUUID(), message: trimmed, count: 1, firstAskedAt: now, lastAskedAt: now, resolved: false });
  }
  writeAll(websiteId, items);
}

export function listUnansweredQuestions(websiteId: string, includeResolved = false): UnansweredQuestion[] {
  const items = readAll(websiteId);
  return includeResolved ? items : items.filter((q) => !q.resolved);
}

export function resolveUnansweredQuestion(websiteId: string, id: string): boolean {
  const items = readAll(websiteId);
  const item = items.find((q) => q.id === id);
  if (!item) return false;
  item.resolved = true;
  writeAll(websiteId, items);
  return true;
}

export function deleteUnansweredQuestion(websiteId: string, id: string): boolean {
  const items = readAll(websiteId);
  const idx = items.findIndex((q) => q.id === id);
  if (idx === -1) return false;
  items.splice(idx, 1);
  writeAll(websiteId, items);
  return true;
}
