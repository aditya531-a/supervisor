# JalSakshi supervisor workspace

A unified, responsive Cases and Reports dashboard using React, TypeScript, Vite, Supabase Auth, and PostgreSQL. Sign-in requires a supervisor profile and assigned team. Demo records must be persisted in a compatible Supabase project before use.

## Run locally

```sh
npm install
npm run dev -- --host 127.0.0.1 --port 5175
```

Open http://127.0.0.1:5175/. Environment and account details are documented in [AUTH_SETUP.md](./AUTH_SETUP.md). Demo credentials are saved only in the ignored `.demo-credentials.local` file.

To serve the built dashboard and API together from the standalone server (including through ngrok):

```sh
npm run build
node --env-file=.env server/index.ts
ngrok http 3000
```

Open the ngrok HTTPS URL at `/`. The standalone server serves the dashboard there and keeps API routes under `/api/`.

## Implemented workflows

- Team-scoped case queue, status/priority filters, source metadata and full screening history.
- Separate machine suggestions, human observations, and laboratory evidence.
- Private PDF/image attachments; laboratory upload and deliberate verification are separate actions.
- Corrective/referral action records, pending retest requests and distinct later sample linkage.
- Resident communication records with actual channel, delivery status, and timestamp. The app does not send messages.
- IVR complaint linkage and atomic create-and-link escalation.
- Database-guarded closure requiring a verified laboratory report **or** a completed linked retest, plus a recorded rationale.
- Append-only, per-case hash-linked audit history and integrity verification.
- Aggregate CSV exports without evidence, contact details, identifiers, or invented performance metrics.

## Checks

```sh
npm test
npm run test:database
npm run test:workflow
npm run build
npm run lint
```

HTTP tests use mocked providers. Database tests roll back their fixtures and require the supervisor schema. Workflow tests require the running localhost app and a seeded demo account; they retain explicitly synthetic demonstration records. Run `npm run db:migrate -- --check` before seeding or testing a database. Node 24 runs the TypeScript scripts directly.

The existing `jalsakshi` ingestion schema is preserved. Automatic import from that schema still requires an explicit tenant and worker identity mapping. This local demo uses synthetic records; a live team requires separately provisioned real records and matching mode configuration. See setup notes before deployment.
