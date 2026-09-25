# Learner PII is hashed; Creators see only aggregate statistics

Learner emails are never stored in plain text. We keep only a keyed hash (HMAC with a server-side secret; a plain hash of a guessable email can be reversed), which is enough to enforce the Retake Policy, match Invite-only Assessments and find a Learner's data for deletion. The plain email exists only long enough to send the one-time code and the Certificate. A Learner's name is entered at submit and stored only if the Attempt passes, on the Certificate, the one place the Learner chooses to make their identity public. Creators never see per-Learner rows; they get aggregate statistics for each Assessment and can revoke a Certificate by its ID or by the Learner's email, which is hashed for the lookup.

## Consequences

- This can't be undone for existing data: hashed emails can't be turned back into addresses, so any future "contact your Learners" feature would have to ask Learners to opt in going forward.
- Statistics are running counters, not recalculated from stored Attempts, so Learner Erasure doesn't rewrite a Creator's history.
- Statistics are shown from the first Attempt, with no minimum group size. For a small Invite-only Assessment this lets a Creator work out an individual's result. That risk is accepted for now.
- Losing or rotating the HMAC secret breaks every lookup by email (retakes, invites, deletion), so the secret must be managed like a database key.
