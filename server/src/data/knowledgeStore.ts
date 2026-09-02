import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
}

const DATA_DIR = path.resolve(__dirname, "../../data/knowledge");

function filePathFor(websiteId: string): string {
  // websiteId always comes from a validated route param / config lookup
  // upstream, but sanitize defensively anyway before touching the filesystem.
  const safeId = websiteId.replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(DATA_DIR, `${safeId}.json`);
}

function readFile(websiteId: string): KnowledgeItem[] {
  try {
    const raw = fs.readFileSync(filePathFor(websiteId), "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeFile(websiteId: string, items: KnowledgeItem[]): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(filePathFor(websiteId), JSON.stringify(items, null, 2), "utf-8");
}

// Every function here takes websiteId as its first argument and only ever
// reads/writes that one website's own JSON file -- there is no function
// that can read or modify a different website's knowledge.
export function getKnowledgeBase(websiteId: string): KnowledgeItem[] {
  return readFile(websiteId);
}

export function addKnowledgeItem(websiteId: string, title: string, content: string): KnowledgeItem {
  const items = readFile(websiteId);
  const item: KnowledgeItem = { id: randomUUID(), title, content };
  items.push(item);
  writeFile(websiteId, items);
  return item;
}

export function updateKnowledgeItem(websiteId: string, id: string, title: string, content: string): KnowledgeItem | null {
  const items = readFile(websiteId);
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  items[idx] = { id, title, content };
  writeFile(websiteId, items);
  return items[idx];
}

export function deleteKnowledgeItem(websiteId: string, id: string): boolean {
  const items = readFile(websiteId);
  const next = items.filter((i) => i.id !== id);
  if (next.length === items.length) return false;
  writeFile(websiteId, next);
  return true;
}
