import * as cheerio from "cheerio";

export interface CrawledPage {
  url: string;
  title: string;
  text: string;
}

const MAX_PAGES = 12;
const MAX_TEXT_CHARS = 6000;
const FETCH_TIMEOUT_MS = 8000;
const USER_AGENT = "AIWebsiteAssistantBot/1.0 (+knowledge import)";

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal, headers: { "User-Agent": USER_AGENT } });
  } finally {
    clearTimeout(t);
  }
}

async function loadDisallowedPaths(origin: string): Promise<string[]> {
  try {
    const resp = await fetchWithTimeout(`${origin}/robots.txt`);
    if (!resp.ok) return [];
    const body = await resp.text();
    const lines = body.split(/\r?\n/);
    let applies = false;
    const disallowed: string[] = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (/^user-agent:\s*\*/i.test(line)) applies = true;
      else if (/^user-agent:/i.test(line)) applies = false;
      else if (applies && /^disallow:/i.test(line)) {
        const path = line.split(":").slice(1).join(":").trim();
        if (path) disallowed.push(path);
      }
    }
    return disallowed;
  } catch {
    return []; // if robots.txt is unreachable, proceed conservatively (public pages only, same-origin)
  }
}

function isAllowed(pathname: string, disallowed: string[]): boolean {
  return !disallowed.some((d) => pathname.startsWith(d));
}

// Crawls a small set of same-origin, publicly reachable pages and extracts
// visible text for the customer to review before it becomes knowledge.
// Respects robots.txt Disallow rules for "*". Never follows external links,
// never submits forms, never executes JavaScript.
export async function crawlWebsite(startUrl: string): Promise<CrawledPage[]> {
  const start = new URL(startUrl);
  const origin = start.origin;
  const disallowed = await loadDisallowedPaths(origin);

  const priorityHints = ["about", "service", "product", "faq", "contact", "pricing", "polic", "location"];

  const visited = new Set<string>();
  const queue: string[] = [start.toString()];
  const results: CrawledPage[] = [];

  while (queue.length > 0 && results.length < MAX_PAGES) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      continue;
    }
    if (parsed.origin !== origin) continue;
    if (!isAllowed(parsed.pathname, disallowed)) continue;

    try {
      const resp = await fetchWithTimeout(url);
      const contentType = resp.headers.get("content-type") ?? "";
      if (!resp.ok || !contentType.includes("text/html")) continue;

      const html = await resp.text();
      const $ = cheerio.load(html);
      $("script, style, noscript, svg, nav, footer").remove();

      const title = $("title").first().text().trim() || parsed.pathname;
      const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_CHARS);

      if (text.length > 100) {
        results.push({ url, title, text });
      }

      if (visited.size < MAX_PAGES * 3) {
        const links = $("a[href]")
          .map((_, el) => $(el).attr("href"))
          .get()
          .filter((href): href is string => !!href);

        const scored = links
          .map((href) => {
            try {
              const abs = new URL(href, url);
              if (abs.origin !== origin) return null;
              abs.hash = "";
              const lower = abs.pathname.toLowerCase();
              const priority = priorityHints.some((h) => lower.includes(h)) ? 0 : 1;
              return { href: abs.toString(), priority };
            } catch {
              return null;
            }
          })
          .filter((v): v is { href: string; priority: number } => v !== null)
          .sort((a, b) => a.priority - b.priority);

        for (const { href } of scored) {
          if (!visited.has(href) && !queue.includes(href)) queue.push(href);
        }
      }
    } catch {
      continue; // unreachable page -- skip, do not fail the whole import
    }
  }

  return results;
}
