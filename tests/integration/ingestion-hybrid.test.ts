import { describe, expect, it } from "vitest";
import { createChunks } from "../../src/domain/chunking/chunker";
import { buildChunkEmbeddings } from "../../src/domain/embeddings/localEmbedder";
import { hybridSearch } from "../../src/domain/retrieval/hybrid";
import { buildIngestionArtifacts } from "../../src/features/ingestion/ingestPdf";

describe("ingestion to hybrid search", () => {
  it("returns cited evidence for partial-term query via local embeddings", () => {
    const artifacts = buildIngestionArtifacts({
      documentId: "doc-embed",
      filename: "sample.pdf",
      sha256: "fakehash",
      importedAt: "2026-03-15T00:00:00.000Z",
      extractedPages: [
        {
          pageNumber: 1,
          text: "Normal retirement age is sixty five.",
        },
      ],
    });

    const chunks = createChunks(
      artifacts.document.id,
      artifacts.pages.map((page) => ({ pageNumber: page.pageNumber, text: page.text })),
      { maxChars: 500, overlapChars: 50 },
    );
    const embeddings = buildChunkEmbeddings(chunks);
    const results = hybridSearch("retire", chunks, embeddings);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.citation.documentId).toBe("doc-embed");
    expect(results[0]?.citation.page).toBe(1);
  });
});
