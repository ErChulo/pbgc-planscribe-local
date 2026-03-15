import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import { buildAuditExportPackage } from "./domain/extraction/auditExport";
import { evaluateExtraction, evaluateRetrieval } from "./domain/eval/retrievalEval";
import {
  buildFieldReviewCsv,
  buildSignedReleaseManifest,
  type ReleaseBundlePayload,
} from "./domain/extraction/releaseExport";
import {
  extractStructuredProvisions,
  listExtractionTemplates,
  type ExtractionTemplateId,
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
  ExtractionRunRecord,
  FieldReviewRecord,
  PageRecord,
  SearchResult,
  WorkspaceRecord,
} from "./domain/types";
import { DuplicateDocumentError, ingestPdfFile } from "./features/ingestion/ingestPdf";
import { PlanScribeDb } from "./infra/db/indexedDb";

type AsyncState = "idle" | "working";
type SearchMode = "lexical" | "hybrid";

interface RuntimeDiagnostics {
  lastImportMs: number;
  lastSearchMs: number;
  lastExtractionMs: number;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function App() {
  const db = useMemo(() => new PlanScribeDb(), []);
  const extractionTemplates = useMemo(() => listExtractionTemplates(), []);
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("default-workspace");
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [templateId, setTemplateId] = useState<ExtractionTemplateId>("core-pension-v1");

  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [chunks, setChunks] = useState<ChunkRecord[]>([]);
  const [embeddings, setEmbeddings] = useState<EmbeddingRecord[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [highlightedPageNumber, setHighlightedPageNumber] = useState<number | null>(null);
  const [allPages, setAllPages] = useState<PageRecord[]>([]);
  const [pages, setPages] = useState<PageRecord[]>([]);

  const [extractionHistory, setExtractionHistory] = useState<ExtractionRunRecord[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [fieldReviews, setFieldReviews] = useState<FieldReviewRecord[]>([]);

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

  const [evalSummary, setEvalSummary] = useState<{
    top1: number;
    top3: number;
    top5: number;
    precision: number;
    recall: number;
  } | null>(null);

  const [diagnostics, setDiagnostics] = useState<RuntimeDiagnostics>({
    lastImportMs: 0,
    lastSearchMs: 0,
    lastExtractionMs: 0,
  });

  const [state, setState] = useState<AsyncState>("idle");
  const [statusMessage, setStatusMessage] = useState("Ready");

  const documentById = useMemo(
    () => new Map(documents.map((document) => [document.id, document])),
    [documents],
  );

  const refreshCorpus = useCallback(async () => {
    const [nextWorkspaces, nextDocuments, nextChunks, nextEmbeddings, nextPages, nextRuns] =
      await Promise.all([
        db.listWorkspaces(),
        db.listDocuments(activeWorkspaceId),
        db.listChunks(activeWorkspaceId),
        db.listEmbeddings(activeWorkspaceId),
        db.listPages(activeWorkspaceId),
        db.listExtractionRuns(activeWorkspaceId),
      ]);

    const nextReviews = nextRuns[0] ? await db.listFieldReviewsForRun(nextRuns[0].id) : [];

    setWorkspaces(nextWorkspaces);
    setDocuments(nextDocuments);
    setChunks(nextChunks);
    setEmbeddings(nextEmbeddings);
    setAllPages(nextPages);
    setExtractionHistory(nextRuns);
    setFieldReviews(nextReviews);
  }, [activeWorkspaceId, db]);

  useEffect(() => {
    void refreshCorpus();
  }, [refreshCorpus]);

  useEffect(() => {
    if (!selectedRunId && extractionHistory[0]) {
      setSelectedRunId(extractionHistory[0].id);
    }
  }, [extractionHistory, selectedRunId]);

  function downloadJson(filename: string, payload: unknown) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function downloadText(filename: string, payload: string, mimeType = "text/plain;charset=utf-8") {
    const blob = new Blob([payload], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleCreateWorkspace() {
    const name = newWorkspaceName.trim();
    if (!name) {
      return;
    }

    const workspace = await db.createWorkspace(name);
    setNewWorkspaceName("");
    setActiveWorkspaceId(workspace.id);
    await refreshCorpus();
    setStatusMessage(`Workspace created: ${workspace.name}`);
  }

  async function handleWorkspaceChange(workspaceId: string) {
    setActiveWorkspaceId(workspaceId);
    setSelectedRunId(null);
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
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    const importStart = performance.now();
    setState("working");
    setStatusMessage(`Importing ${files.length} PDF(s)...`);
    let importedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const file of Array.from(files)) {
      try {
        const summary = await ingestPdfFile(db, file, {
          workspaceId: activeWorkspaceId,
          onProgress: (progressEvent) => {
            if (progressEvent.stage === "ocr_fallback") {
              const percent = Math.round((progressEvent.ocrProgress ?? 0) * 100);
              setStatusMessage(
                `OCR fallback ${percent}% on page ${progressEvent.pageNumber}/${progressEvent.totalPages} for ${file.name}`,
              );
              return;
            }

            if (progressEvent.stage === "embedding") {
              const percent = Math.round((progressEvent.processed / Math.max(progressEvent.total, 1)) * 100);
              setStatusMessage(`Embedding ${percent}% (${progressEvent.processed}/${progressEvent.total}) for ${file.name}`);
              return;
            }

            setStatusMessage(
              `Extracting page ${progressEvent.pageNumber}/${progressEvent.totalPages} for ${file.name}...`,
            );
          },
        });

        importedCount += 1;
        const importedPages = await db.listPagesForDocument(summary.document.id);
        const ocrCount = importedPages.filter((page) => page.ocrApplied).length;
        setStatusMessage(
          `Imported ${summary.document.filename} (${summary.pageCount} pages, ${summary.chunkCount} chunks, OCR pages: ${ocrCount}).`,
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
    const importElapsed = performance.now() - importStart;
    setDiagnostics((previous) => ({ ...previous, lastImportMs: importElapsed }));
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
      "Delete all locally stored documents, pages, chunks, and extraction history from this browser?",
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
      setFieldReviews([]);
      await refreshCorpus();
      setStatusMessage("All local IndexedDB data deleted.");
    } finally {
      setState("idle");
    }
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const start = performance.now();
    const nextResults =
      searchMode === "hybrid"
        ? hybridSearch(query, chunks, embeddings)
        : lexicalSearch(query, chunks);
    const elapsed = performance.now() - start;
    setResults(nextResults);
    setDiagnostics((previous) => ({ ...previous, lastSearchMs: elapsed }));
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

  async function handleRunExtraction() {
    const start = performance.now();
    const extracted = extractStructuredProvisions(chunks, embeddings, { templateId });
    const auditPackage = buildAuditExportPackage({
      extractionResult: extracted,
      documents,
      pages: allPages,
      chunkCount: chunks.length,
      embeddings,
    });

    setExtraction(extracted.extraction);
    setExtractionResult(extracted);
    setExtractionErrors(extracted.validationErrors);
    setExtractionWarnings(extracted.warnings);
    setExtractionJson(JSON.stringify(extracted.extraction, null, 2));

    const runRecord: ExtractionRunRecord = {
      id: crypto.randomUUID(),
      workspaceId: activeWorkspaceId,
      createdAt: new Date().toISOString(),
      documentIds: documents.map((document) => document.id),
      extractionJson: JSON.stringify(extracted.extraction, null, 2),
      auditJson: JSON.stringify(auditPackage, null, 2),
      validationErrorCount: extracted.validationErrors.length,
      warningCount: extracted.warnings.length,
    };
    await db.putExtractionRun(runRecord);
    await refreshCorpus();
    setSelectedRunId(runRecord.id);

    const dedupedEvidence = Array.from(
      new Map(extracted.supportingEvidence.map((evidence) => [evidence.chunkId, evidence])).values(),
    ).slice(0, 25);
    setResults(dedupedEvidence);
    setDiagnostics((previous) => ({ ...previous, lastExtractionMs: performance.now() - start }));

    setStatusMessage(
      `Structured extraction complete. Fields with citations: ${
        Object.values(extracted.extraction.fields).filter((field) => field.citation).length
      }/3. Validation errors: ${extracted.validationErrors.length}. Warnings: ${extracted.warnings.length}. Template: ${extracted.extraction.templateId}.`,
    );
  }

  async function handleSubmitFieldReview(
    extractionRunId: string,
    fieldName: keyof StructuredExtraction["fields"],
    action: "approved" | "rejected" | "edited",
    sourceExtraction: StructuredExtraction,
  ) {
    const reviewerNote = window.prompt("Reviewer note (optional):", "") ?? "";
    const editedValue =
      action === "edited"
        ? (window.prompt("Edited field value:", sourceExtraction.fields[fieldName].value ?? "") ?? "").trim()
        : undefined;

    const review: FieldReviewRecord = {
      id: crypto.randomUUID(),
      workspaceId: activeWorkspaceId,
      extractionRunId,
      fieldName,
      action,
      reviewerNote,
      editedValue,
      createdAt: new Date().toISOString(),
    };
    await db.putFieldReview(review);
    const reviews = await db.listFieldReviewsForRun(extractionRunId);
    setFieldReviews(reviews);
    setStatusMessage(`Review saved for ${fieldName}: ${action}`);
  }

  function handleExportExtractionJson() {
    if (!extractionResult) {
      return;
    }

    downloadJson(
      `planscribe-extraction-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`,
      extractionResult.extraction,
    );

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

    downloadJson(
      `planscribe-audit-package-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`,
      auditPackage,
    );

    setStatusMessage("Audit package exported.");
  }

  async function handleCreateReleaseBundle() {
    const runId = selectedRunId ?? extractionHistory[0]?.id;
    if (!runId) {
      return;
    }
    const selectedRun = extractionHistory.find((run) => run.id === runId);
    if (!selectedRun) {
      return;
    }
    const reviews = await db.listFieldReviewsForRun(selectedRun.id);

    const bundle: ReleaseBundlePayload = {
      bundleVersion: "1.0",
      generatedAt: new Date().toISOString(),
      workspaceId: activeWorkspaceId,
      runId: selectedRun.id,
      extraction: JSON.parse(selectedRun.extractionJson),
      audit: JSON.parse(selectedRun.auditJson),
      reviews,
      metadata: {
        validationErrorCount: selectedRun.validationErrorCount,
        warningCount: selectedRun.warningCount,
      },
    };
    const reviewCsv = buildFieldReviewCsv(reviews);
    const manifest = await buildSignedReleaseManifest({
      bundle,
      reviewCsv,
    });
    const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");

    downloadJson(`planscribe-release-bundle-${stamp}.json`, bundle);
    downloadJson(`planscribe-release-manifest-${stamp}.json`, manifest);
    downloadText(`planscribe-field-reviews-${stamp}.csv`, reviewCsv, "text/csv;charset=utf-8");

    setStatusMessage(`Release bundle exported with signed manifest. SHA256: ${manifest.hashes.bundleSha256}`);
  }

  async function handleSelectExtractionRun(runId: string) {
    setSelectedRunId(runId);
    const reviews = await db.listFieldReviewsForRun(runId);
    setFieldReviews(reviews);
  }

  function handleRunEvalHarness() {
    if (!extraction) {
      return;
    }

    const retrievalMetrics = evaluateRetrieval(
      results.slice(0, 3).map((result) => ({
        id: result.chunkId,
        expectedCitation: result.citation,
        rankedCitations: results.map((candidate) => candidate.citation),
      })),
    );
    const extractionMetrics = evaluateExtraction(extraction, [
      { field: "normalRetirementAge", expectedValueContains: "retirement" },
      { field: "earlyRetirementReduction", expectedValueContains: "retirement" },
      { field: "vestingSchedule", expectedValueContains: "vesting" },
    ]);

    setEvalSummary({
      top1: retrievalMetrics.top1HitRate,
      top3: retrievalMetrics.top3HitRate,
      top5: retrievalMetrics.top5HitRate,
      precision: extractionMetrics.precision,
      recall: extractionMetrics.recall,
    });

    setStatusMessage("Evaluation harness metrics computed.");
  }

  const latestRun = extractionHistory[0] ?? null;
  const selectedRun = extractionHistory.find((run) => run.id === (selectedRunId ?? latestRun?.id)) ?? null;
  const reviewExtraction = useMemo(() => {
    if (extraction) {
      return extraction;
    }
    if (!selectedRun) {
      return null;
    }
    try {
      return JSON.parse(selectedRun.extractionJson) as StructuredExtraction;
    } catch {
      return null;
    }
  }, [extraction, selectedRun]);

  return (
    <div className="app">
      <header>
        <h1>PlanScribe Local</h1>
        <p>Browser-only PDF provision analysis with local storage and citations.</p>
      </header>

      <section className="panel">
        <h2>Workspaces</h2>
        <div className="actions">
          <select value={activeWorkspaceId} onChange={(event) => void handleWorkspaceChange(event.target.value)}>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={newWorkspaceName}
            placeholder="New workspace name"
            onChange={(event) => setNewWorkspaceName(event.target.value)}
          />
          <button onClick={() => void handleCreateWorkspace()}>Create Workspace</button>
        </div>
      </section>

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
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2>Structured Extraction</h2>
        <div className="actions extraction-actions">
          <select value={templateId} onChange={(event) => setTemplateId(event.target.value as ExtractionTemplateId)}>
            {extractionTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} ({template.schemaVersion})
              </option>
            ))}
          </select>
          <button onClick={() => void handleRunExtraction()} disabled={state === "working" || chunks.length === 0}>
            Run Extraction
          </button>
          <button onClick={handleExportExtractionJson} disabled={!extractionResult}>
            Export JSON
          </button>
          <button onClick={handleExportAuditPackage} disabled={!extractionResult}>
            Export Audit Package
          </button>
          <button onClick={handleCreateReleaseBundle} disabled={extractionHistory.length === 0}>
            Create Release Bundle
          </button>
        </div>
        {extractionErrors.length > 0 ? (
          <p>Validation errors: {extractionErrors.join(" | ")}</p>
        ) : (
          <p>Validation errors: none</p>
        )}
        {extractionWarnings.length > 0 ? (
          <p>Warnings: {extractionWarnings.join(" | ")}</p>
        ) : (
          <p>Warnings: none</p>
        )}
        <pre className="json-output">{extractionJson || "{ }"}</pre>
      </section>

      <section className="panel">
        <h2>Review Queue</h2>
        {!selectedRun || !reviewExtraction ? (
          <p>Run an extraction to review fields.</p>
        ) : (
          <div className="extraction-grid">
            {(Object.keys(reviewExtraction.fields) as Array<keyof StructuredExtraction["fields"]>).map((fieldName) => (
              <article key={fieldName} className="result">
                <h3>{fieldName}</h3>
                <p>{reviewExtraction.fields[fieldName].value ?? "(not found)"}</p>
                <div className="actions">
                  <button onClick={() => void handleSubmitFieldReview(selectedRun.id, fieldName, "approved", reviewExtraction)}>Approve</button>
                  <button onClick={() => void handleSubmitFieldReview(selectedRun.id, fieldName, "rejected", reviewExtraction)}>Reject</button>
                  <button onClick={() => void handleSubmitFieldReview(selectedRun.id, fieldName, "edited", reviewExtraction)}>Edit</button>
                </div>
              </article>
            ))}
          </div>
        )}
        <h3>Recent Reviews</h3>
        {fieldReviews.length === 0 ? (
          <p>No reviews yet.</p>
        ) : (
          <ul className="history-list">
            {fieldReviews.map((review) => (
              <li key={review.id}>
                <small>{formatDate(review.createdAt)} | {review.fieldName} | {review.action}</small>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>Extraction History</h2>
        {extractionHistory.length === 0 ? (
          <p>No extraction runs saved yet.</p>
        ) : (
          <ul className="history-list">
            {extractionHistory.map((run) => (
              <li key={run.id}>
                <small>{formatDate(run.createdAt)} | errors={run.validationErrorCount} | warnings={run.warningCount}</small>
                <div className="actions">
                  <button onClick={() => void handleSelectExtractionRun(run.id)}>Review This Run</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>Diagnostics</h2>
        <div className="actions">
          <button onClick={handleRunEvalHarness} disabled={!extraction || results.length === 0}>Run Eval Harness</button>
        </div>
        <p>
          importMs={diagnostics.lastImportMs.toFixed(1)} | searchMs={diagnostics.lastSearchMs.toFixed(1)} |
          extractionMs={diagnostics.lastExtractionMs.toFixed(1)}
        </p>
        <p>
          docs={documents.length} pages={allPages.length} ocrPages={allPages.filter((page) => page.ocrApplied).length} chunks={chunks.length} embeddings={embeddings.length}
        </p>
        {evalSummary ? (
          <p>
            top1={evalSummary.top1.toFixed(2)} top3={evalSummary.top3.toFixed(2)} top5={evalSummary.top5.toFixed(2)} precision={evalSummary.precision.toFixed(2)} recall={evalSummary.recall.toFixed(2)}
          </p>
        ) : (
          <p>Run eval harness to compute retrieval/extraction metrics.</p>
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
