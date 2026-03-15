import type { ChunkRecord, SearchResult } from "../types";
import { tokenize } from "../text/normalize";

function termFrequency(tokens: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const token of tokens) {
    map.set(token, (map.get(token) ?? 0) + 1);
  }
  return map;
}

function buildSnippet(text: string, terms: string[]): string {
  const lower = text.toLowerCase();
  const firstTerm = terms.find((term) => lower.includes(term));
  if (!firstTerm) {
    return text.slice(0, 220);
  }

  const index = lower.indexOf(firstTerm);
  const start = Math.max(0, index - 80);
  const end = Math.min(text.length, index + 160);
  return text.slice(start, end).trim();
}

export function lexicalSearch(query: string, chunks: ChunkRecord[]): SearchResult[] {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) {
    return [];
  }

  const results: SearchResult[] = [];

  for (const chunk of chunks) {
    const chunkTerms = tokenize(chunk.text);
    const tf = termFrequency(chunkTerms);
    let score = 0;
    for (const queryTerm of queryTerms) {
      score += tf.get(queryTerm) ?? 0;
    }

    if (score > 0) {
      results.push({
        chunkId: chunk.id,
        documentId: chunk.documentId,
        score,
        snippet: buildSnippet(chunk.text, queryTerms),
        citation: {
          documentId: chunk.documentId,
          page: chunk.pageStart,
          chunkId: chunk.id,
        },
      });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 25);
}

