import { prisma } from "../../db/prisma";

export interface RetrievedItem {
  id: string;
  type: string;
  title: string;
  content: string;
  price: string | null;
  score: number;
}

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "do", "does", "did", "have", "has", "had", "i", "you", "we", "they",
  "he", "she", "it", "this", "that", "these", "those", "to", "of", "in",
  "on", "for", "with", "and", "or", "but", "if", "then", "so", "what",
  "how", "when", "where", "why", "who", "which", "can", "could", "will",
  "would", "should", "please", "me", "my", "your", "about",
]);

// Generic phrasing ("what services do you offer", "how much does it cost")
// won't literally appear inside a business's own knowledge text, so each
// knowledge type gets a small set of synonym terms mixed into its indexed
// text at lower weight. This only affects ranking within one tenant's own
// knowledge -- it never widens the WHERE customerId filter below.
const TYPE_ALIASES: Record<string, string> = {
  ABOUT: "about company business who history information overview",
  SERVICE: "service services offer offering offerings provide provides product products package packages price pricing cost rate rates plan plans",
  FAQ: "question questions faq frequently asked",
  POLICY: "policy policies terms rule rules cancellation refund booking condition conditions",
  DOCUMENT_CHUNK: "document",
  WEBSITE: "",
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    // Filter stopwords on the ORIGINAL word first. Singularizing before
    // filtering let 4+ letter stopwords ending in "s" (e.g. "does" ->
    // "doe") slip through as bogus content terms, since the mangled form
    // was never itself in the stopword list -- this silently inflated
    // query term counts and skewed the overlap-ratio confidence check.
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .map((w) => (w.endsWith("s") && w.length > 3 ? w.slice(0, -1) : w)) // crude singularization
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

const MIN_SCORE_THRESHOLD = 0.22;

// THE single access point for reading knowledge for a chat answer.
// customerId is required and always applied as a WHERE clause -- this is
// the enforcement point for "never search across tenants."
export async function retrieveKnowledge(
  customerId: string,
  query: string,
  topK = 6
): Promise<RetrievedItem[]> {
  const items = await prisma.knowledgeItem.findMany({
    where: { customerId, status: "ACTIVE" },
    select: { id: true, type: true, title: true, content: true, price: true },
  });

  const queryTerms = Array.from(new Set(tokenize(query)));
  if (queryTerms.length === 0 || items.length === 0) return [];

  // Build per-document term frequency maps, then per-corpus document
  // frequency (for IDF) -- all scoped to this tenant's own items only.
  const docTermMaps = items.map((item) => {
    const weightedText = [item.title, item.title, item.content, TYPE_ALIASES[item.type] ?? ""].join(" ");
    const terms = tokenize(weightedText);
    const freq = new Map<string, number>();
    for (const t of terms) freq.set(t, (freq.get(t) ?? 0) + 1);
    return { item, freq, length: terms.length };
  });

  const docFrequency = new Map<string, number>();
  for (const qt of queryTerms) {
    let count = 0;
    for (const { freq } of docTermMaps) if (freq.has(qt)) count++;
    docFrequency.set(qt, count);
  }

  // A document only counts as a real candidate if enough of the query's
  // DISTINCT terms actually appear in it -- not just a high weighted score.
  // With a small per-tenant knowledge base, incidental word overlaps can
  // look statistically "rare" enough to score above threshold on IDF alone,
  // even when the query's actually distinctive word matched nothing. Two
  // examples hit during testing: "airport shuttle service" matched an
  // unrelated "Premium Suites" item via generic "airport" + the SERVICE
  // type-alias word "service" (while "shuttle" matched nothing anywhere);
  // "do you offer pre-wedding photography packages" (asked of a HOTEL,
  // which has no photography knowledge at all) matched its own unrelated
  // "Banquet Hall" item via "wedding"/"offer"/"package" while the one truly
  // distinctive word, "photography", matched nothing. Requiring ~70% of the
  // query's distinct terms to actually match (effectively "all of them" for
  // short queries) closes both without needing a large rewrite of the
  // scorer.
  const minMatchedTerms = Math.ceil(queryTerms.length * 0.7);

  const scored: RetrievedItem[] = docTermMaps.map(({ item, freq, length }) => {
    let raw = 0;
    let matchedTerms = 0;
    for (const qt of queryTerms) {
      const tf = freq.get(qt) ?? 0;
      if (tf === 0) continue;
      matchedTerms++;
      const df = docFrequency.get(qt) ?? 1;
      const idf = Math.log(1 + items.length / df);
      raw += (1 + Math.log(tf)) * idf;
    }
    const score = matchedTerms >= minMatchedTerms ? raw / Math.sqrt(length + 1) / Math.sqrt(queryTerms.length) : 0;
    return { id: item.id, type: item.type, title: item.title, content: item.content, price: item.price, score };
  });

  return scored
    .filter((i) => i.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export function hasSufficientConfidence(results: RetrievedItem[]): boolean {
  if (results.length === 0) return false;
  return results[0].score >= MIN_SCORE_THRESHOLD;
}
