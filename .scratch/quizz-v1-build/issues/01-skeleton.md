# Walking skeleton

Status: resolved
Blocked by: 

## What to build

Stand up the app end to end: a Creator can sign in and land on an empty dashboard, and everything the CI workflow calls exists.

## Acceptance criteria

- [x] Next.js (TypeScript) app on Node 26, npm, ESLint + Prettier; `Dockerfile` on `node:26-bookworm-slim`.
- [x] `compose.yml` runs app, pgsty/silo and Mailpit; `compose.ci.yml` overlay for CI. The app reads `.env`; a committed `.env.example` lists every variable.
- [x] The app refuses to start without `EMAIL_HMAC_SECRET` or `BETTER_AUTH_SECRET`, printing the `openssl rand -base64 32` command.
- [x] Drizzle on `@libsql/client` (file DB, WAL mode); drizzle-kit migrations run at boot before serving. Better Auth tables generated into the Drizzle schema.
- [x] Better Auth: magic-link sign-in for Creators (email via SMTP, lands in Mailpit). Google sign-in configured; its button shows only when `GOOGLE_CLIENT_ID` isn't a placeholder. First sign-in creates a `creator` row.
- [x] next-intl with EN and pt-BR, language from a cookie (no URL prefix) and a switcher in the header.
- [x] npm scripts `lint`, `typecheck`, `test` (Vitest), `test:e2e` (Playwright); a manual run of `.github/workflows/ci.yml` passes.
- [x] Playwright: request a magic link, read it from Mailpit's API, sign in, see the empty dashboard; switch to PT and see PT labels.

## Conventions (every ticket)

- Read first: `.scratch/quizz-v1/spec.md`, `.scratch/quizz-v1/data-model.md`, `CONTEXT.md` (use its terms in code and UI), `docs/adr/`.
- Vertical: schema, server, UI and tests together. Playwright covers the main path; Vitest covers the domain rules.
- Every string in English and pt-BR (next-intl). Learner-facing content, emails and PDFs use the Assessment Language.
- Events bump their own `stats_day` counters in the same transaction.
- ADR 0006: `await db.transaction(async (tx) => …)`, no SQLite-only SQL.
