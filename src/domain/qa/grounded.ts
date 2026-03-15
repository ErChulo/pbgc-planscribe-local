import type { Citation, SearchResult } from "../types";

export interface GroundedAnswer {
  answer: string;
  citations: Citation[];
}

export function answerQuestionGrounded(
  question: string,
  searchResults: SearchResult[],
): GroundedAnswer {
  const topEvidence = searchResults.slice(0, 3);
  if (!question.trim() || topEvidence.length === 0) {
    return {
      answer: "No grounded evidence was found in the local corpus for this question.",
      citations: [],
    };
  }

  const citations = topEvidence.map((result) => result.citation);
  const evidenceSummary = topEvidence
    .map((result, idx) => `Evidence ${idx + 1}: ${result.snippet}`)
    .join(" ");

  return {
    answer: evidenceSummary,
    citations,
  };
}
