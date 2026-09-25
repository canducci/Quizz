# TypeScript/Next.js, shipped as a portable Docker image

Quizz is a TypeScript Next.js app using Better Auth (magic link + Google), PostgreSQL and email over plain SMTP. It is built as a Docker image so self-hosters can run it with `docker compose` and a Postgres container. For the pilot we host on Vercel Hobby if Vercel confirms the project qualifies as non-commercial, otherwise on Google Cloud Run with the same image. The database is Neon and email goes through Brevo, whose free plan allows 300 emails a day against Resend's 100. We chose this over ASP.NET Core, Django and Supabase for the largest contributor pool and the easiest deploys; Supabase was ruled out because its sign-in stores Learner emails in plain text, contradicting ADR 0002. See `docs/research/tech-stack.md`.

## Consequences

- App code must not use Vercel-only features (Cron, Blob, KV, Edge Config), or the Docker image stops being a real deployment path.
- Attempt timers need no scheduler. Each Attempt stores its deadline; answers are checked against it, and an overdue Attempt is finalized the next time anything reads it. A daily cleanup job only finalizes abandoned Attempts so Assessment Statistics are correct.
- If the official hosted Quizz starts charging, Vercel Hobby no longer qualifies: move to Vercel Pro or to Cloud Run.
