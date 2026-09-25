# Creator branding

Status: resolved
Blocked by: 01

## What to build

A Creator sets the name and branding their Certificates will carry.

## Acceptance criteria

- [x] Settings page: Creator name, accent colour, signer name and title, logo and signature image uploads.
- [x] Uploads go to Silo via `@aws-sdk/client-s3` (`forcePathStyle`), PNG or JPEG only (checked by content, not extension), size limit, under a fresh key each time; never overwritten.
- [x] `GET /files/[key]` streams files from Silo with correct content type and long cache headers; Silo is never exposed.
- [x] Vitest: file type check rejects SVG, WebP and a PNG renamed .txt is accepted by content.
- [x] Playwright: upload a logo, see it served from `/files/…`.

## Conventions (every ticket)

- Read first: `.scratch/quizz-v1/spec.md`, `.scratch/quizz-v1/data-model.md`, `CONTEXT.md` (use its terms in code and UI), `docs/adr/`.
- Vertical: schema, server, UI and tests together. Playwright covers the main path; Vitest covers the domain rules.
- Every string in English and pt-BR (next-intl). Learner-facing content, emails and PDFs use the Assessment Language.
- Events bump their own `stats_day` counters in the same transaction.
- ADR 0006: `await db.transaction(async (tx) => …)`, no SQLite-only SQL.
