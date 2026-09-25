# Map: Quizz v1 build plan

Label: wayfinder:map

## Destination

A build-ready plan for Quizz v1: every open question in `spec.md` answered, and v1 split into vertical-slice build tickets (`ready-for-agent`, with acceptance criteria, in dependency order) that AFK agents can pick up one per session. Reached when "Slice v1 into build tickets" is resolved.

## Notes

- Pilot with one or two known Creators; multi-tenant signup stays in the code as the spec says.
- Self-hosted first, including the pilot: one box, `docker compose`, SQLite and Silo (ADR 0005). No managed-platform features. For now the pilot is localhost; secrets live in `.env`.
- Built by AFK agents, reviewed by the owner: each build ticket must fit one agent session and carry clear acceptance criteria.
- Vocabulary from `CONTEXT.md`; decisions in `docs/adr/`; product rules in `spec.md`. Grilling tickets call the "grilling" and "domain-modeling" skills. Chosen screen designs are live at https://canducci.github.io/Quizz/.
- Plan, don't build: nothing in this map writes app code.

## Decisions so far

<!-- one line per resolved ticket: [title](issues/NN-slug.md): gist -->

- [Stack choices inside Next.js](issues/01-stack-choices-research.md): recommends Drizzle on libsql (async transactions, Postgres-portable), next-intl, react-pdf, react-markdown with sanitising, AWS S3 SDK to Silo behind an app route, Vitest and Playwright; findings on branch `research/stack-choices`.
- [Confirm the stack](issues/02-confirm-stack.md): all research picks accepted (Drizzle on libsql per ADR 0006, next-intl, react-pdf with bundled OFL fonts, sanitised Markdown with uploaded images only, files served by the app), npm, ESLint + Prettier, Node 26; CI workflow is manual only.
- [Data model](issues/05-data-model.md): JSON-snapshot Versions with frozen branding, per-day statistics counters, unrotatable email HMAC, 80-bit Certificate IDs, PDFs rendered on demand; sketch in `data-model.md`.
- [Daily cleanup trigger](issues/06-cleanup-job-trigger.md): idempotent in-process hourly sweep started from `instrumentation.ts`; counts on the event's own day; also clears old codes, email counters and expired sessions.
- [Pilot box and accounts](issues/03-pilot-box-and-accounts.md): localhost only for now; local Silo on :9000 with bucket `quizz`, Mailpit for email, fake Google sign-in, secrets in a gitignored `.env`.
- [Product gaps before build](issues/04-product-gaps.md): no invite emails, abuse reports mailto the Operator, CSV columns fixed, one-time code limits and daily email cap, and what a Learner sees when they can't start.

## Not yet specified

- Backups and upgrades for self-hosters: how the SQLite file, the Silo bucket and `EMAIL_HMAC_SECRET` get backed up and restored, and how schema migrations run when a self-hoster upgrades.
- Secrets: where the HMAC secret, SMTP and S3 credentials live and how a self-hoster generates them on first run.
- Operator tools: how the Operator applies a Creator Ban (a CLI, an admin page?) and sets the instance config (Operator email, daily email cap). Reports already arrive by email.

## Out of scope

- The LGPD review: required before a public launch, not for the pilot.
- Managed hosting (Vercel, Neon, Cloud Run): replaced by self-hosting first (ADR 0005).
- A remote pilot environment (VPS, domain, HTTPS, real SMTP and Google OAuth): deferred by the owner; the pilot runs on localhost.
- Writing self-hosting documentation and building the app: they follow this map.
