import fs from "fs/promises";
import mammoth from "mammoth";

// pdf-parse has no clean ESM-friendly export; require keeps it simple under CJS.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require("pdf-parse");

export async function extractTextFromFile(filePath: string, mimeType: string): Promise<string> {
  if (mimeType === "application/pdf") {
    const buf = await fs.readFile(filePath);
    const result = await pdfParse(buf);
    return result.text;
  }
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }
  if (mimeType === "text/plain") {
    return fs.readFile(filePath, "utf-8");
  }
  throw new Error(`Unsupported file type: ${mimeType}`);
}

const MAX_CHUNK_WORDS = 90; // safety cap for an unstructured wall of text with no headings

function isHeadingLike(fragment: string): boolean {
  const words = fragment.split(/\s+/).filter(Boolean);
  return words.length > 0 && words.length <= 6 && !/[.!?]$/.test(fragment);
}

// Splits extracted text into knowledge-sized chunks so retrieval can find a
// specific passage instead of matching (or failing to match) against one
// giant blob -- same reasoning as website-content sectioning.
//
// Pairs each short heading-like line with the paragraph that follows it as
// ONE chunk, rather than greedily filling a word-count target. Greedily
// merging by word count let unrelated topics (an overview paragraph, a
// check-in policy, a pet policy) end up sharing one chunk/embedding purely
// because they were all short -- a distinctive word like "pets" could
// still match, but a competing topic like "check-in" got diluted by
// sharing space with the others. Documents with no heading structure fall
// back to one chunk per paragraph, still far more precise than one chunk
// per document.
export function chunkText(text: string): string[] {
  const fragments = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let pendingHeading: string | null = null;

  for (const fragment of fragments) {
    if (isHeadingLike(fragment) && pendingHeading === null) {
      pendingHeading = fragment;
      continue;
    }
    const combined = pendingHeading ? `${pendingHeading}\n\n${fragment}` : fragment;
    pendingHeading = null;

    // Safety net: an unstructured paragraph far longer than a normal
    // section still gets split further, so one runaway block of text
    // doesn't become one giant multi-topic chunk either.
    const words = combined.split(/\s+/);
    if (words.length <= MAX_CHUNK_WORDS) {
      chunks.push(combined);
    } else {
      for (let i = 0; i < words.length; i += MAX_CHUNK_WORDS) {
        chunks.push(words.slice(i, i + MAX_CHUNK_WORDS).join(" "));
      }
    }
  }
  if (pendingHeading) chunks.push(pendingHeading); // rare: a trailing heading with nothing after it

  return chunks.length > 0 ? chunks : text.trim() ? [text.trim().slice(0, 3000)] : [];
}
