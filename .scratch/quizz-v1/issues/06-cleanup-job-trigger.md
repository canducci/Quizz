# Daily cleanup trigger

Type: grilling
Status: open
Blocked by: 02, 03

## Question

What runs the daily job that times out abandoned Attempts (and records Certificates crossing Expiry, see `data-model.md`) on a self-hosted box: a scheduler inside the app process, a separate container in the compose file, or the host's cron calling a protected endpoint? What happens if it misses a day?
