# Quizz

Assessments and verifiable Certificates for Creators. AGPL-3.0.

## Run it

```sh
cp .env.example .env    # then set BETTER_AUTH_SECRET, EMAIL_HMAC_SECRET (openssl rand -base64 32)
                        # and the Silo credentials S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY
docker compose up -d --build --wait
```

The app is on http://localhost:3000 and sign-in emails land in Mailpit at http://localhost:8025.

## Develop

```sh
npm install
docker compose up -d mailpit   # SMTP for magic links
npm run dev
```

`npm run lint`, `npm run typecheck`, `npm test` (Vitest) and `npm run test:e2e` (Playwright, against the running compose stack). Schema changes: edit `src/db/schema.ts`, then `npm run db:generate`; migrations run at boot.
