# whatsapp-clinic-bot

WhatsApp triage and scheduling bot for clinic.

## Requirements

- Node.js >= 18
- A [Supabase](https://supabase.com) project with the schema applied
- A WhatsApp Business account on Meta Cloud API

## Environment setup

Copy the example file and fill in the values:

```bash
cp .env.example .env
```

| Variable | Description | Where to find |
|---|---|---|
| `PORT` | HTTP server port | Default: `3000` |
| `WHATSAPP_VERIFY_TOKEN` | Token you define for Meta webhook verification | Any secret string |
| `WHATSAPP_ACCESS_TOKEN` | Meta API access token | Meta for Developers > App > WhatsApp > API Setup |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone number ID | Same page as above |
| `SUPABASE_URL` | Supabase project URL | Project Settings > API > Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Project Settings > API > service_role |

> Use the `service_role` key (not `anon`) — the backend needs to bypass Row Level Security.

## Database

Run `db/schema.sql` in the Supabase SQL Editor once to create all tables and indexes.

## Running

```bash
npm install
npm start          # production
npm run dev        # development (auto-reload)
```

## Webhook endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/webhook` | Meta Cloud API verification (hub challenge) |
| `POST` | `/webhook` | Receives inbound WhatsApp events |

## Project structure

```
src/
  server.js              # Entry point (Fastify)
  routes/
    webhook.js           # Webhook route handlers
  services/
    db.js                # Database operations (upsertContact, logMessage)
  utils/
    parseMessage.js      # Extracts fields from Meta webhook payload
    supabaseClient.js    # Configured Supabase client
db/
  schema.sql             # PostgreSQL schema for Supabase
docs/
  resumo-executivo.md    # Functional specification (source of truth)
```
