// Local, offline text embeddings -- no API key, no external network calls
// at query time. The model itself is downloaded once from Hugging Face's
// public model hub on first use and cached on disk under the OS cache dir
// (via @huggingface/transformers' own cache); after that, everything runs
// entirely on-device (CPU). This is NOT a generative/conversational model
// -- it only turns text into a fixed-length vector of numbers for
// similarity comparison, and never produces free-text output itself.
type Extractor = (text: string, options: { pooling: string; normalize: boolean }) => Promise<{ data: Float32Array }>;

let extractorPromise: Promise<Extractor> | null = null;

function getExtractor(): Promise<Extractor> {
  if (!extractorPromise) {
    extractorPromise = import("@huggingface/transformers").then(({ pipeline }) =>
      pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2") as unknown as Promise<Extractor>
    );
  }
  return extractorPromise;
}

export async function embed(text: string): Promise<Float32Array> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return output.data;
}

// Vectors from embed() are already L2-normalized, so the dot product IS
// the cosine similarity -- no need to divide by magnitudes separately.
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}
