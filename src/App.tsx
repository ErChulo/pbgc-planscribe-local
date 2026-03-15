import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import { lexicalSearch } from "./domain/retrieval/lexical";
import type { ChunkRecord, DocumentRecord, PageRecord, SearchResult } from "./domain/types";
import { DuplicateDocumentError, ingestPdfFile } from "./features/ingestion/ingestPdf";
import { PlanScribeDb } from "./infra/db/indexedDb";

type AsyncState = "idle" | "working";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function App() {
  const db = useMemo(() => new PlanScribeDb(), []);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [chunks, setChunks] = useState<ChunkRecord[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [highlightedPageNumber, setHighlightedPageNumber] = useState<number | null>(null);
  const [pages, setPages] = useState<PageRecord[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [state, setState] = useState<AsyncState>("idle");
  const [statusMessage, setStatusMessage] = useState("Ready");

  const documentById = useMemo(
    () => new Map(documents.map((document) => [document.id, document])),
    [documents],
  );

  const refreshCorpus = useCallback(async () => {
    const [nextDocuments, nextChunks] = await Promise.all([db.listDocuments(), db.listChunks()]);
    setDocuments(nextDocuments);
    setChunks(nextChunks);
  }, [db]);

  useEffect(() => {
    void refreshCorpus();
  }, [refreshCorpus]);

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    setState("working");
    setStatusMessage(`Importing ${files.length} PDF(s)...`);
    let importedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const file of Array.from(files)) {
      try {
        const summary = await ingestPdfFile(db, file);
        importedCount += 1;
        setStatusMessage(
          `Imported ${summary.document.filename} (${summary.pageCount} pages, ${summary.chunkCount} chunks).`,
        );
      } catch (error) {
        if (error instanceof DuplicateDocumentError) {
          skippedCount += 1;
          setStatusMessage(
            `Skipped duplicate: ${file.name} already exists as ${error.existingDocument.filename}.`,
          );
          continue;
        }

        failedCount += 1;
        const detail = error instanceof Error ? error.message : "Unknown import error";
        setStatusMessage(`Import failed for ${file.name}: ${detail}`);
      }
    }

    await refreshCorpus();
    setStatusMessage(
      `Import complete. Imported ${importedCount}, skipped ${skippedCount}, failed ${failedCount}.`,
    );
    setState("idle");
    event.target.value = "";
  }

  async function handleOpenDocument(documentId: string) {
    setSelectedDocumentId(documentId);
    setHighlightedPageNumber(null);
    const nextPages = await db.listPagesForDocument(documentId);
    setPages(nextPages);
  }

  async function handleOpenCitation(result: SearchResult) {
    setSelectedDocumentId(result.citation.documentId);
    setHighlightedPageNumber(result.citation.page);
    const nextPages = await db.listPagesForDocument(result.citation.documentId);
    setPages(nextPages);
    setStatusMessage(
      `Opened citation: doc=${result.citation.documentId} page=${result.citation.page} chunk=${result.citation.chunkId}`,
    );
  }

  async function handleDeleteDocument(documentId: string) {
    setState("working");
    try {
      await db.deleteDocument(documentId);
      if (selectedDocumentId === documentId) {
        setSelectedDocumentId(null);
        setHighlightedPageNumber(null);
        setPages([]);
      }
      await refreshCorpus();
      setStatusMessage("Document deleted from local browser storage.");
    } finally {
      setState("idle");
    }
  }

  async function handleClearAll() {
    const confirmed = window.confirm(
      "Delete all locally stored documents, pages, and chunks from this browser?",
    );
    if (!confirmed) {
      return;
    }

    setState("working");
    try {
      await db.clearAll();
      setSelectedDocumentId(null);
      setHighlightedPageNumber(null);
      setPages([]);
      setResults([]);
      await refreshCorpus();
      setStatusMessage("All local IndexedDB data deleted.");
    } finally {
      setState("idle");
    }
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextResults = lexicalSearch(query, chunks);
    setResults(nextResults);
    setStatusMessage(`Search complete. ${nextResults.length} result(s).`);
  }

  return (
    <div className="app">
      <header>
        <h1>PlanScribe Local</h1>
        <p>Browser-only PDF provision analysis with local storage and citations.</p>
      </header>

      <section className="panel">
        <h2>Import PDFs</h2>
        <p>All ingestion and indexing is performed locally in your browser.</p>
        <input
          type="file"
          accept="application/pdf"
          multiple
          onChange={handleImport}
          disabled={state === "working"}
        />
      </section>

      <section className="panel">
        <h2>Search Chunks</h2>
        <form onSubmit={handleSearchSubmit}>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search plan provisions"
          />
          <button type="submit" disabled={state === "working"}>
            Search
          </button>
        </form>
        <div className="results">
          {results.map((result) => {
            const document = documentById.get(result.documentId);
            return (
              <article key={result.chunkId} className="result">
                <h3>{document?.filename ?? result.documentId}</h3>
                <p>{result.snippet}</p>
                <small>
                  score={result.score} | citation: doc={result.citation.documentId} page=
                  {result.citation.page} chunk={result.citation.chunkId}
                </small>
                <div className="actions">
                  <button
                    onClick={() => void handleOpenCitation(result)}
                    disabled={state === "working"}
                  >
                    Open Citation
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <h2>Documents</h2>
        <div className="panel-actions">
          <button
            className="danger"
            onClick={() => void handleClearAll()}
            disabled={state === "working" || documents.length === 0}
          >
            Delete All Local Data
          </button>
        </div>
        <ul className="documents">
          {documents.map((document) => (
            <li key={document.id}>
              <div>
                <strong>{document.filename}</strong>
                <small>
                  {document.pageCount} pages | imported {formatDate(document.importedAt)}
                </small>
              </div>
              <div className="actions">
                <button onClick={() => void handleOpenDocument(document.id)}>Inspect</button>
                <button
                  className="danger"
                  onClick={() => void handleDeleteDocument(document.id)}
                  disabled={state === "working"}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2>Page Inspector</h2>
        {selectedDocumentId ? (
          <div className="pages">
            {pages.map((page) => (
              <article
                key={page.id}
                className={page.pageNumber === highlightedPageNumber ? "page-highlight" : undefined}
              >
                <h3>Page {page.pageNumber}</h3>
                <p>{page.text.slice(0, 1500) || "(empty)"}</p>
              </article>
            ))}
          </div>
        ) : (
          <p>Select a document to inspect pages.</p>
        )}
      </section>

      <footer>{statusMessage}</footer>
    </div>
  );
}

export default App;
