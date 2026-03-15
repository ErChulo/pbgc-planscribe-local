import { describe, expect, it } from "vitest";
import { createChunks } from "../../src/domain/chunking/chunker";
import { lexicalSearch } from "../../src/domain/retrieval/lexical";
import { buildIngestionArtifacts } from "../../src/features/ingestion/ingestPdf";

describe("ingestion to lexical search", () => {
  it("creates searchable chunks with citations", () => {
    const artifacts = buildIngestionArtifacts({
      documentId: "doc-abc",
      filename: "sample.pdf",
      sha256: "fakehash",
      importedAt: "2026-03-15T00:00:00.000Z",
      extractedPages: [
        {
          pageNumber: 1,
          text: "Normal retirement age is sixty five.",
        },
        {
          pageNumber: 2,
          text: "Early retirement reduction applies before age sixty five.",
        },
      ],
    });

    const chunks = createChunks(
      artifacts.document.id,
      artifacts.pages.map((page) => ({ pageNumber: page.pageNumber, text: page.text })),
      { maxChars: 500, overlapChars: 50 },
    );
    const results = lexicalSearch("retirement age", chunks);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.citation.documentId).toBe("doc-abc");
    expect(results[0]?.citation.page).toBeGreaterThanOrEqual(1);
  });
});

