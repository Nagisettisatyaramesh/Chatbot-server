import fs from "fs/promises";
import mammoth from "mammoth";

// pdf-parse has no types-friendly ESM export; require keeps it simple under CJS.
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

// Splits extracted text into knowledge-sized chunks so retrieval can find
// specific passages instead of matching against one giant blob.
export function chunkText(text: string, maxWords = 220): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";
  let currentWords = 0;

  for (const p of paragraphs) {
    const words = p.split(/\s+/).length;
    if (currentWords + words > maxWords && current) {
      chunks.push(current.trim());
      current = "";
      currentWords = 0;
    }
    current += (current ? "\n\n" : "") + p;
    currentWords += words;
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks.length > 0 ? chunks : text.trim() ? [text.trim().slice(0, 4000)] : [];
}
