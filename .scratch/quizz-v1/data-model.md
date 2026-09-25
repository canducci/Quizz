# Quizz v1 data model (sketch)

Decided in the "Data model" ticket (`issues/05-data-model.md`). Vocabulary follows `CONTEXT.md`. A sketch, not DDL: the build writes the Drizzle schema from it.

## Conventions

- Primary keys: text UUIDv7. Timestamps: UTC milliseconds (Drizzle timestamp mode). A statistics "day" is the UTC day.
- Portable to Postgres (ADR 0005, 0006): no SQLite-only SQL; JSON columns hold whole documents that are read and written together.
- `email_hash` = HMAC-SHA256(`EMAIL_HMAC_SECRET`, trim(lowercase(email))), hex. The secret never rotates (plain emails aren't kept), so it's backed up like the database.
- Files in Silo are written once under a fresh key and never overwritten. The app serves them itself.

## Tables

**Better Auth tables** (user, session, account, verification): Creator sign-in only, generated into the Drizzle schema.

**creator**: id, auth_user_id (null once the account is deleted), name, joined_at, logo_key, accent_colour, signer_name, signer_title, signature_key, banned_at. Deleting an account only clears `auth_user_id`; the row stays because Certificates point at it. A Creator Ban sets `banned_at` and revokes every Certificate.

**assessment**: id, creator_id, status (Draft | Published | Closed), current_version_id, settings (language, access mode, Passing Score, time limit, N, Retake Policy max and cooldown, Expiry), title, created_at. The editable working copy.

**question**: id (stable across Versions), assessment_id, position, type (single | multi | truefalse), text (Markdown), options (JSON: up to 8, each Markdown + correct flag), keep_order, deleted_at. Working copy only.

**assessment_version**: id, assessment_id, number, published_at, snapshot (JSON: settings, Questions with their ids, and the Creator's branding as it was: name, logo_key, accent, signer name, title, signature_key). Immutable.

**invite**: assessment_id, email_hash. Lives on the Assessment, not the Version: it applies at once.

**attempt**: id, assessment_id, version_id, email_hash, started_at, deadline, drawn (JSON: Question ids with their option order), answers (JSON, saved as they go), submitted_at, outcome (in progress | submitted | timed out), score, passed. Deleted by Learner Erasure.

**certificate**: id, public_id (16 Crockford base32 chars, 80 bits, shown as `XXXX-XXXX-XXXX-XXXX`, URL `/c/<public_id>`), version_id, creator_id, email_hash, holder_name, score, issued_at, expires_at (null = never), status (valid | revoked | replaced), status_at, revocation_reason (private to the Creator; "Name correction" for replacements), replaced_by_id (never shown), expiry_counted_at. Validity against Expiry is computed on read. Deleted by Learner Erasure.

**one_time_code**: email_hash, code_hash, purpose, expires_at (10 min), wrong_tries (max 5), created_at, ip. Rate limits (3 per email and 10 per IP per hour) are counted from these rows.

**email_day**: day, sent. The instance-wide daily email cap.

**stats_day**: version_id, day, attempts, timed_out, submitted, passed, certificates_issued, revoked (name corrections excluded), expired, score_histogram (JSON, 1% buckets), time_histogram (JSON, 1-minute buckets), questions (JSON: per Question id, shown and correct). Bumped in the same transaction as the event. Never recomputed, so Learner Erasure never lowers it. Median time is read from the time histogram.

## Rules the schema carries

- Retake Policy: count a Learner's Attempts on the Assessment started after their last Certificate for it expired (Revocation doesn't reset it); cooldown runs from the last Attempt's end or, for a Timed out one, its deadline.
- The hourly sweep times out overdue Attempts and records Certificates that crossed Expiry (sets `expiry_counted_at`, bumps `stats_day.expired`), each exactly once.
- Certificate PDFs are never stored; they're rendered from the Certificate and its Version snapshot for the email and for Download PDF.
- Learner Erasure deletes the Learner's attempt, certificate, invite and one_time_code rows by `email_hash`; nothing about them is in Silo.
