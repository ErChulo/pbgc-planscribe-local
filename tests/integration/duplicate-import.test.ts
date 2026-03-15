import { webcrypto } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DocumentRecord } from "../../src/domain/types";
import { DuplicateDocumentError, ingestPdfFile } from "../../src/features/ingestion/ingestPdf";

const extractPdfPagesMock = vi.hoisted(() =>
  vi.fn(async () => [
    {
      pageNumber: 1,
      text: "Normal retirement age is sixty five.",
    },
  ]),
);

vi.mock("../../src/infra/pdf/extract", () => ({
  extractPdfPages: extractPdfPagesMock,
}));

describe("ingestPdfFile duplicate handling", () => {
  beforeEach(() => {
    if (!globalThis.crypto) {
      globalThis.crypto = webcrypto as Crypto;
    }
    extractPdfPagesMock.mockClear();
  });

  it("rejects duplicate documents before extraction and persistence", async () => {
    const existing: DocumentRecord = {
      id: "doc-existing",
      filename: "existing.pdf",
      sha256: "abc",
      importedAt: "2026-03-15T00:00:00.000Z",
      pageCount: 1,
    };

    const db = {
      findDocumentBySha256: vi.fn(async () => existing),
      putDocumentGraph: vi.fn(async () => undefined),
    };

    const file = {
      name: "duplicate.pdf",
      arrayBuffer: async () => new TextEncoder().encode("same-content").buffer,
    } as File;

    await expect(ingestPdfFile(db as never, file)).rejects.toBeInstanceOf(DuplicateDocumentError);
    expect(extractPdfPagesMock).not.toHaveBeenCalled();
    expect(db.putDocumentGraph).not.toHaveBeenCalled();
  });

  it("ingests when no duplicate hash exists", async () => {
    const db = {
      findDocumentBySha256: vi.fn(async () => null),
      putDocumentGraph: vi.fn(async () => undefined),
    };

    const file = {
      name: "new.pdf",
      arrayBuffer: async () => new TextEncoder().encode("new-content").buffer,
    } as File;

    const summary = await ingestPdfFile(db as never, file);

    expect(extractPdfPagesMock).toHaveBeenCalledTimes(1);
    expect(db.findDocumentBySha256).toHaveBeenCalledTimes(1);
    expect(db.putDocumentGraph).toHaveBeenCalledTimes(1);
    expect(summary.document.filename).toBe("new.pdf");
    expect(summary.pageCount).toBe(1);
    expect(summary.chunkCount).toBeGreaterThan(0);
  });
});
