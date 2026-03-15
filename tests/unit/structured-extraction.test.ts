import { describe, expect, it } from "vitest";
import { buildChunkEmbeddings } from "../../src/domain/embeddings/localEmbedder";
import {
  extractStructuredProvisions,
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

    expect(result.extraction.fields.normalRetirementAge.citation?.page).toBe(2);
    expect(result.extraction.fields.earlyRetirementReduction.citation?.page).toBe(4);
    expect(result.extraction.fields.vestingSchedule.citation?.page).toBe(6);
    expect(validateStructuredExtraction(result.extraction)).toEqual([]);
  });
});
