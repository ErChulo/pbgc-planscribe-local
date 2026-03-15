import type {
  ChunkRecord,
  DocumentRecord,
  EmbeddingRecord,
  ExtractionRunRecord,
  FieldReviewRecord,
  PageRecord,
  WorkspaceRecord,
} from "../../domain/types";
import type { WorkspaceSnapshot } from "../../domain/backup/workspaceBackup";

const DB_NAME = "planscribe-local-db";
const DB_VERSION = 5;

const WORKSPACE_STORE = "workspaces";
const DOC_STORE = "documents";
const PAGE_STORE = "pages";
const CHUNK_STORE = "chunks";
const EMBEDDING_STORE = "embeddings";
const EXTRACTION_RUN_STORE = "extraction_runs";
const FIELD_REVIEW_STORE = "field_reviews";

const DEFAULT_WORKSPACE_ID = "default-workspace";
const DEFAULT_WORKSPACE_NAME = "Default Workspace";

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export class PlanScribeDb {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private async getDb(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const openRequest = indexedDB.open(DB_NAME, DB_VERSION);

      openRequest.onupgradeneeded = () => {
        const db = openRequest.result;
        const workspaces = db.objectStoreNames.contains(WORKSPACE_STORE)
          ? openRequest.transaction!.objectStore(WORKSPACE_STORE)
          : db.createObjectStore(WORKSPACE_STORE, { keyPath: "id" });
        if (!workspaces.indexNames.contains("by_name")) {
          workspaces.createIndex("by_name", "name", { unique: false });
        }
        workspaces.put({
          id: DEFAULT_WORKSPACE_ID,
          name: DEFAULT_WORKSPACE_NAME,
          createdAt: new Date().toISOString(),
        } satisfies WorkspaceRecord);

        const docs = db.objectStoreNames.contains(DOC_STORE)
          ? openRequest.transaction!.objectStore(DOC_STORE)
          : db.createObjectStore(DOC_STORE, { keyPath: "id" });
        if (!docs.indexNames.contains("by_filename")) {
          docs.createIndex("by_filename", "filename", { unique: false });
        }
        if (!docs.indexNames.contains("by_sha256")) {
          docs.createIndex("by_sha256", "sha256", { unique: true });
        }
        if (!docs.indexNames.contains("by_workspaceId")) {
          docs.createIndex("by_workspaceId", "workspaceId", { unique: false });
        }

        const pages = db.objectStoreNames.contains(PAGE_STORE)
          ? openRequest.transaction!.objectStore(PAGE_STORE)
          : db.createObjectStore(PAGE_STORE, { keyPath: "id" });
        if (!pages.indexNames.contains("by_documentId")) {
          pages.createIndex("by_documentId", "documentId", { unique: false });
        }
        if (!pages.indexNames.contains("by_document_page")) {
          pages.createIndex("by_document_page", ["documentId", "pageNumber"], {
            unique: true,
          });
        }
        if (!pages.indexNames.contains("by_workspaceId")) {
          pages.createIndex("by_workspaceId", "workspaceId", { unique: false });
        }

        const chunks = db.objectStoreNames.contains(CHUNK_STORE)
          ? openRequest.transaction!.objectStore(CHUNK_STORE)
          : db.createObjectStore(CHUNK_STORE, { keyPath: "id" });
        if (!chunks.indexNames.contains("by_documentId")) {
          chunks.createIndex("by_documentId", "documentId", { unique: false });
        }
        if (!chunks.indexNames.contains("by_workspaceId")) {
          chunks.createIndex("by_workspaceId", "workspaceId", { unique: false });
        }

        const embeddings = db.objectStoreNames.contains(EMBEDDING_STORE)
          ? openRequest.transaction!.objectStore(EMBEDDING_STORE)
          : db.createObjectStore(EMBEDDING_STORE, { keyPath: "id" });
        if (!embeddings.indexNames.contains("by_documentId")) {
          embeddings.createIndex("by_documentId", "documentId", { unique: false });
        }
        if (!embeddings.indexNames.contains("by_chunkId")) {
          embeddings.createIndex("by_chunkId", "chunkId", { unique: true });
        }
        if (!embeddings.indexNames.contains("by_workspaceId")) {
          embeddings.createIndex("by_workspaceId", "workspaceId", { unique: false });
        }

        const extractionRuns = db.objectStoreNames.contains(EXTRACTION_RUN_STORE)
          ? openRequest.transaction!.objectStore(EXTRACTION_RUN_STORE)
          : db.createObjectStore(EXTRACTION_RUN_STORE, { keyPath: "id" });
        if (!extractionRuns.indexNames.contains("by_createdAt")) {
          extractionRuns.createIndex("by_createdAt", "createdAt", { unique: false });
        }
        if (!extractionRuns.indexNames.contains("by_workspaceId")) {
          extractionRuns.createIndex("by_workspaceId", "workspaceId", { unique: false });
        }

        const fieldReviews = db.objectStoreNames.contains(FIELD_REVIEW_STORE)
          ? openRequest.transaction!.objectStore(FIELD_REVIEW_STORE)
          : db.createObjectStore(FIELD_REVIEW_STORE, { keyPath: "id" });
        if (!fieldReviews.indexNames.contains("by_workspaceId")) {
          fieldReviews.createIndex("by_workspaceId", "workspaceId", { unique: false });
        }
        if (!fieldReviews.indexNames.contains("by_extractionRunId")) {
          fieldReviews.createIndex("by_extractionRunId", "extractionRunId", { unique: false });
        }
      };

      openRequest.onsuccess = () => resolve(openRequest.result);
      openRequest.onerror = () => reject(openRequest.error);
    });

    return this.dbPromise;
  }

  async putDocumentGraph(
    document: DocumentRecord,
    pages: PageRecord[],
    chunks: ChunkRecord[],
    embeddings: EmbeddingRecord[] = [],
  ): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction([DOC_STORE, PAGE_STORE, CHUNK_STORE, EMBEDDING_STORE], "readwrite");

    tx.objectStore(DOC_STORE).put(document);
    for (const page of pages) {
      tx.objectStore(PAGE_STORE).put(page);
    }
    for (const chunk of chunks) {
      tx.objectStore(CHUNK_STORE).put(chunk);
    }
    for (const embedding of embeddings) {
      tx.objectStore(EMBEDDING_STORE).put(embedding);
    }

    await transactionDone(tx);
  }

  async listWorkspaces(): Promise<WorkspaceRecord[]> {
    const db = await this.getDb();
    const tx = db.transaction(WORKSPACE_STORE, "readonly");
    const store = tx.objectStore(WORKSPACE_STORE);
    const result = await requestToPromise(store.getAll() as IDBRequest<WorkspaceRecord[]>);
    return result.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async createWorkspace(name: string): Promise<WorkspaceRecord> {
    const workspace: WorkspaceRecord = {
      id: crypto.randomUUID(),
      name: name.trim(),
      createdAt: new Date().toISOString(),
    };

    const db = await this.getDb();
    const tx = db.transaction(WORKSPACE_STORE, "readwrite");
    tx.objectStore(WORKSPACE_STORE).put(workspace);
    await transactionDone(tx);
    return workspace;
  }

  async listDocuments(workspaceId = DEFAULT_WORKSPACE_ID): Promise<DocumentRecord[]> {
    const db = await this.getDb();
    const tx = db.transaction(DOC_STORE, "readonly");
    const index = tx.objectStore(DOC_STORE).index("by_workspaceId");
    const result = await requestToPromise(
      index.getAll(IDBKeyRange.only(workspaceId)) as IDBRequest<DocumentRecord[]>,
    );
    return result.sort((a, b) => b.importedAt.localeCompare(a.importedAt));
  }

  async listChunks(workspaceId = DEFAULT_WORKSPACE_ID): Promise<ChunkRecord[]> {
    const db = await this.getDb();
    const tx = db.transaction(CHUNK_STORE, "readonly");
    const index = tx.objectStore(CHUNK_STORE).index("by_workspaceId");
    return requestToPromise(index.getAll(IDBKeyRange.only(workspaceId)) as IDBRequest<ChunkRecord[]>);
  }

  async listEmbeddings(workspaceId = DEFAULT_WORKSPACE_ID): Promise<EmbeddingRecord[]> {
    const db = await this.getDb();
    const tx = db.transaction(EMBEDDING_STORE, "readonly");
    const index = tx.objectStore(EMBEDDING_STORE).index("by_workspaceId");
    return requestToPromise(
      index.getAll(IDBKeyRange.only(workspaceId)) as IDBRequest<EmbeddingRecord[]>,
    );
  }

  async putExtractionRun(run: ExtractionRunRecord): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(EXTRACTION_RUN_STORE, "readwrite");
    tx.objectStore(EXTRACTION_RUN_STORE).put(run);
    await transactionDone(tx);
  }

  async listExtractionRuns(workspaceId = DEFAULT_WORKSPACE_ID): Promise<ExtractionRunRecord[]> {
    const db = await this.getDb();
    const tx = db.transaction(EXTRACTION_RUN_STORE, "readonly");
    const index = tx.objectStore(EXTRACTION_RUN_STORE).index("by_workspaceId");
    const runs = await requestToPromise(
      index.getAll(IDBKeyRange.only(workspaceId)) as IDBRequest<ExtractionRunRecord[]>,
    );
    return runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async putFieldReview(review: FieldReviewRecord): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(FIELD_REVIEW_STORE, "readwrite");
    tx.objectStore(FIELD_REVIEW_STORE).put(review);
    await transactionDone(tx);
  }

  async listFieldReviewsForRun(extractionRunId: string): Promise<FieldReviewRecord[]> {
    const db = await this.getDb();
    const tx = db.transaction(FIELD_REVIEW_STORE, "readonly");
    const index = tx.objectStore(FIELD_REVIEW_STORE).index("by_extractionRunId");
    const reviews = await requestToPromise(
      index.getAll(IDBKeyRange.only(extractionRunId)) as IDBRequest<FieldReviewRecord[]>,
    );
    return reviews.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listFieldReviews(workspaceId = DEFAULT_WORKSPACE_ID): Promise<FieldReviewRecord[]> {
    const db = await this.getDb();
    const tx = db.transaction(FIELD_REVIEW_STORE, "readonly");
    const index = tx.objectStore(FIELD_REVIEW_STORE).index("by_workspaceId");
    const reviews = await requestToPromise(
      index.getAll(IDBKeyRange.only(workspaceId)) as IDBRequest<FieldReviewRecord[]>,
    );
    return reviews.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findDocumentBySha256(sha256: string): Promise<DocumentRecord | null> {
    const db = await this.getDb();
    const tx = db.transaction(DOC_STORE, "readonly");
    const index = tx.objectStore(DOC_STORE).index("by_sha256");
    const document = await requestToPromise(
      index.get(IDBKeyRange.only(sha256)) as IDBRequest<DocumentRecord | undefined>,
    );
    return document ?? null;
  }

  async listPagesForDocument(documentId: string): Promise<PageRecord[]> {
    const db = await this.getDb();
    const tx = db.transaction(PAGE_STORE, "readonly");
    const index = tx.objectStore(PAGE_STORE).index("by_documentId");
    const pages = await requestToPromise(
      index.getAll(IDBKeyRange.only(documentId)) as IDBRequest<PageRecord[]>,
    );
    return pages.sort((a, b) => a.pageNumber - b.pageNumber);
  }

  async listPages(workspaceId = DEFAULT_WORKSPACE_ID): Promise<PageRecord[]> {
    const db = await this.getDb();
    const tx = db.transaction(PAGE_STORE, "readonly");
    const index = tx.objectStore(PAGE_STORE).index("by_workspaceId");
    return requestToPromise(index.getAll(IDBKeyRange.only(workspaceId)) as IDBRequest<PageRecord[]>);
  }

  async deleteDocument(documentId: string): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction([DOC_STORE, PAGE_STORE, CHUNK_STORE, EMBEDDING_STORE], "readwrite");

    tx.objectStore(DOC_STORE).delete(documentId);

    const deleteByIndex = (
      storeName: string,
      indexName: string,
      value: string,
    ): Promise<void> =>
      new Promise((resolve, reject) => {
        const store = tx.objectStore(storeName);
        const index = store.index(indexName);
        const cursorRequest = index.openCursor(IDBKeyRange.only(value));
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) {
            resolve();
            return;
          }
          cursor.delete();
          cursor.continue();
        };
        cursorRequest.onerror = () => reject(cursorRequest.error);
      });

    await Promise.all([
      deleteByIndex(PAGE_STORE, "by_documentId", documentId),
      deleteByIndex(CHUNK_STORE, "by_documentId", documentId),
      deleteByIndex(EMBEDDING_STORE, "by_documentId", documentId),
    ]);

    await transactionDone(tx);
  }

  private deleteByWorkspaceId(
    tx: IDBTransaction,
    storeName: string,
    workspaceId: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = tx.objectStore(storeName);
      const index = store.index("by_workspaceId");
      const cursorRequest = index.openCursor(IDBKeyRange.only(workspaceId));
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) {
          resolve();
          return;
        }
        cursor.delete();
        cursor.continue();
      };
      cursorRequest.onerror = () => reject(cursorRequest.error);
    });
  }

  async clearWorkspaceData(workspaceId: string): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(
      [DOC_STORE, PAGE_STORE, CHUNK_STORE, EMBEDDING_STORE, EXTRACTION_RUN_STORE, FIELD_REVIEW_STORE],
      "readwrite",
    );
    await Promise.all([
      this.deleteByWorkspaceId(tx, DOC_STORE, workspaceId),
      this.deleteByWorkspaceId(tx, PAGE_STORE, workspaceId),
      this.deleteByWorkspaceId(tx, CHUNK_STORE, workspaceId),
      this.deleteByWorkspaceId(tx, EMBEDDING_STORE, workspaceId),
      this.deleteByWorkspaceId(tx, EXTRACTION_RUN_STORE, workspaceId),
      this.deleteByWorkspaceId(tx, FIELD_REVIEW_STORE, workspaceId),
    ]);
    await transactionDone(tx);
  }

  async importWorkspaceSnapshot(
    snapshot: WorkspaceSnapshot,
    options: { mode?: "merge" | "replace" } = {},
  ): Promise<void> {
    const workspaceId = snapshot.workspace.id;
    const mode = options.mode ?? "merge";
    if (mode === "replace") {
      await this.clearWorkspaceData(workspaceId);
    }

    const db = await this.getDb();
    const tx = db.transaction(
      [
        WORKSPACE_STORE,
        DOC_STORE,
        PAGE_STORE,
        CHUNK_STORE,
        EMBEDDING_STORE,
        EXTRACTION_RUN_STORE,
        FIELD_REVIEW_STORE,
      ],
      "readwrite",
    );

    tx.objectStore(WORKSPACE_STORE).put(snapshot.workspace);
    for (const document of snapshot.documents) {
      tx.objectStore(DOC_STORE).put({ ...document, workspaceId });
    }
    for (const page of snapshot.pages) {
      tx.objectStore(PAGE_STORE).put({ ...page, workspaceId });
    }
    for (const chunk of snapshot.chunks) {
      tx.objectStore(CHUNK_STORE).put({ ...chunk, workspaceId });
    }
    for (const embedding of snapshot.embeddings) {
      tx.objectStore(EMBEDDING_STORE).put({ ...embedding, workspaceId });
    }
    for (const run of snapshot.extractionRuns) {
      tx.objectStore(EXTRACTION_RUN_STORE).put({ ...run, workspaceId });
    }
    for (const review of snapshot.fieldReviews) {
      tx.objectStore(FIELD_REVIEW_STORE).put({ ...review, workspaceId });
    }

    await transactionDone(tx);
  }

  async clearAll(): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(
      [DOC_STORE, PAGE_STORE, CHUNK_STORE, EMBEDDING_STORE, EXTRACTION_RUN_STORE, FIELD_REVIEW_STORE],
      "readwrite",
    );
    tx.objectStore(DOC_STORE).clear();
    tx.objectStore(PAGE_STORE).clear();
    tx.objectStore(CHUNK_STORE).clear();
    tx.objectStore(EMBEDDING_STORE).clear();
    tx.objectStore(EXTRACTION_RUN_STORE).clear();
    tx.objectStore(FIELD_REVIEW_STORE).clear();

    await transactionDone(tx);
  }
}
