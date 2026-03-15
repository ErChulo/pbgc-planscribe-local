# Security and Privacy Hardening

## Runtime Network Policy
- Plan documents and extracted text are processed in-browser only.
- No document text is sent to a backend service.
- OCR and retrieval run locally in the browser.

## Recommended Content Security Policy
Use a restrictive CSP when hosting static artifacts. Start with:

```text
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self';
worker-src 'self' blob:;
connect-src 'self';
object-src 'none';
base-uri 'self';
frame-ancestors 'none';
```

Adjust only as required by your hosting environment.

## Dependency Risk Checks
- Run `npm run check:deps` before releases.
- Review dependency updates in PRs and keep lockfile changes scoped.

## Release Controls
- Release workflow runs only on version tags (`v*`).
- Packaged artifacts include a release manifest with commit hash and timestamp.
- Persisted extraction history and audit exports remain local unless the user explicitly exports them.
