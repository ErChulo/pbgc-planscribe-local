import { describe, expect, it } from "vitest";
import {
  buildWorkspaceBackupEnvelope,
  verifyWorkspaceBackupEnvelope,
  type WorkspaceSnapshot,
} from "../../src/domain/backup/workspaceBackup";

describe("workspace backup envelope", () => {
  function createSnapshot(): WorkspaceSnapshot {
    return {
      snapshotVersion: "1.0",
      generatedAt: "2026-03-15T00:00:00.000Z",
      workspace: {
        id: "w1",
        name: "Workspace A",
        createdAt: "2026-03-15T00:00:00.000Z",
      },
      documents: [
        {
          id: "doc1",
          workspaceId: "w1",
          filename: "doc1.pdf",
          sha256: "sha-doc1",
          importedAt: "2026-03-15T00:00:00.000Z",
          pageCount: 1,
        },
      ],
      pages: [
        {
          id: "p1",
          workspaceId: "w1",
          documentId: "doc1",
          pageNumber: 1,
          text: "text",
          textSource: "pdf_text",
          ocrApplied: false,
        },
      ],
      chunks: [
        {
          id: "c1",
          workspaceId: "w1",
          documentId: "doc1",
          pageStart: 1,
          pageEnd: 1,
          text: "chunk text",
        },
      ],
      embeddings: [
        {
          id: "e1",
          workspaceId: "w1",
          chunkId: "c1",
          documentId: "doc1",
          dimensions: 3,
          model: "local",
          vector: [0.1, 0.2, 0.3],
        },
      ],
      extractionRuns: [
        {
          id: "run1",
          workspaceId: "w1",
          createdAt: "2026-03-15T00:00:00.000Z",
          documentIds: ["doc1"],
          extractionJson: "{}",
          auditJson: "{}",
          validationErrorCount: 0,
          warningCount: 0,
        },
      ],
      fieldReviews: [
        {
          id: "r1",
          workspaceId: "w1",
          extractionRunId: "run1",
          fieldName: "normalRetirementAge",
          action: "approved",
          reviewerNote: "",
          createdAt: "2026-03-15T00:00:00.000Z",
        },
      ],
    };
  }

  it("builds verifiable envelope", async () => {
    const envelope = await buildWorkspaceBackupEnvelope(createSnapshot());
    const verification = await verifyWorkspaceBackupEnvelope(envelope);
    expect(verification.valid).toBe(true);
    expect(envelope.manifest.recordCounts.documents).toBe(1);
    expect(envelope.manifest.recordCounts.fieldReviews).toBe(1);
  });

  it("detects tampering", async () => {
    const envelope = await buildWorkspaceBackupEnvelope(createSnapshot());
    envelope.snapshot.documents[0]!.filename = "tampered.pdf";
    const verification = await verifyWorkspaceBackupEnvelope(envelope);
    expect(verification.valid).toBe(false);
    expect(verification.reason).toContain("hash mismatch");
  });
});
