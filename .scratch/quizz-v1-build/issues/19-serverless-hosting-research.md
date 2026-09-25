# Can Quizz run on Vercel or Netlify?

Type: research
Status: needs-triage
Blocked by:

## Question

Can the current app be deployed to Vercel or Netlify, as an alternative to the self-hosted Docker box (ADR 0004, 0005)? If so, what would have to change, and what would it cost? A static export (`output: "export"`, GitHub Pages) is ruled out: sign-in, Attempts, Certificates and the Verification Page all need a server.

For each platform, answer:

- **Next.js 16 support:** server actions, route handlers (`/api/auth/[...all]`, `/files/[key]`), `instrumentation.ts`, next-intl and `cookies()`. Server actions currently accept bodies up to 5 MB (`next.config.ts`); does the platform allow that?
- **Database:** local SQLite (`DATABASE_URL=file:...`) doesn't survive on serverless. Is Turso (hosted libsql) a drop-in replacement for `@libsql/client`, and on which free tier? The write queue in `src/db/open.ts` (ticket 17) only covers one process, and serverless runs many. Does Turso's remote protocol make the queue unnecessary, or do overlapping writes still fail?
- **Migrations:** `instrumentation.ts` runs `migrateDatabase` on every cold start. Is that safe with concurrent instances, or should it move to a build or deploy step?
- **Startup checks:** `secretsProblem()` calls `process.exit(1)`, and `ensureBucket()` runs on each cold start. What happens to both on serverless?
- **Hourly sweep:** `startSweep` in `src/server/sweep.ts` is an in-process timer, which won't run on serverless. Compare Vercel Cron and Netlify Scheduled Functions: free-tier frequency, authentication of the endpoint.
- **File storage:** S3 through Silo today. Which S3-compatible store works on the free tier (Cloudflare R2, Backblaze B2, AWS S3), or should it use the platform's blob store (Vercel Blob, Netlify Blobs)? Changing to a platform blob store means a second storage driver; say whether that's worth it.
- **Email:** SMTP through nodemailer. Do outbound SMTP ports work from functions, or is an HTTP email API needed (Resend, Postmark, SES)?
- **Certificate PDF:** react-pdf with fontkit and custom fonts (`src/server/certificate-pdf.tsx`). Does it fit within function size, memory and timeout limits? Measure one real render.
- **Limits and cost:** free-tier and hobby-plan limits (function duration, invocations, bandwidth, commercial-use terms) against a Pilot-sized load. Vercel Hobby forbids commercial use; check whether that applies.
- **Licence and portability:** does any of this conflict with AGPL (ADR 0003) or tie the code to one vendor? The Docker path must keep working.

## Deliverable

- Under `## Answer`: a table per platform (works as-is / works with change X / blocked), a recommendation (Vercel, Netlify or neither), and the smallest list of code changes it needs.
- If the answer is "go", draft the next free ADR as proposed, since it amends ADR 0005. The implementation becomes its own ticket.
- Evidence: docs links, and if possible a throwaway preview deploy of the current `main` to show where it breaks.

## Conventions

- Read first: `.scratch/quizz-v1/spec.md`, `CONTEXT.md`, `docs/adr/` (0004, 0005, 0006 especially).
- Research only: no changes to `main`.
