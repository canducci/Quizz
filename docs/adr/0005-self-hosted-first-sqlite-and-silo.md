# Self-hosted first: SQLite and Silo instead of Postgres and managed hosting

v1 is built for self-hosting first, and the pilot runs self-hosted too. The app keeps its data in SQLite instead of PostgreSQL, and keeps files (the Creator's logo and signature, images in Questions) in Silo (pgsty/silo, a maintained MinIO fork), a self-hosted S3-compatible object store, reached over the S3 API. This replaces the database and pilot hosting parts of ADR 0004 (Neon; Vercel Hobby or Cloud Run). Next.js, Better Auth, SMTP email and the Docker image stay. We chose it because a single box running `docker compose` with no external database is the simplest thing for self-hosters, and for the pilot.

## Consequences

- SQLite means one app instance writing to one file. Scaling out would mean moving to Postgres, so data access should stay behind the ORM with no SQLite-only SQL.
- The SQLite file and the Silo bucket together are the whole state, so backups have to cover both. Losing the HMAC secret still breaks every lookup by email (ADR 0002).
- With no managed platform, the daily cleanup job is triggered from inside the deployment.
- The app only speaks the S3 API, so any S3-compatible store (R2, MinIO, AWS S3) works in place of Silo.
