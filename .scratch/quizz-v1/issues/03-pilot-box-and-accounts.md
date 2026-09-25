# Pilot box and accounts

Type: task
Status: resolved
Blocked by:

## Question

Get the pilot's self-hosted environment ready so later decisions can rely on real facts: which machine or VPS runs it, the domain name, an SMTP sender (Brevo free plan, 300 emails a day), and Google OAuth credentials for Creator sign-in. HITL: the owner does the sign-ups from a checklist; the answer records what exists and where the credentials are kept (never the credentials themselves).

## Answer

Re-scoped by the owner: the pilot runs on **localhost** for now; a remote box, domain and HTTPS are deferred (see the map's Out of scope).

- App URL: `http://localhost:3000`. Docker is available.
- Silo: pgsty/silo container `silo`, S3 API on `localhost:9000` (console 9001), bucket `quizz` exists. The app uses the container's root credentials locally.
- Email: fake. Mailpit as an SMTP sink (`localhost:1025`, UI on 8025); not running yet, the build adds it to compose.
- Google sign-in: fake. Placeholder client ID and secret; the build decides between a mock OAuth server and leaving Google off locally.
- Secrets: `.env` at the repo root (gitignored, mode 600): Better Auth secret and email HMAC secret (generated), Silo credentials, SMTP, Google placeholders, Operator email, daily email cap. Nothing secret is committed.
