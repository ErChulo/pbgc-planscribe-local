import { describe, expect, it } from "vitest";
import { cosineSimilarity, embedTextLocally } from "../../src/domain/embeddings/localEmbedder";

describe("localEmbedder", () => {
  it("creates deterministic vectors and stable similarity scores", () => {
    const first = embedTextLocally("Normal retirement age is sixty five.");
    const second = embedTextLocally("Normal retirement age is sixty five.");
    const related = embedTextLocally("Retirement ages and retiree benefits.");
    const unrelated = embedTextLocally("Vesting schedule includes cliff vesting.");

    expect(first).toEqual(second);
    expect(cosineSimilarity(first, second)).toBeCloseTo(1, 6);
    expect(cosineSimilarity(first, related)).toBeGreaterThan(cosineSimilarity(first, unrelated));
  });
});
