import { describe, expect, it } from "vitest";
import { createChunks } from "../../src/domain/chunking/chunker";
import { buildChunkEmbeddings } from "../../src/domain/embeddings/localEmbedder";
import { extractStructuredProvisions } from "../../src/domain/extraction/structured";
import { buildIngestionArtifacts } from "../../src/features/ingestion/ingestPdf";

describe("ingestion to structured extraction", () => {
  it("produces JSON-ready structured fields with citations", () => {
    const artifacts = buildIngestionArtifacts({
      documentId: "doc-structured",
      filename: "structured.pdf",
      sha256: "fakehash",
      importedAt: "2026-03-15T00:00:00.000Z",
      extractedPages: [
        { pageNumber: 1, text: "Normal retirement age is sixty five." },
        {
          pageNumber: 2,
          text: "Early retirement reduction applies prior to normal retirement age.",
        },
        {
          pageNumber: 3,
          text: "Vesting schedule is cliff vesting after three years of service.",
        },
      ],
    });

    const chunks = createChunks(
      artifacts.document.id,
      artifacts.pages.map((page) => ({ pageNumber: page.pageNumber, text: page.text })),
      { maxChars: 500, overlapChars: 50 },
    );
    const embeddings = buildChunkEmbeddings(chunks);
    const result = extractStructuredProvisions(chunks, embeddings);

    expect(result.validationErrors).toEqual([]);
    expect(result.extraction.fields.normalRetirementAge.citation?.documentId).toBe("doc-structured");
    expect(result.extraction.fields.earlyRetirementReduction.citation?.page).toBeGreaterThanOrEqual(1);
    expect(result.extraction.fields.vestingSchedule.citation?.page).toBeGreaterThanOrEqual(1);
    expect(JSON.parse(JSON.stringify(result.extraction))).toHaveProperty("fields");
  });
});
