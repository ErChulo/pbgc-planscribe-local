import { describe, expect, it } from "vitest";
import { lexicalSearch } from "../../src/domain/retrieval/lexical";
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
    text: "vesting schedule includes cliff vesting at three years",
  },
];

describe("lexicalSearch", () => {
  it("returns highest scoring chunk first", () => {
    const results = lexicalSearch("retirement age", chunks);
    expect(results[0]?.chunkId).toBe("a");
    expect(results[0]?.citation.page).toBe(1);
  });
});

