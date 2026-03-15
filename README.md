# PlanScribe Local

PlanScribe Local is a browser-only application for analyzing pension plan PDFs with citations, structured extraction, review workflow, and signed exports.

## What This App Does

1. Imports PDF files locally in the browser.
2. Extracts page text with OCR fallback when needed.
3. Chunks and embeds text locally for hybrid retrieval.
4. Answers queries with citation-backed evidence.
5. Extracts structured fields with template-driven logic.
6. Supports field review (approve/reject/edit) and audit trail.
7. Exports signed release artifacts and workspace backups.

## Privacy and Security Model

1. No backend API is required for document analysis.
2. Document text stays in browser storage (IndexedDB).
3. Release bundles include SHA-256 signed manifests.
4. Workspace backups include integrity manifest verification on restore.

## Quick Start

### 1) Install and run

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in terminal.

### 2) First end-to-end run (example)

1. Create a workspace named `Pilot`.
2. Import 1-3 plan PDFs.
3. Search: `normal retirement age`.
4. Run `Structured Extraction` using `Core Pension v1`.
5. Review fields and approve/reject/edit.
6. Export `Release Bundle`.
7. Export workspace backup from `Backup & Restore`.

### 3) Production build

```bash
npm run build
npm run preview
```

### 4) Release package

```bash
npm run package:release
```

Output folder:

- `release/planscribe-local-<timestamp>/`

## Operator Guide

## Workspaces

1. Use one workspace per client/project.
2. Switch workspace before importing documents.
3. Workspace scope applies to docs, chunks, embeddings, runs, and reviews.

## Search and QA

1. `Lexical` search is fast and exact-term biased.
2. `Hybrid` search combines lexical + vector similarity.
3. `Grounded QA` answers only from retrieved evidence.

## Structured Extraction

1. Select template (`Core Pension v1` or `Core Pension v2`).
2. Click `Run Extraction`.
3. Inspect validation errors/warnings.
4. Review queue supports `Approve`, `Reject`, `Edit`.

## Release Exports

`Create Release Bundle` exports:

1. Bundle JSON (extraction + audit + reviews).
2. Manifest JSON (SHA-256 checksums).
3. Review CSV.

## Backup and Restore

1. Export backup from active workspace.
2. Import backup with:
   - `Merge`: add/overwrite by IDs.
   - `Replace Workspace Data`: clear workspace-scoped records first.
3. Restore is blocked if backup hash verification fails.

## Documentation and Architecture Visibility

Use docs-as-code commands:

```bash
npm run docs:all
```

Generated outputs:

1. `docs/generated/api/index.html` (TypeDoc API docs)
2. `docs/generated/dependency-graph.md` (auto Mermaid dependency graph)
3. `docs/generated/dependency-graph.json` (machine-readable graph)

Curated architecture docs:

1. `docs/architecture/overview.md`
2. `docs/architecture/processes.md`
3. `docs/architecture/state-machines.md`

## Quality Checks

```bash
npm run lint
npm run test -- --run
npm run build
```

## Examples

## Example A: Extraction QA

1. Query: `vesting schedule`.
2. Open top citation.
3. Run extraction.
4. If `vestingSchedule` is weak, edit and add reviewer note.
5. Export signed release bundle.

## Example B: Recovery Drill

1. Export workspace backup.
2. Clear local data.
3. Import backup with `Replace Workspace Data`.
4. Verify documents/runs/reviews reappear.

## Troubleshooting

1. OCR is slower than direct text extraction on scanned PDFs.
2. If restore fails with integrity error, the backup file is modified/corrupt.
3. If search quality seems low, verify embeddings were generated during import.

## Contributing

1. Create feature branch from `main`.
2. Run quality checks and docs generation.
3. Include `dist/` updates when requested for offline testing.
