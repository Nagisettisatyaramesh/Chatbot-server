import fs from "fs";
import path from "path";

// The registry of websites this chatbot serves. File-backed (rather than
// a hardcoded object) specifically so a new business can self-register
// (see routes/register.routes.ts) without anyone hand-editing source code
// -- "install it on any website" requires this to be data, not code.
export interface WebsiteConfig {
  websiteId: string;
  websiteUrl: string;
  businessName: string;
  category: string;
  humanPhone: string;
  address: string;
  hours: string;
  email: string;
  // Optional: base URL of the tenant's OWN backend API (e.g. a real hotel's
  // booking system). When set, the answer engines read REAL bookings and
  // REAL room inventory from that API instead of the local placeholder
  // JSON stores -- see integrations/liveHotelApi.ts.
  liveApiUrl?: string;
}

const DATA_FILE = path.resolve(__dirname, "../../data/websites.json");

function loadAll(): WebsiteConfig[] {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function saveAll(list: WebsiteConfig[]): void {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), "utf-8");
}

export function getWebsiteConfig(websiteId: string): WebsiteConfig | null {
  return loadAll().find((w) => w.websiteId === websiteId) ?? null;
}

export function listWebsites(): WebsiteConfig[] {
  return loadAll();
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) || "site"
  );
}

// Self-service registration: generates a unique websiteId from the
// business name (e.g. "Sunrise Bakery" -> "sunrise-bakery", or
// "sunrise-bakery-2" on a collision) and appends the new config. Every
// other module (knowledge store, live-data store, content ingestion,
// admin auth) already takes websiteId as a plain string key, so a newly
// registered site works everywhere immediately with zero code changes.
export function createWebsite(input: Omit<WebsiteConfig, "websiteId">): WebsiteConfig {
  const all = loadAll();
  const base = slugify(input.businessName);
  let websiteId = base;
  let n = 2;
  while (all.some((w) => w.websiteId === websiteId)) {
    websiteId = `${base}-${n}`;
    n++;
  }
  const config: WebsiteConfig = { websiteId, ...input };
  all.push(config);
  saveAll(all);
  return config;
}
