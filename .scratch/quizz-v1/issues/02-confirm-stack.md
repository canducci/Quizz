# Confirm the stack

Type: grilling
Status: resolved
Blocked by: 01

## Question

Given the research in "Stack choices inside Next.js", which libraries does v1 use for ORM and migrations, i18n, PDF, Markdown, S3, scheduling and tests? Does the PDF choice need a prototype of the chosen Certificate design before it's trusted?

## Answer

All of the research recommendations are accepted (findings: branch `research/stack-choices`, `docs/research/stack-choices.md`), with Node 26 from the start.

- **Database layer**: Drizzle ORM `~0.45` on `@libsql/client` (local file), drizzle-kit as the only migration history, Better Auth tables generated into the Drizzle schema. Rules: no SQLite-only SQL; every transaction is `await db.transaction(async (tx) => …)`. Recorded as ADR 0006.
- **Interface language**: next-intl, language taken from a cookie or the Creator's setting, no locale prefix in URLs. PDFs, emails and Attempt pages render in the Assessment Language.
- **Certificate PDF**: @react-pdf/renderer + `qrcode`, with Source Serif 4 and Source Sans 3 (OFL, static TTF) bundled. No separate prototype; the Certificate build ticket must match the showcase's Certificate tab side by side, including long names.
- **Markdown**: react-markdown + remark-gfm + rehype-sanitize, then rehype-highlight. The same component renders the editor preview and the Attempt. Images only from Quizz's own upload route.
- **Files**: `@aws-sdk/client-s3` to Silo with `forcePathStyle`; every file is served through an app route (`/files/…`), Silo is never exposed. Uploads are PNG or JPEG only.
- **Scheduling**: no library; the mechanism is for "Daily cleanup trigger" to settle.
- **Tests and CI**: Vitest for domain logic; Playwright end-to-end against `docker compose` (app, Silo, Mailpit); GitHub Actions workflow `.github/workflows/ci.yml` created with **manual runs only** (`workflow_dispatch`), which can't pass until the first build slice adds the npm scripts and compose files it calls.
- **Tooling**: npm, ESLint + Prettier, base image `node:26-bookworm-slim`, Node 26 in CI.
