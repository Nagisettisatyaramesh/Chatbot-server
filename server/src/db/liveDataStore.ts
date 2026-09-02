import fs from "fs";
import path from "path";
import { env } from "../config/env";

// Stands in for "the website's real database/API" (rooms, bookings,
// appointments, inventory, etc). Reading straight from a small JSON file
// keeps local testing trivial while preserving the real interface a
// production version would have: a narrow, website-scoped lookup function
// that returns only that site's current live-data snapshot -- never a raw
// dump of every table, and never another website's data.
function resolveDbPath(): string {
  return path.isAbsolute(env.databaseUrl) ? env.databaseUrl : path.resolve(process.cwd(), env.databaseUrl);
}

function loadAll(): Record<string, Record<string, unknown>> {
  try {
    const raw = fs.readFileSync(resolveDbPath(), "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("[live-data] failed to read database file:", err);
    return {};
  }
}

// Returns ONLY this website's own live-data object (already a small,
// curated set of current counters -- not a database dump). Returns null if
// the site has no live data configured, so the caller can fall through to
// the next source in the priority order rather than fabricate something.
export function getLiveData(websiteId: string): Record<string, unknown> | null {
  const all = loadAll();
  return all[websiteId] ?? null;
}
