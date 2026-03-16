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
| `GET` | `/health` | Server liveness check |
| `GET` | `/health/db` | Supabase connectivity check |

## Deploying to a Linux VPS

Prerequisites on the VPS: **Node.js >= 18** and **PM2**.

```bash
# 1. Install PM2 once (global)
npm install -g pm2

# 2. Clone the repo and install dependencies
git clone <repo-url> /opt/whatsapp-clinic-bot
cd /opt/whatsapp-clinic-bot
npm ci --omit=dev

# 3. Create the PM2 config with secrets
cp ecosystem.config.js.example ecosystem.config.js
# Edit ecosystem.config.js and fill in every empty value

# 4. Start with PM2
pm2 start ecosystem.config.js
pm2 save                      # persist across reboots
pm2 startup                   # follow the printed command to enable autostart
```

### nginx reverse proxy (recommended)

Add a server block so nginx forwards port 443 to the app on port 3000:

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
    }
}
```

```bash
nginx -t && systemctl reload nginx
```

### Verify the deployment

```bash
curl https://your-domain.com/health
# {"status":"ok"}

curl https://your-domain.com/health/db
# {"status":"ok"}
```

### Required environment variables

All variables below must be set in `ecosystem.config.js` before starting the process.

| Variable | Required | Description |
|---|---|---|
| `PORT` | optional | HTTP port (default `3000`) |
| `WHATSAPP_VERIFY_TOKEN` | **yes** | Secret token for Meta webhook verification |
| `WHATSAPP_ACCESS_TOKEN` | **yes** | Meta Cloud API access token |
| `WHATSAPP_PHONE_NUMBER_ID` | **yes** | Meta phone number ID |
| `SUPABASE_URL` | **yes** | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes** | Supabase service role secret key |
| `LINK_PARTICULAR_ONLINE` | Etapa 2+ | Calendly link — particular online |
| `LINK_PARTICULAR_PRESENCIAL` | Etapa 2+ | Calendly link — particular presencial |
| `LINK_ALICE_ONLINE` | Etapa 2+ | Calendly link — Alice online |
| `LINK_ALICE_PRESENCIAL` | Etapa 2+ | Calendly link — Alice presencial |

> The server will refuse to start if `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` are missing.

### Common PM2 commands

```bash
pm2 status                          # list running processes
pm2 logs whatsapp-clinic-bot        # tail logs
pm2 restart whatsapp-clinic-bot     # restart after config change
pm2 reload whatsapp-clinic-bot      # zero-downtime reload
```

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
