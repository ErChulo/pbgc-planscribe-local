import { describe, expect, it } from "vitest";
import {
  buildFieldReviewCsv,
  buildSignedReleaseManifest,
  sha256Hex,
  type ReleaseBundlePayload,
} from "../../src/domain/extraction/releaseExport";
import type { FieldReviewRecord } from "../../src/domain/types";

describe("release export", () => {
  it("builds CSV and signed manifest for bundle artifacts", async () => {
    const reviews: FieldReviewRecord[] = [
      {
        id: "r1",
        workspaceId: "w1",
        extractionRunId: "run1",
        fieldName: "normalRetirementAge",
        action: "edited",
        reviewerNote: 'updated to "age 65"',
        editedValue: "age 65",
        createdAt: "2026-03-15T00:00:00.000Z",
      },
    ];
    const bundle: ReleaseBundlePayload = {
      bundleVersion: "1.0",
      generatedAt: "2026-03-15T00:00:00.000Z",
      workspaceId: "w1",
      runId: "run1",
      extraction: { templateId: "core-pension-v1" },
      audit: { packageVersion: "1.0" },
      reviews,
      metadata: {
        validationErrorCount: 0,
        warningCount: 0,
      },
    };

    const csv = buildFieldReviewCsv(reviews);
    expect(csv).toContain("fieldName,action");
    expect(csv).toContain('"updated to ""age 65"""');

    const manifest = await buildSignedReleaseManifest({ bundle, reviewCsv: csv });
    expect(manifest.manifestVersion).toBe("1.0");
    expect(manifest.hashes.bundleSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.hashes.reviewCsvSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.bytes.bundleJson).toBeGreaterThan(10);
    expect(manifest.bytes.reviewCsv).toBeGreaterThan(10);
  });

  it("hashing is deterministic", async () => {
    const left = await sha256Hex("abc");
    const right = await sha256Hex("abc");
    const different = await sha256Hex("abcd");
    expect(left).toBe(right);
    expect(left).not.toBe(different);
  });
});
