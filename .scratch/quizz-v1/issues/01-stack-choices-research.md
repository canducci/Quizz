# Stack choices inside Next.js

Type: research
Status: resolved
Blocked by:

## Question

Which libraries fill the gaps inside the fixed stack (Next.js, TypeScript, Better Auth, SQLite, Silo over S3, SMTP, one Docker image; ADR 0004 and 0005)? For each, compare two or three options and recommend one, checking licence compatibility with AGPL-3.0 and that it runs in a single Node container:

- ORM and migrations on SQLite, with a later move to Postgres possible (Drizzle vs Prisma; better-sqlite3 vs libsql), and Better Auth's support for it.
- i18n for English and pt-BR UI (next-intl or similar), with content in the Assessment Language.
- Certificate PDF generation that can match the chosen design (A4 landscape, custom serif fonts, QR code, images): react-pdf vs headless Chromium vs pdf-lib.
- Safe Markdown rendering with code blocks and images (sanitising Creator input).
- S3 client for Silo (pgsty/silo, already decided and running locally): what it needs from the client.
- In-process scheduling for the daily cleanup job.
- Tests and CI: unit (Vitest), end-to-end (Playwright), GitHub Actions.

## Answer

- ORM and migrations: Drizzle ORM ~0.45 + drizzle-kit as the only migration history (Better Auth tables via `npx auth generate` into the Drizzle schema). Not Prisma: npm `latest` is 8.0 RC and Better Auth 1.7.6 supports Prisma 5 to 7 only.
- SQLite driver: `@libsql/client` on a local file, not better-sqlite3, because its transactions are async like Postgres's (better-sqlite3's are sync-only). Rule: every transaction is `await db.transaction(async (tx) => …)`, no SQLite-only SQL.
- i18n: next-intl, with `getTranslations({locale})` / `createTranslator` rendering in the Assessment Language.
- Certificate PDF: @react-pdf/renderer + `qrcode`. Use an OFL serif as static TTF (Georgia can't be bundled), PNG/JPEG uploads only, and shrink-to-fit computed in code. No headless Chromium, no pdf-lib (unmaintained since 2021).
- Markdown: react-markdown + remark-gfm + rehype-sanitize, then rehype-highlight. Images only from Quizz's own upload route.
- S3 and Silo: pgsty/silo (decided by owner). `@aws-sdk/client-s3` with `forcePathStyle: true` and an endpoint env var. Serve files through an app route, not presigned URLs, so Silo stays internal.
- Scheduling: no library. An hourly idempotent sweep via `setInterval` in `instrumentation.ts`, run at startup too. Ticket 06 still owns the trigger decision.
- Tests and CI: Vitest 5 + Playwright on GitHub Actions, with Mailpit and pgsty/silo as service containers. Base image `node:24-bookworm-slim`.

Full findings: branch `research/stack-choices`, file `docs/research/stack-choices.md`.
