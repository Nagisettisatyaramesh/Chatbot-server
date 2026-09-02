import * as cheerio from "cheerio";
import { fetchLiveRoomTypes, formatRoomTypeSummary } from "../integrations/liveHotelApi";

export interface ContentSection {
  id: string;
  title: string;
  content: string;
}

interface CacheEntry {
  sections: ContentSection[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // long enough to avoid refetching on every message, short enough to pick up edits reasonably soon
const cache = new Map<string, CacheEntry>();

const MAX_SECTION_CHARS = 2000;
const MIN_SECTION_CHARS = 40;
const CHUNK_WORD_TARGET = 150;

function cleanDoc($: cheerio.CheerioAPI): void {
  $("script, style, noscript, iframe, svg, nav, footer, header, form, [aria-hidden='true']").remove();
}

function pickMainContainer($: cheerio.CheerioAPI) {
  const candidates = ["main", "[role='main']", "#main", "#content", ".content", "article", "body"];
  for (const sel of candidates) {
    const el = $(sel).first();
    if (el.length && el.text().trim().length > 100) return el;
  }
  return $("body");
}

// Strategy 1: explicit <section id="..."> blocks, e.g. our own demo pages
// author their HTML this way deliberately. Best signal when present.
function extractExplicitSections($: cheerio.CheerioAPI): ContentSection[] {
  const sections: ContentSection[] = [];
  $("section[id]").each((_, el) => {
    const $el = $(el);
    const id = $el.attr("id") ?? "";
    const heading = $el.find("h1, h2, h3").first().text().trim();
    const text = $el.clone().find("h1, h2, h3").remove().end().text().replace(/\s+/g, " ").trim();
    if (text.length >= MIN_SECTION_CHARS) sections.push({ id, title: heading || id, content: text.slice(0, MAX_SECTION_CHARS) });
  });
  return sections;
}

// Strategy 2: most real-world business sites have NO explicit <section id>
// structure at all, but do have headings. Walk the main content area in
// document order, treat each heading as starting a new section, and
// collect the text of everything under it until the next heading.
function extractByHeadings($: cheerio.CheerioAPI, container: ReturnType<cheerio.CheerioAPI>): ContentSection[] {
  const sections: ContentSection[] = [];
  let currentTitle = "";
  let buffer: string[] = [];
  let idx = 0;

  const flush = () => {
    const text = buffer.join(" ").replace(/\s+/g, " ").trim();
    if (text.length >= MIN_SECTION_CHARS) {
      sections.push({ id: `section-${idx++}`, title: currentTitle || `Page section ${idx}`, content: text.slice(0, MAX_SECTION_CHARS) });
    }
    buffer = [];
  };

  container.find("h1, h2, h3, h4, p, li, td, blockquote").each((_, el) => {
    const tag = (el as { tagName?: string }).tagName?.toLowerCase();
    const $el = $(el);
    if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4") {
      flush();
      currentTitle = $el.text().trim();
    } else {
      const t = $el.text().trim();
      if (t) buffer.push(t);
    }
  });
  flush();
  return sections;
}

// Strategy 3: last resort for pages with no headings at all -- chunk the
// raw visible text into paragraph-sized pieces so there's still SOMETHING
// for retrieval to search over, rather than nothing.
function extractByChunking(container: ReturnType<cheerio.CheerioAPI>): ContentSection[] {
  const text = container.text().replace(/\s+/g, " ").trim();
  if (text.length < MIN_SECTION_CHARS) return [];

  const words = text.split(" ");
  const sections: ContentSection[] = [];
  for (let i = 0, part = 1; i < words.length; i += CHUNK_WORD_TARGET, part++) {
    const chunk = words.slice(i, i + CHUNK_WORD_TARGET).join(" ");
    if (chunk.length >= MIN_SECTION_CHARS) {
      sections.push({ id: `chunk-${part}`, title: `Page content (part ${part})`, content: chunk.slice(0, MAX_SECTION_CHARS) });
    }
  }
  return sections;
}

// Some real-world sites (client-rendered SPAs -- React/Vue/Angular dev
// servers) return near-empty HTML to a plain fetch(), since content only
// appears after JavaScript runs. We don't run a headless browser for that;
// instead, when the tenant has a `liveApiUrl` (their own backend API), we
// build content sections directly from its structured data (room types,
// descriptions, amenities, pricing) -- which is actually MORE reliable
// than scraped text, and always reflects real current availability.
async function buildLiveApiSections(liveApiUrl: string): Promise<ContentSection[]> {
  const roomTypes = await fetchLiveRoomTypes(liveApiUrl);
  return roomTypes.map((rt) => ({
    id: `live-room-type-${rt.id}`,
    title: rt.name,
    content: formatRoomTypeSummary(rt),
  }));
}

// Real "ingestion" of the current website's own content -- not a hardcoded
// data file, and not limited to sites we authored ourselves. Tries three
// strategies in order of signal quality, so this works whether the target
// is one of our own demo pages OR an arbitrary real business's existing
// website. Fails soft (empty sections) on network/parse errors -- website
// content is one of several sources, not a hard dependency.
export async function getWebsiteContent(websiteUrl: string, websiteId: string, liveApiUrl?: string): Promise<ContentSection[]> {
  const cached = cache.get(websiteId);
  let sections: ContentSection[];

  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    sections = cached.sections;
  } else {
    try {
      const resp = await fetch(websiteUrl, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "ChatbotContentIngest/1.0" } });
      if (!resp.ok) throw new Error(`Website responded with ${resp.status}`);
      const html = await resp.text();
      const $ = cheerio.load(html);
      cleanDoc($);

      sections = extractExplicitSections($);
      if (sections.length === 0) {
        const container = pickMainContainer($);
        sections = extractByHeadings($, container);
        if (sections.length === 0) sections = extractByChunking(container);
      }
      cache.set(websiteId, { sections, fetchedAt: Date.now() });
    } catch (err) {
      console.error(`[website-content] failed to ingest ${websiteUrl}:`, err instanceof Error ? err.message : err);
      sections = cached?.sections ?? [];
    }
  }

  if (liveApiUrl) {
    const liveSections = await buildLiveApiSections(liveApiUrl);
    return [...liveSections, ...sections];
  }
  return sections;
}
