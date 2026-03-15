import { describe, expect, it } from "vitest";
import { evaluateExtraction, evaluateRetrieval } from "../../src/domain/eval/retrievalEval";
import type { StructuredExtraction } from "../../src/domain/extraction/structured";

describe("evaluation harness", () => {
  it("computes retrieval top-k hit rates", () => {
    const metrics = evaluateRetrieval([
      {
        id: "q1",
        expectedCitation: { documentId: "doc", page: 1, chunkId: "c1" },
        rankedCitations: [
          { documentId: "doc", page: 1, chunkId: "c1" },
          { documentId: "doc", page: 2, chunkId: "c2" },
        ],
      },
      {
        id: "q2",
        expectedCitation: { documentId: "doc", page: 3, chunkId: "c3" },
        rankedCitations: [
          { documentId: "doc", page: 9, chunkId: "x" },
          { documentId: "doc", page: 3, chunkId: "c3" },
        ],
      },
    ]);

    expect(metrics.top1HitRate).toBeCloseTo(0.5, 5);
    expect(metrics.top3HitRate).toBeCloseTo(1, 5);
    expect(metrics.top5HitRate).toBeCloseTo(1, 5);
  });

  it("computes extraction precision and recall", () => {
    const extraction: StructuredExtraction = {
      schemaVersion: "1.0",
      generatedAt: "2026-03-15T00:00:00.000Z",
      fields: {
        normalRetirementAge: {
          value: "Normal retirement age is 65.",
          confidence: 0.8,
          citation: { documentId: "doc", page: 1, chunkId: "c1" },
          status: "extracted",
          normalized: { kind: "age_years", value: 65 },
        },
        earlyRetirementReduction: {
          value: "Early retirement reduction is 5%.",
          confidence: 0.7,
          citation: { documentId: "doc", page: 2, chunkId: "c2" },
          status: "extracted",
          normalized: { kind: "percent", value: 5 },
        },
        vestingSchedule: {
          value: null,
          confidence: 0,
          citation: null,
          status: "insufficient_evidence",
        },
      },
    };

    const metrics = evaluateExtraction(extraction, [
      { field: "normalRetirementAge", expectedValueContains: "65" },
      { field: "earlyRetirementReduction", expectedValueContains: "5%" },
      { field: "vestingSchedule", expectedValueContains: "vesting" },
    ]);

    expect(metrics.precision).toBeCloseTo(1, 5);
    expect(metrics.recall).toBeCloseTo(2 / 3, 5);
  });
});
