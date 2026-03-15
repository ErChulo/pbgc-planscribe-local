import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import { buildAuditExportPackage } from "./domain/extraction/auditExport";
import {
  extractStructuredProvisions,
  type StructuredExtraction,
  type StructuredExtractionResult,
} from "./domain/extraction/structured";
import { answerQuestionGrounded, type GroundedAnswer } from "./domain/qa/grounded";
import { hybridSearch } from "./domain/retrieval/hybrid";
import { lexicalSearch } from "./domain/retrieval/lexical";
import type {
  Citation,
  ChunkRecord,
  DocumentRecord,
  EmbeddingRecord,
  PageRecord,
  SearchResult,
} from "./domain/types";
import { DuplicateDocumentError, ingestPdfFile } from "./features/ingestion/ingestPdf";
import { PlanScribeDb } from "./infra/db/indexedDb";

type AsyncState = "idle" | "working";
type SearchMode = "lexical" | "hybrid";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function App() {
  const db = useMemo(() => new PlanScribeDb(), []);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [chunks, setChunks] = useState<ChunkRecord[]>([]);
  const [embeddings, setEmbeddings] = useState<EmbeddingRecord[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [highlightedPageNumber, setHighlightedPageNumber] = useState<number | null>(null);
  const [allPages, setAllPages] = useState<PageRecord[]>([]);
  const [pages, setPages] = useState<PageRecord[]>([]);
  const [query, setQuery] = useState("");
  const [question, setQuestion] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("hybrid");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [answer, setAnswer] = useState<GroundedAnswer | null>(null);
  const [extraction, setExtraction] = useState<StructuredExtraction | null>(null);
  const [extractionResult, setExtractionResult] = useState<StructuredExtractionResult | null>(null);
  const [extractionErrors, setExtractionErrors] = useState<string[]>([]);
  const [extractionWarnings, setExtractionWarnings] = useState<string[]>([]);
  const [extractionJson, setExtractionJson] = useState("");
  const [state, setState] = useState<AsyncState>("idle");
  const [statusMessage, setStatusMessage] = useState("Ready");

  const documentById = useMemo(
    () => new Map(documents.map((document) => [document.id, document])),
    [documents],
  );

  const refreshCorpus = useCallback(async () => {
    const [nextDocuments, nextChunks, nextEmbeddings, nextPages] = await Promise.all([
      db.listDocuments(),
      db.listChunks(),
      db.listEmbeddings(),
      db.listPages(),
    ]);
    setDocuments(nextDocuments);
    setChunks(nextChunks);
    setEmbeddings(nextEmbeddings);
    setAllPages(nextPages);
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
    await handleOpenCitationByRef(result.citation);
    setStatusMessage(
      `Opened citation: doc=${result.citation.documentId} page=${result.citation.page} chunk=${result.citation.chunkId}`,
    );
  }

  async function handleOpenCitationByRef(citation: Citation) {
    setSelectedDocumentId(citation.documentId);
    setHighlightedPageNumber(citation.page);
    const nextPages = await db.listPagesForDocument(citation.documentId);
    setPages(nextPages);
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
      setAnswer(null);
      setExtraction(null);
      setExtractionResult(null);
      setExtractionErrors([]);
      setExtractionWarnings([]);
      setExtractionJson("");
      await refreshCorpus();
      setStatusMessage("All local IndexedDB data deleted.");
    } finally {
      setState("idle");
    }
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextResults =
      searchMode === "hybrid"
        ? hybridSearch(query, chunks, embeddings)
        : lexicalSearch(query, chunks);
    setResults(nextResults);
    setAnswer(null);
    setStatusMessage(
      `${searchMode} search complete. ${nextResults.length} result(s). Embeddings loaded: ${embeddings.length}.`,
    );
  }

  function handleQuestionSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const evidence = hybridSearch(question, chunks, embeddings);
    const grounded = answerQuestionGrounded(question, evidence);
    setAnswer(grounded);
    setResults(evidence);
    setStatusMessage(
      `Grounded QA complete. Evidence chunks: ${evidence.length}. Citations returned: ${grounded.citations.length}.`,
    );
  }

  function handleRunExtraction() {
    const extractionResult = extractStructuredProvisions(chunks, embeddings);
    setExtraction(extractionResult.extraction);
    setExtractionResult(extractionResult);
    setExtractionErrors(extractionResult.validationErrors);
    setExtractionWarnings(extractionResult.warnings);
    setExtractionJson(JSON.stringify(extractionResult.extraction, null, 2));

    const dedupedEvidence = Array.from(
      new Map(extractionResult.supportingEvidence.map((evidence) => [evidence.chunkId, evidence])).values(),
    ).slice(0, 25);
    setResults(dedupedEvidence);

    setStatusMessage(
      `Structured extraction complete. Fields with citations: ${
        Object.values(extractionResult.extraction.fields).filter((field) => field.citation).length
      }/3. Validation errors: ${extractionResult.validationErrors.length}. Warnings: ${extractionResult.warnings.length}.`,
    );
  }

  function handleExportExtractionJson() {
    if (!extraction) {
      return;
    }

    const payload = JSON.stringify(extraction, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `planscribe-extraction-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
    anchor.click();
    URL.revokeObjectURL(url);

    setStatusMessage("Extraction JSON exported.");
  }

  function handleExportAuditPackage() {
    if (!extractionResult) {
      return;
    }

    const auditPackage = buildAuditExportPackage({
      extractionResult,
      documents,
      pages: allPages,
      chunkCount: chunks.length,
      embeddings,
    });

    const payload = JSON.stringify(auditPackage, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `planscribe-audit-package-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
    anchor.click();
    URL.revokeObjectURL(url);

    setStatusMessage("Audit package exported.");
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
          <select
            value={searchMode}
            onChange={(event) => setSearchMode(event.target.value as SearchMode)}
          >
            <option value="hybrid">Hybrid</option>
            <option value="lexical">Lexical</option>
          </select>
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
                  score={result.score.toFixed(4)} | lexical={result.lexicalScore ?? 0} | vector=
                  {result.vectorScore ?? 0} | citation: doc={result.citation.documentId} page=
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
        <h2>Grounded QA</h2>
        <p>Answer generation is constrained to locally retrieved evidence chunks.</p>
        <form onSubmit={handleQuestionSubmit}>
          <input
            type="search"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask a question about plan provisions"
          />
          <button type="submit" disabled={state === "working"}>
            Answer
          </button>
        </form>
        {answer ? (
          <div className="qa-result">
            <p>{answer.answer}</p>
            <small>
              {answer.citations.map((citation) => `doc=${citation.documentId} p${citation.page}`).join(" | ") ||
                "No citations"}
            </small>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2>Structured Extraction</h2>
        <p>Extract key provision fields as JSON with explicit citations and schema validation.</p>
        <div className="actions extraction-actions">
          <button onClick={handleRunExtraction} disabled={state === "working" || chunks.length === 0}>
            Run Extraction
          </button>
          <button onClick={handleExportExtractionJson} disabled={!extraction}>
            Export JSON
          </button>
          <button onClick={handleExportAuditPackage} disabled={!extractionResult}>
            Export Audit Package
          </button>
        </div>
        {extraction ? (
          <div className="extraction-grid">
            <article className="result">
              <h3>normalRetirementAge</h3>
              <p>{extraction.fields.normalRetirementAge.value ?? "(not found)"}</p>
              <small>
                confidence={extraction.fields.normalRetirementAge.confidence}{" "}
                {extraction.fields.normalRetirementAge.citation
                  ? `| doc=${extraction.fields.normalRetirementAge.citation.documentId} page=${extraction.fields.normalRetirementAge.citation.page}`
                  : "| no citation"}
              </small>
              {extraction.fields.normalRetirementAge.citation ? (
                <div className="actions">
                  <button
                    onClick={() =>
                      void handleOpenCitationByRef(extraction.fields.normalRetirementAge.citation as Citation)
                    }
                  >
                    Open Citation
                  </button>
                </div>
              ) : null}
            </article>
            <article className="result">
              <h3>earlyRetirementReduction</h3>
              <p>{extraction.fields.earlyRetirementReduction.value ?? "(not found)"}</p>
              <small>
                confidence={extraction.fields.earlyRetirementReduction.confidence}{" "}
                {extraction.fields.earlyRetirementReduction.citation
                  ? `| doc=${extraction.fields.earlyRetirementReduction.citation.documentId} page=${extraction.fields.earlyRetirementReduction.citation.page}`
                  : "| no citation"}
              </small>
              {extraction.fields.earlyRetirementReduction.citation ? (
                <div className="actions">
                  <button
                    onClick={() =>
                      void handleOpenCitationByRef(extraction.fields.earlyRetirementReduction.citation as Citation)
                    }
                  >
                    Open Citation
                  </button>
                </div>
              ) : null}
            </article>
            <article className="result">
              <h3>vestingSchedule</h3>
              <p>{extraction.fields.vestingSchedule.value ?? "(not found)"}</p>
              <small>
                confidence={extraction.fields.vestingSchedule.confidence}{" "}
                {extraction.fields.vestingSchedule.citation
                  ? `| doc=${extraction.fields.vestingSchedule.citation.documentId} page=${extraction.fields.vestingSchedule.citation.page}`
                  : "| no citation"}
              </small>
              {extraction.fields.vestingSchedule.citation ? (
                <div className="actions">
                  <button
                    onClick={() =>
                      void handleOpenCitationByRef(extraction.fields.vestingSchedule.citation as Citation)
                    }
                  >
                    Open Citation
                  </button>
                </div>
              ) : null}
            </article>
          </div>
        ) : null}

        <h3>JSON Output</h3>
        <pre className="json-output">{extractionJson || "{ }"}</pre>

        <h3>Validation</h3>
        {extractionErrors.length > 0 ? (
          <ul className="errors">
            {extractionErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : (
          <p>No validation errors.</p>
        )}

        <h3>Warnings</h3>
        {extractionWarnings.length > 0 ? (
          <ul className="warnings">
            {extractionWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : (
          <p>No extraction warnings.</p>
        )}
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
                <small>
                  source={page.textSource ?? "pdf_text"} | ocrApplied={page.ocrApplied ? "yes" : "no"}
                </small>
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
