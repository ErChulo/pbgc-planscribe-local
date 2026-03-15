# PlanScribe Local

Browser-only private PDF provision analysis for plan documents.

## Privacy Model
- No backend service.
- No remote API for document text.
- PDF content, extracted text, chunks, and search artifacts remain in-browser.
- IndexedDB is used for local persistence.

## MVP Implemented in This Slice
- Multi-file PDF import in the browser.
- Local extraction via PDF.js.
- Chunking into provision-friendly text segments.
- IndexedDB storage for documents, pages, and chunks.
- Local lexical search over chunks.
- Citation display (`documentId`, `page`, `chunkId`).
- Document/page inspector.

## Developer Setup
```bash
npm install
npm run dev
```

## Quality Checks
```bash
npm run lint
npm run test
npm run build
```

## Single HTML Bundle
Build the browser-only distributable as one HTML file:

```bash
npm run build:single
```

Output:
- `dist/index.html` (single-file bundle for in-browser use)

## Notes
- OCR is intentionally out of MVP scope.
- Embeddings, hybrid retrieval, grounded QA, and structured extraction are planned next phases.
