# Quizz

Assessments and verifiable Certificates for Creators. AGPL-3.0.

## Run it

```sh
cp .env.example .env    # then set BETTER_AUTH_SECRET, EMAIL_HMAC_SECRET (openssl rand -base64 32)
                        # and the Silo credentials S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY
docker compose up -d --build --wait
```

The app is on http://localhost:3000 and sign-in emails land in Mailpit at http://localhost:8025.

Data lives in a SQLite file on the `app-data` volume. To use Postgres instead, set `POSTGRES_PASSWORD` in `.env` and add its compose file:

```sh
docker compose -f compose.yml -f compose.postgres.yml up -d --build --wait
```

Back up the database (the SQLite file, or `pg_dump`) together with the Silo bucket: together they are the whole state.

Exposing it beyond localhost? Put it behind a reverse proxy that overwrites `X-Forwarded-For`. Learner one-time codes are limited per IP from that header, and Next passes a client-sent one through, so without the proxy that limit (and the daily email cap it protects) can be dodged.

## Operate

A Creator Ban revokes every Certificate the Creator issued, closes their Assessments and blocks their sign-in:

```sh
docker compose exec app npm run operator -- ban <creator email>
```

Running it twice changes nothing more. A Creator who already deleted their account can't be banned: their email is gone.

## Develop

```sh
npm install
docker compose up -d mailpit   # SMTP for magic links
npm run dev
```

`npm run lint`, `npm run typecheck`, `npm test` (Vitest) and `npm run test:e2e` (Playwright, against the running compose stack). `npm test` runs on SQLite; with `DATABASE_URL=postgres://…` it runs on Postgres, one fresh database per test on that server.

Schema changes: edit both `src/db/schema.sqlite.ts` and its twin `src/db/schema.pg.ts` (a test fails if they drift), then `npm run db:generate` for both migration folders; migrations run at boot.
