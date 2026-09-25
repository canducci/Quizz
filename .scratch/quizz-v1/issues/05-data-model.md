# Data model

Type: grilling
Status: resolved
Blocked by: 02, 04

## Question

What is the v1 schema? In particular: how an Assessment Version is stored (JSON snapshot or versioned rows), how Assessment Statistics are kept as running counters, how keyed email hashes are stored and whether the HMAC secret can rotate, the Certificate ID and URL format (unguessable), and which data lives in Silo. The answer is a schema sketch linked from the spec.

## Answer

Schema sketch: [`data-model.md`](../data-model.md). Decisions:

- Assessment Version: the working copy is editable rows; publishing freezes one JSON snapshot. Questions keep stable ids across Versions.
- Branding (Creator name, logo, accent, signer, signature) is frozen into the snapshot; files in Silo are never overwritten.
- Statistics: one counter row per Version per UTC day, including score and time histograms and per-Question shown/correct; bumped in the event's transaction; the median is read from the time histogram.
- Email hash: HMAC-SHA256 of the trimmed, lowercased email; no key rotation; one-time codes stored hashed.
- Certificate ID: 16 Crockford base32 characters (80 bits), shown in groups of four, URL `/c/<id>`.
- Silo holds only logo, signature and Question images; Certificate PDFs are rendered on demand, never stored.
- Deleting a Creator account only removes the login; the profile stays. A Ban marks it and revokes everything.
- UUIDv7 text keys, UTC millisecond timestamps.
- The invite list lives on the Assessment, not the Version.
- A Certificate has a status (valid, revoked, replaced) with date and private reason; replacement keeps a hidden link to the new one.
- The hourly sweep records each Certificate crossing Expiry once; the Retake count covers Attempts started after the Learner's last Certificate expired.
