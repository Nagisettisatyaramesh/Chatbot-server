export interface ScorableDoc {
  id: string;
  title: string;
  content: string;
}

export interface ScoredDoc<T extends ScorableDoc> {
  doc: T;
  score: number;
}

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "do", "does", "did", "have", "has", "had", "i", "you", "we", "they",
  "he", "she", "it", "this", "that", "these", "those", "to", "of", "in",
  "on", "for", "with", "and", "or", "but", "if", "then", "so", "what",
  "how", "when", "where", "why", "who", "which", "can", "could", "will",
  "would", "should", "please", "me", "my", "your", "about",
  // Conversational filler that isn't a stopword in ordinary English but
  // has zero content value here -- without these, a casual prefix like
  // "hi, do you have a gym?" required BOTH "hi" and "gym" to match (since
  // "hi" trivially never appears in FAQ content), silently blocking an
  // otherwise-clean match.
  "hi", "hello", "hey", "hiya", "yo", "thanks", "thank", "yeah", "yep", "ok", "okay",
  "want", "wanted", "wants", "need", "needed", "needs", "just", "kindly",
  "tell", "give", "show", "explain", "describe",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    // Filter stopwords on the ORIGINAL word first. Singularizing before
    // filtering let 4+ letter stopwords ending in "s" (e.g. "does" ->
    // "doe") slip through as bogus content terms, since the mangled form
    // was never itself in the stopword list.
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .map((w) => (w.endsWith("s") && w.length > 3 ? w.slice(0, -1) : w)) // crude singularization
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

function termFreq(terms: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const t of terms) freq.set(t, (freq.get(t) ?? 0) + 1);
  return freq;
}

const MIN_SCORE_THRESHOLD = 0.22;
// A title match counts far more than the same word appearing in the body.
// Without this, a short document whose CONTENT happens to mention a word
// in passing (e.g. a "business center" FAQ that mentions "...printing and
// scanning facilities...") could outscore the actual "Facilities" section
// -- because blending title+content into one length-normalized bag of
// words let a longer, correctly-titled document get penalized by its own
// content length relative to a short, only-incidentally-matching one.
// Scoring title and content separately (each normalized by its OWN
// length) and weighting the title heavily fixes that: a real topical
// title match no longer gets diluted by unrelated body text.
const TITLE_WEIGHT = 4;

// Generic TF-IDF-style ranker used for BOTH website content and knowledge
// base matching. The caller is responsible for only ever passing in
// documents that already belong to one website -- this function has no
// concept of tenancy, it just ranks whatever list it's given.
export function scoreMatches<T extends ScorableDoc>(query: string, docs: T[], topK = 4): ScoredDoc<T>[] {
  const queryTerms = Array.from(new Set(tokenize(query)));
  if (queryTerms.length === 0 || docs.length === 0) return [];

  const docParts = docs.map((doc) => {
    const titleTerms = tokenize(doc.title);
    const contentTerms = tokenize(doc.content);
    return { doc, titleTerms, contentTerms, titleFreq: termFreq(titleTerms), contentFreq: termFreq(contentTerms) };
  });

  // Document frequency (for IDF) counts a doc as "containing" a term if it
  // appears anywhere in title OR content.
  const docFrequency = new Map<string, number>();
  for (const qt of queryTerms) {
    let count = 0;
    for (const { titleFreq, contentFreq } of docParts) {
      if (titleFreq.has(qt) || contentFreq.has(qt)) count++;
    }
    docFrequency.set(qt, count);
  }

  // Require ~70% of the query's distinct terms to actually match
  // (anywhere in title or content) -- effectively "all of them" for short
  // queries. A plain score threshold alone let a couple of generic word
  // overlaps outrank the one genuinely distinctive word in the query.
  const minMatchedTerms = Math.ceil(queryTerms.length * 0.7);

  const scored: ScoredDoc<T>[] = docParts.map(({ doc, titleTerms, contentTerms, titleFreq, contentFreq }) => {
    let titleRaw = 0;
    let contentRaw = 0;
    const matchedTerms = new Set<string>();

    for (const qt of queryTerms) {
      const df = docFrequency.get(qt) ?? 1;
      const idf = Math.log(1 + docs.length / df);

      const tfTitle = titleFreq.get(qt) ?? 0;
      if (tfTitle > 0) {
        titleRaw += (1 + Math.log(tfTitle)) * idf;
        matchedTerms.add(qt);
      }

      const tfContent = contentFreq.get(qt) ?? 0;
      if (tfContent > 0) {
        contentRaw += (1 + Math.log(tfContent)) * idf;
        matchedTerms.add(qt);
      }
    }

    const titleScore = titleTerms.length > 0 ? titleRaw / Math.sqrt(titleTerms.length + 1) : 0;
    const contentScore = contentTerms.length > 0 ? contentRaw / Math.sqrt(contentTerms.length + 1) : 0;
    const combined = (titleScore * TITLE_WEIGHT + contentScore) / Math.sqrt(queryTerms.length);

    const score = matchedTerms.size >= minMatchedTerms ? combined : 0;
    return { doc, score };
  });

  return scored
    .filter((s) => s.score >= MIN_SCORE_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
