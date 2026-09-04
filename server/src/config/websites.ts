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
  // JSON stores -- see integrations/liveHotelApi.ts. This is a hand-built
  // adapter for ONE tenant's existing API shape, not something any
  // self-service customer can set for themselves.
  liveApiUrl?: string;
  // Optional: base URL of a tenant's own backend implementing OUR
  // documented generic contract (see CUSTOMER_API_CONTRACT.md) -- this is
  // the self-service equivalent of liveApiUrl. Any customer who registers
  // and implements the two documented endpoints on their own backend can
  // set this themselves, no custom adapter code required on our side.
  // See integrations/genericDataApi.ts.
  customApiUrl?: string;
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

// Lets a business add (or remove) their self-service database connection
// AFTER registration, from the admin portal -- their backend may not have
// existed yet at signup time. Passing an empty string clears it.
export function setCustomApiUrl(websiteId: string, customApiUrl: string): WebsiteConfig | null {
  const all = loadAll();
  const idx = all.findIndex((w) => w.websiteId === websiteId);
  if (idx === -1) return null;
  if (customApiUrl) {
    all[idx] = { ...all[idx], customApiUrl };
  } else {
    const { customApiUrl: _drop, ...rest } = all[idx];
    all[idx] = rest;
  }
  saveAll(all);
  return all[idx];
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
