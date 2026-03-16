# whatsapp-clinic-bot

WhatsApp triage and scheduling bot for clinic.

## Architecture

```
WhatsApp Business App (same phone number — continues working on device)
           +
Meta WhatsApp Cloud API
           |
           v
     Nginx reverse proxy
     api.institutonatale.com/bot/
           |
           v
  Node.js / Fastify (PM2)   port 3000
           |
      ┌────┴────┐
      v         v
  Supabase   Calendly links
 (database)  (scheduling)
```

**Coexistence mode:** the clinic phone keeps receiving messages normally on the device. The Cloud API webhook delivers a copy to this backend for automation.

## Requirements

- Node.js >= 18
- A [Supabase](https://supabase.com) project with the schema applied (`db/schema.sql`)
- A WhatsApp Business Account registered on Meta Cloud API

## Environment setup

Copy the example file and fill in the values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `PORT` | optional | HTTP port — default `3000` |
| `WHATSAPP_VERIFY_TOKEN` | **yes** | Token you define; must match Meta webhook config |
| `WHATSAPP_ACCESS_TOKEN` | **yes** | Meta Cloud API permanent access token |
| `WHATSAPP_PHONE_NUMBER_ID` | **yes** | Meta phone number ID |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | **yes** | Meta Business Account ID |
| `SUPABASE_URL` | **yes** | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes** | Supabase `service_role` secret key |
| `LINK_PARTICULAR_ONLINE` | Etapa 2+ | Calendly — particular online |
| `LINK_PARTICULAR_PRESENCIAL` | Etapa 2+ | Calendly — particular presencial |
| `LINK_ALICE_ONLINE` | Etapa 2+ | Calendly — Alice online |
| `LINK_ALICE_PRESENCIAL` | Etapa 2+ | Calendly — Alice presencial |

> Use the `service_role` key (not `anon`) — the backend bypasses Row Level Security.
> The server refuses to start if `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` are missing.

## Database

Run `db/schema.sql` in the Supabase SQL Editor once to create all tables and indexes.

## Running

```bash
npm install
npm start          # production
npm run dev        # development (auto-reload with Node --watch)
```

## Webhook endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/webhook` | Meta Cloud API verification (hub challenge) |
| `POST` | `/webhook` | Receives inbound WhatsApp events |
| `GET` | `/health` | Server liveness check |
| `GET` | `/health/db` | Supabase connectivity check |

## Deploying to the VPS (PM2 + Nginx already configured)

```bash
# Pull latest code
cd /opt/whatsapp-clinic-bot
git pull origin main
npm ci --omit=dev

# Reload without downtime
pm2 reload whatsapp-clinic-bot
```

### Nginx location block (add inside the api.institutonatale.com server block)

```nginx
location /bot/ {
    proxy_pass         http://127.0.0.1:3000/;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
}
```

### Common PM2 commands

```bash
pm2 status
pm2 logs whatsapp-clinic-bot
pm2 reload whatsapp-clinic-bot     # zero-downtime reload
pm2 restart whatsapp-clinic-bot    # full restart
```

## Project structure

```
src/
  server.js                # Entry point (Fastify)
  routes/
    webhook.js             # GET + POST /webhook — Meta Cloud API
    health.js              # GET /health, GET /health/db
  services/
    db.js                  # upsertContact, upsertConversation, logMessage
    whatsapp.js            # sendTextMessage via Meta Cloud API
    triage.js              # Keyword-based triage (placeholder — Etapa 2)
  utils/
    parseMessage.js        # Normalizes Meta webhook payload
    supabaseClient.js      # Configured Supabase singleton
db/
  schema.sql               # PostgreSQL schema (run once in Supabase)
docs/
  resumo-executivo.md      # Functional specification (source of truth)
```

## Functional specification

See [`docs/resumo-executivo.md`](docs/resumo-executivo.md) for the full functional spec, state machine, decision tree, and database schema.
