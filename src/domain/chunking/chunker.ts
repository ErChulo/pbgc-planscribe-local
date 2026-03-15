import type { ChunkRecord, ExtractedPage } from "../types";
import { normalizeText } from "../text/normalize";

export interface ChunkOptions {
  maxChars: number;
  overlapChars: number;
}

const DEFAULT_OPTIONS: ChunkOptions = {
  maxChars: 1200,
  overlapChars: 160,
};

export function createChunks(
  documentId: string,
  pages: ExtractedPage[],
  options: Partial<ChunkOptions> = {},
): ChunkRecord[] {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const chunks: ChunkRecord[] = [];

  for (const page of pages) {
    const text = normalizeText(page.text);
    if (!text) {
      continue;
    }

    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + config.maxChars, text.length);
      const slice = text.slice(start, end).trim();
      if (slice) {
        chunks.push({
          id: `${documentId}-p${page.pageNumber}-o${start}`,
          documentId,
          pageStart: page.pageNumber,
          pageEnd: page.pageNumber,
          text: slice,
        });
      }

      if (end === text.length) {
        break;
      }

      start = Math.max(0, end - config.overlapChars);
    }
  }

  return chunks;
}

