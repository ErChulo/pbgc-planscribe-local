import { describe, expect, it } from "vitest";
import { buildChunkEmbeddings } from "../../src/domain/embeddings/localEmbedder";
import { buildAuditExportPackage } from "../../src/domain/extraction/auditExport";
import { extractStructuredProvisions } from "../../src/domain/extraction/structured";
import type { ChunkRecord, DocumentRecord, PageRecord } from "../../src/domain/types";

describe("audit export package", () => {
  it("builds package with corpus stats and extraction evidence trace", () => {
    const chunks: ChunkRecord[] = [
      {
        id: "c1",
        documentId: "doc-a",
        pageStart: 3,
        pageEnd: 3,
        text: "Normal retirement age is sixty five.",
      },
    ];
    const embeddings = buildChunkEmbeddings(chunks);
    const extractionResult = extractStructuredProvisions(chunks, embeddings);

    const documents: DocumentRecord[] = [
      {
        id: "doc-a",
        filename: "a.pdf",
        sha256: "abc",
        importedAt: "2026-03-15T00:00:00.000Z",
        pageCount: 1,
      },
    ];
    const pages: PageRecord[] = [
      {
        id: "doc-a-page-3",
        documentId: "doc-a",
        pageNumber: 3,
        text: "Normal retirement age is sixty five.",
        textSource: "ocr",
        ocrApplied: true,
      },
    ];

    const pkg = buildAuditExportPackage({
      extractionResult,
      documents,
      pages,
      chunkCount: chunks.length,
      embeddings,
    });

    expect(pkg.packageVersion).toBe("1.0");
    expect(pkg.corpusStats.documentCount).toBe(1);
    expect(pkg.corpusStats.ocrPageCount).toBe(1);
    expect(pkg.evidenceTrace.length).toBe(3);
  });
});
