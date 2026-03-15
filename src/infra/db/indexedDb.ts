import type {
  ChunkRecord,
  DocumentRecord,
  EmbeddingRecord,
  ExtractionRunRecord,
  PageRecord,
} from "../../domain/types";

const DB_NAME = "planscribe-local-db";
const DB_VERSION = 4;

const DOC_STORE = "documents";
const PAGE_STORE = "pages";
const CHUNK_STORE = "chunks";
const EMBEDDING_STORE = "embeddings";
const EXTRACTION_RUN_STORE = "extraction_runs";

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
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

        const docs = db.objectStoreNames.contains(DOC_STORE)
          ? openRequest.transaction!.objectStore(DOC_STORE)
          : db.createObjectStore(DOC_STORE, { keyPath: "id" });
        if (!docs.indexNames.contains("by_filename")) {
          docs.createIndex("by_filename", "filename", { unique: false });
        }
        if (!docs.indexNames.contains("by_sha256")) {
          docs.createIndex("by_sha256", "sha256", { unique: true });
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

        const chunks = db.objectStoreNames.contains(CHUNK_STORE)
          ? openRequest.transaction!.objectStore(CHUNK_STORE)
          : db.createObjectStore(CHUNK_STORE, { keyPath: "id" });
        if (!chunks.indexNames.contains("by_documentId")) {
          chunks.createIndex("by_documentId", "documentId", { unique: false });
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

        const extractionRuns = db.objectStoreNames.contains(EXTRACTION_RUN_STORE)
          ? openRequest.transaction!.objectStore(EXTRACTION_RUN_STORE)
          : db.createObjectStore(EXTRACTION_RUN_STORE, { keyPath: "id" });
        if (!extractionRuns.indexNames.contains("by_createdAt")) {
          extractionRuns.createIndex("by_createdAt", "createdAt", { unique: false });
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

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async listDocuments(): Promise<DocumentRecord[]> {
    const db = await this.getDb();
    const tx = db.transaction(DOC_STORE, "readonly");
    const store = tx.objectStore(DOC_STORE);
    const result = await requestToPromise(store.getAll() as IDBRequest<DocumentRecord[]>);
    return result.sort((a, b) => b.importedAt.localeCompare(a.importedAt));
  }

  async listChunks(): Promise<ChunkRecord[]> {
    const db = await this.getDb();
    const tx = db.transaction(CHUNK_STORE, "readonly");
    const store = tx.objectStore(CHUNK_STORE);
    return requestToPromise(store.getAll() as IDBRequest<ChunkRecord[]>);
  }

  async listEmbeddings(): Promise<EmbeddingRecord[]> {
    const db = await this.getDb();
    const tx = db.transaction(EMBEDDING_STORE, "readonly");
    const store = tx.objectStore(EMBEDDING_STORE);
    return requestToPromise(store.getAll() as IDBRequest<EmbeddingRecord[]>);
  }

  async putExtractionRun(run: ExtractionRunRecord): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(EXTRACTION_RUN_STORE, "readwrite");
    tx.objectStore(EXTRACTION_RUN_STORE).put(run);

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async listExtractionRuns(): Promise<ExtractionRunRecord[]> {
    const db = await this.getDb();
    const tx = db.transaction(EXTRACTION_RUN_STORE, "readonly");
    const store = tx.objectStore(EXTRACTION_RUN_STORE);
    const runs = await requestToPromise(store.getAll() as IDBRequest<ExtractionRunRecord[]>);
    return runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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

  async listPages(): Promise<PageRecord[]> {
    const db = await this.getDb();
    const tx = db.transaction(PAGE_STORE, "readonly");
    const store = tx.objectStore(PAGE_STORE);
    return requestToPromise(store.getAll() as IDBRequest<PageRecord[]>);
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

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async clearAll(): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(
      [DOC_STORE, PAGE_STORE, CHUNK_STORE, EMBEDDING_STORE, EXTRACTION_RUN_STORE],
      "readwrite",
    );
    tx.objectStore(DOC_STORE).clear();
    tx.objectStore(PAGE_STORE).clear();
    tx.objectStore(CHUNK_STORE).clear();
    tx.objectStore(EMBEDDING_STORE).clear();
    tx.objectStore(EXTRACTION_RUN_STORE).clear();

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
}
