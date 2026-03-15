import { describe, expect, it } from "vitest";
import { createChunks } from "../../src/domain/chunking/chunker";
import { buildChunkEmbeddings } from "../../src/domain/embeddings/localEmbedder";
import { buildAuditExportPackage } from "../../src/domain/extraction/auditExport";
import { extractStructuredProvisions } from "../../src/domain/extraction/structured";
import { hybridSearch } from "../../src/domain/retrieval/hybrid";
import { buildIngestionArtifacts } from "../../src/features/ingestion/ingestPdf";

describe("phase6 smoke pipeline", () => {
  it("runs ingestion to retrieval to extraction to audit package", () => {
    const artifacts = buildIngestionArtifacts({
      documentId: "doc-smoke",
      filename: "smoke.pdf",
      sha256: "fakehash",
      importedAt: "2026-03-15T00:00:00.000Z",
      extractedPages: [
        { pageNumber: 1, text: "Normal retirement age is sixty five." },
        { pageNumber: 2, text: "Early retirement reduction applies before age sixty five." },
        { pageNumber: 3, text: "Vesting schedule is graded over six years." },
      ],
    });

    const chunks = createChunks(
      artifacts.document.id,
      artifacts.pages.map((page) => ({ pageNumber: page.pageNumber, text: page.text })),
      { maxChars: 500, overlapChars: 50 },
    );
    const embeddings = buildChunkEmbeddings(chunks);
    const retrieval = hybridSearch("retire", chunks, embeddings);
    const extraction = extractStructuredProvisions(chunks, embeddings);
    const auditPackage = buildAuditExportPackage({
      extractionResult: extraction,
      documents: [artifacts.document],
      pages: artifacts.pages,
      chunkCount: chunks.length,
      embeddings,
    });

    expect(retrieval.length).toBeGreaterThan(0);
    expect(extraction.validationErrors).toEqual([]);
    expect(auditPackage.corpusStats.documentCount).toBe(1);
    expect(auditPackage.extraction.schemaVersion).toBe("1.0");
  });
});
