import fs from "fs";

// Client-rendered sites (React/Vue/Angular) return near-empty HTML to a
// plain fetch() -- the page's real content only exists after its
// JavaScript runs in a browser. This module is the actual fix for that:
// launch a real (already-installed) browser, let the page's JS run, and
// read back the DOM it produced. We deliberately use puppeteer-core (no
// bundled Chromium download) driving whatever Chrome/Edge is already on
// this machine, rather than puppeteer's ~300MB own copy.

const CANDIDATE_PATHS = [
  // Windows
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  // macOS
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  // Linux
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
];

let cachedBrowserPath: string | null | undefined;

function findBrowserExecutable(): string | null {
  if (cachedBrowserPath !== undefined) return cachedBrowserPath;
  cachedBrowserPath = CANDIDATE_PATHS.find((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  }) ?? null;
  return cachedBrowserPath;
}

const RENDER_TIMEOUT_MS = 15000;

// Renders a URL in a real browser and returns the resulting HTML (after
// JavaScript has run), or null if no browser is available or rendering
// fails for any reason -- callers fall back to the plain-fetch path.
export async function renderPageHtml(url: string): Promise<string | null> {
  const executablePath = findBrowserExecutable();
  if (!executablePath) {
    console.error("[headless-render] no Chrome/Edge install found -- skipping JS rendering for", url);
    return null;
  }

  let puppeteer: typeof import("puppeteer-core");
  try {
    puppeteer = await import("puppeteer-core");
  } catch {
    console.error("[headless-render] puppeteer-core not installed -- skipping JS rendering for", url);
    return null;
  }

  let browser: import("puppeteer-core").Browser | null = null;
  try {
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
    });
    const page = await browser.newPage();
    await page.setUserAgent("ChatbotContentIngest/1.0 (+headless)");
    await page.goto(url, { waitUntil: "networkidle2", timeout: RENDER_TIMEOUT_MS });
    // A brief settle beyond "network idle" -- some apps paint their real
    // content a moment after their last network request resolves.
    await new Promise((resolve) => setTimeout(resolve, 500));
    const html = await page.content();
    return html;
  } catch (err) {
    console.error(`[headless-render] failed to render ${url}:`, err instanceof Error ? err.message : err);
    return null;
  } finally {
    if (browser) await browser.close().catch(() => void 0);
  }
}
