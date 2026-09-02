import { embed, cosineSimilarity } from "../embeddings/embeddingModel";
import { ScorableDoc, ScoredDoc } from "./search";

// Same threshold role as the keyword scorer's MIN_SCORE_THRESHOLD, but
// calibrated for cosine similarity between sentence embeddings rather
// than TF-IDF scores -- these are not the same scale and aren't
// comparable across the two engines. Calibrated against this session's
// actual bug cases: a genuinely unrelated question scored ~0.07-0.15
// against real FAQ content, while every correct match (even short,
// vague queries like "rates?") scored 0.36+.
const MIN_SIMILARITY = 0.32;

interface CacheEntry {
  key: string; // title + content, to detect edits without a separate hash step
  vector: Float32Array;
}

// Embeddings are deterministic for a given piece of text, so this cache
// only needs to be invalidated when the text itself changes (e.g. an
// admin edits a knowledge article) -- keyed by doc.id, storing the source
// text alongside the vector so a content change is detected on next use.
const cache = new Map<string, CacheEntry>();

async function embedDoc(doc: ScorableDoc): Promise<Float32Array> {
  const key = `${doc.title}\n${doc.content}`;
  const cached = cache.get(doc.id);
  if (cached && cached.key === key) return cached.vector;
  const vector = await embed(key);
  cache.set(doc.id, { key, vector });
  return vector;
}

// Drop-in alternative to scoreMatches() with the same signature -- the
// caller (answerEngineSemantic) is otherwise identical to the keyword
// engine, so this is the ONLY variable being compared between the two.
export async function scoreMatchesSemantic<T extends ScorableDoc>(query: string, docs: T[], topK = 4): Promise<ScoredDoc<T>[]> {
  if (docs.length === 0) return [];
  const queryVector = await embed(query);

  const scored: ScoredDoc<T>[] = [];
  for (const doc of docs) {
    const docVector = await embedDoc(doc);
    const score = cosineSimilarity(queryVector, docVector);
    scored.push({ doc, score });
  }

  return scored
    .filter((s) => s.score >= MIN_SIMILARITY)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
