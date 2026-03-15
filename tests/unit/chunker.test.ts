import { describe, expect, it } from "vitest";
import { createChunks } from "../../src/domain/chunking/chunker";

describe("createChunks", () => {
  it("creates deterministic chunk ids with page citations", () => {
    const chunks = createChunks(
      "doc-1",
      [{ pageNumber: 3, text: "Alpha ".repeat(300) }],
      { maxChars: 200, overlapChars: 40 },
    );

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.id).toBe("doc-1-p3-o0");
    expect(chunks[0]?.pageStart).toBe(3);
    expect(chunks[0]?.pageEnd).toBe(3);
  });
});

