import { cosineSimilarity, embedTextLocally } from "../embeddings/localEmbedder";
import type { ChunkRecord, EmbeddingRecord, SearchResult } from "../types";
import { lexicalSearch } from "./lexical";

interface HybridOptions {
  lexicalWeight?: number;
  vectorWeight?: number;
  limit?: number;
}

function buildSnippet(text: string, query: string): string {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) {
    return text.slice(0, 220);
  }

  const idx = lowerText.indexOf(lowerQuery);
  if (idx === -1) {
    return text.slice(0, 220);
  }

  const start = Math.max(0, idx - 80);
  const end = Math.min(text.length, idx + lowerQuery.length + 140);
  return text.slice(start, end).trim();
}

export function hybridSearch(
  query: string,
  chunks: ChunkRecord[],
  embeddings: EmbeddingRecord[],
  options: HybridOptions = {},
): SearchResult[] {
  const lexicalWeight = options.lexicalWeight ?? 0.55;
  const vectorWeight = options.vectorWeight ?? 0.45;
  const limit = options.limit ?? 25;

  if (!query.trim()) {
    return [];
  }

  const chunkById = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const lexical = lexicalSearch(query, chunks);
  const maxLexical = lexical[0]?.score ?? 0;
  const lexicalScoreByChunk = new Map(lexical.map((item) => [item.chunkId, item.score]));

  const queryVector = embedTextLocally(query);
  const vectorScoreByChunk = new Map<string, number>();
  let maxVector = 0;

  for (const embedding of embeddings) {
    const score = Math.max(0, cosineSimilarity(queryVector, embedding.vector));
    vectorScoreByChunk.set(embedding.chunkId, score);
    if (score > maxVector) {
      maxVector = score;
    }
  }

  const candidateChunkIds = new Set<string>([
    ...Array.from(lexicalScoreByChunk.keys()),
    ...Array.from(vectorScoreByChunk.keys()),
  ]);

  const results: SearchResult[] = [];
  for (const chunkId of candidateChunkIds) {
    const chunk = chunkById.get(chunkId);
    if (!chunk) {
      continue;
    }

    const rawLexical = lexicalScoreByChunk.get(chunkId) ?? 0;
    const rawVector = vectorScoreByChunk.get(chunkId) ?? 0;
    const normalizedLexical = maxLexical > 0 ? rawLexical / maxLexical : 0;
    const normalizedVector = maxVector > 0 ? rawVector / maxVector : 0;
    const blended = lexicalWeight * normalizedLexical + vectorWeight * normalizedVector;

    if (blended <= 0) {
      continue;
    }

    results.push({
      chunkId: chunk.id,
      documentId: chunk.documentId,
      score: Number(blended.toFixed(6)),
      lexicalScore: Number(rawLexical.toFixed(6)),
      vectorScore: Number(rawVector.toFixed(6)),
      snippet: buildSnippet(chunk.text, query),
      citation: {
        documentId: chunk.documentId,
        page: chunk.pageStart,
        chunkId: chunk.id,
      },
    });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
