import type { ChunkRecord, EmbeddingRecord } from "../types";
import { normalizeText } from "../text/normalize";

export const LOCAL_EMBEDDING_MODEL = "local-chargram-v1";
export const LOCAL_EMBEDDING_DIMENSIONS = 256;

function hashCharGram(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function l2Normalize(vector: number[]): number[] {
  let sumSquares = 0;
  for (const value of vector) {
    sumSquares += value * value;
  }

  if (sumSquares === 0) {
    return vector;
  }

  const scale = 1 / Math.sqrt(sumSquares);
  return vector.map((value) => value * scale);
}

export function embedTextLocally(text: string, dimensions = LOCAL_EMBEDDING_DIMENSIONS): number[] {
  const normalized = normalizeText(text).toLowerCase();
  const padded = `  ${normalized}  `;
  const vector = new Array<number>(dimensions).fill(0);

  if (padded.length < 3) {
    return vector;
  }

  for (let i = 0; i <= padded.length - 3; i += 1) {
    const gram = padded.slice(i, i + 3);
    const hash = hashCharGram(gram);
    const index = hash % dimensions;
    const sign = (hash & 1) === 0 ? 1 : -1;
    vector[index] += sign;
  }

  return l2Normalize(vector);
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length !== right.length || left.length === 0) {
    return 0;
  }

  let dot = 0;
  for (let i = 0; i < left.length; i += 1) {
    dot += left[i]! * right[i]!;
  }
  return dot;
}

export function buildChunkEmbeddings(
  chunks: ChunkRecord[],
  dimensions = LOCAL_EMBEDDING_DIMENSIONS,
): EmbeddingRecord[] {
  return chunks.map((chunk) => ({
    id: `${chunk.id}-emb-${LOCAL_EMBEDDING_MODEL}`,
    chunkId: chunk.id,
    documentId: chunk.documentId,
    dimensions,
    model: LOCAL_EMBEDDING_MODEL,
    vector: embedTextLocally(chunk.text, dimensions),
  }));
}

export async function buildChunkEmbeddingsIncremental(
  chunks: ChunkRecord[],
  options: {
    dimensions?: number;
    batchSize?: number;
    onProgress?: (progress: { processed: number; total: number }) => void;
  } = {},
): Promise<EmbeddingRecord[]> {
  const dimensions = options.dimensions ?? LOCAL_EMBEDDING_DIMENSIONS;
  const batchSize = Math.max(1, options.batchSize ?? 64);
  const embeddings: EmbeddingRecord[] = [];

  for (let start = 0; start < chunks.length; start += batchSize) {
    const batch = chunks.slice(start, start + batchSize);
    for (const chunk of batch) {
      embeddings.push({
        id: `${chunk.id}-emb-${LOCAL_EMBEDDING_MODEL}`,
        chunkId: chunk.id,
        documentId: chunk.documentId,
        dimensions,
        model: LOCAL_EMBEDDING_MODEL,
        vector: embedTextLocally(chunk.text, dimensions),
      });
    }

    options.onProgress?.({ processed: Math.min(start + batch.length, chunks.length), total: chunks.length });

    if (start + batch.length < chunks.length) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    }
  }

  return embeddings;
}
