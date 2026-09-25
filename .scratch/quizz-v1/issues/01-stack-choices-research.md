# Stack choices inside Next.js

Type: research
Status: open
Blocked by:

## Question

Which libraries fill the gaps inside the fixed stack (Next.js, TypeScript, Better Auth, SQLite, Silo over S3, SMTP, one Docker image; ADR 0004 and 0005)? For each, compare two or three options and recommend one, checking licence compatibility with AGPL-3.0 and that it runs in a single Node container:

- ORM and migrations on SQLite, with a later move to Postgres possible (Drizzle vs Prisma; better-sqlite3 vs libsql), and Better Auth's support for it.
- i18n for English and pt-BR UI (next-intl or similar), with content in the Assessment Language.
- Certificate PDF generation that can match the chosen design (A4 landscape, custom serif fonts, QR code, images): react-pdf vs headless Chromium vs pdf-lib.
- Safe Markdown rendering with code blocks and images (sanitising Creator input).
- S3 client for Silo, and which Silo (eteran/silo vs pgsty/silo) suits a small single-box deployment.
- In-process scheduling for the daily cleanup job.
- Tests and CI: unit (Vitest), end-to-end (Playwright), GitHub Actions.
