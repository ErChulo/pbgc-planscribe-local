import { describe, expect, it } from "vitest";
import { buildChunkEmbeddings } from "../../src/domain/embeddings/localEmbedder";
import {
  extractStructuredProvisions,
  listExtractionTemplates,
  validateStructuredExtraction,
} from "../../src/domain/extraction/structured";
import type { ChunkRecord } from "../../src/domain/types";

describe("structured extraction", () => {
  it("extracts provision fields with citations and valid schema", () => {
    const chunks: ChunkRecord[] = [
      {
        id: "c1",
        documentId: "doc-a",
        pageStart: 2,
        pageEnd: 2,
        text: "Normal retirement age is sixty five under this plan.",
      },
      {
        id: "c2",
        documentId: "doc-a",
        pageStart: 4,
        pageEnd: 4,
        text: "Early retirement reduction applies for commencement before age sixty five.",
      },
      {
        id: "c3",
        documentId: "doc-a",
        pageStart: 6,
        pageEnd: 6,
        text: "Vesting schedule is graded with full vesting after six years.",
      },
    ];
    const embeddings = buildChunkEmbeddings(chunks);
    const result = extractStructuredProvisions(chunks, embeddings);

    expect(result.extraction.templateId).toBe("core-pension-v1");
    expect(result.extraction.schemaVersion).toBe("1.0");
    expect(result.extraction.fields.normalRetirementAge.citation?.page).toBe(2);
    expect(result.extraction.fields.normalRetirementAge.status).toBe("extracted");
    expect(result.extraction.fields.earlyRetirementReduction.citation?.page).toBe(4);
    expect(result.extraction.fields.earlyRetirementReduction.status).toBe("extracted");
    expect(result.extraction.fields.vestingSchedule.citation?.page).toBe(6);
    expect(result.extraction.fields.vestingSchedule.status).toBe("extracted");
    expect(validateStructuredExtraction(result.extraction)).toEqual([]);
  });

  it("marks fields as insufficient evidence when confidence is too low", () => {
    const chunks: ChunkRecord[] = [];

    const embeddings = buildChunkEmbeddings(chunks);
    const result = extractStructuredProvisions(chunks, embeddings);

    expect(result.extraction.fields.normalRetirementAge.status).toBe("insufficient_evidence");
    expect(result.extraction.fields.normalRetirementAge.value).toBeNull();
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("supports versioned template selection", () => {
    const chunks: ChunkRecord[] = [
      {
        id: "c1",
        documentId: "doc-a",
        pageStart: 2,
        pageEnd: 2,
        text: "Normal retirement date for unreduced retirement benefit is age sixty five.",
      },
    ];
    const embeddings = buildChunkEmbeddings(chunks);
    const templates = listExtractionTemplates();
    const v2 = templates.find((template) => template.id === "core-pension-v2");
    expect(v2).toBeDefined();

    const result = extractStructuredProvisions(chunks, embeddings, {
      templateId: "core-pension-v2",
    });
    expect(result.extraction.templateId).toBe("core-pension-v2");
    expect(result.extraction.schemaVersion).toBe("1.1");
    expect(result.fieldTraces[0]?.query).toContain("normal retirement date");
  });
});
