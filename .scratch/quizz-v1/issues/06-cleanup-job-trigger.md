# Daily cleanup trigger

Type: grilling
Status: resolved
Blocked by: 02, 03

## Question

What runs the daily job that times out abandoned Attempts (and records Certificates crossing Expiry, see `data-model.md`) on a self-hosted box: a scheduler inside the app process, a separate container in the compose file, or the host's cron calling a protected endpoint? What happens if it misses a day?

## Answer

- **Trigger**: an in-process hourly sweep. `instrumentation.ts` (Node runtime only) runs it once at boot, not awaited, then every hour with `setInterval(...).unref()`; a `globalThis` flag prevents a second loop on dev hot reload. No endpoint, no host cron: SQLite already means one app instance (ADR 0005).
- **Missed runs**: every step is idempotent ("mark if not already marked", in a transaction), so downtime catches up on the next boot. Reads still time out overdue Attempts on sight; the sweep only matters for abandoned ones.
- **Attribution**: a Timed out Attempt counts on its deadline's day; an expired Certificate on its `expires_at` day. Never the day the sweep ran, so statistics don't depend on when it catches up.
- **Housekeeping in the same sweep**: delete one-time codes older than a day, `email_day` rows older than a week, and expired Better Auth sessions and verification tokens.
