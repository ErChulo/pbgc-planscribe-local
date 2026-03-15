import { describe, expect, it } from "vitest";
import { buildChunkEmbeddings } from "../../src/domain/embeddings/localEmbedder";
import { hybridSearch } from "../../src/domain/retrieval/hybrid";
import type { ChunkRecord } from "../../src/domain/types";

const chunks: ChunkRecord[] = [
  {
    id: "a",
    documentId: "doc-1",
    pageStart: 1,
    pageEnd: 1,
    text: "normal retirement age is sixty five under this plan",
  },
  {
    id: "b",
    documentId: "doc-2",
    pageStart: 2,
    pageEnd: 2,
    text: "zzzz qqqq xxxxx yyyyy random symbols",
  },
];

describe("hybridSearch", () => {
  it("retrieves semantically related chunks when lexical match is weak", () => {
    const embeddings = buildChunkEmbeddings(chunks);
    const results = hybridSearch("retire", chunks, embeddings);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.chunkId).toBe("a");
    expect(results[0]?.vectorScore).toBeGreaterThan(0);
  });
});
