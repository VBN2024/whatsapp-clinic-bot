# whatsapp-clinic-bot

WhatsApp triage and scheduling bot for clinic.

## Arquitetura

```
WhatsApp Business App no celular (coexistência ativa — continua funcionando)
           +
      360dialog BSP
    waba-v2.360dialog.io
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
  Supabase   Links Calendly
 (database)  (agendamento)
```

**Modo coexistência:** o celular da clínica continua recebendo mensagens normalmente.
O 360dialog entrega uma cópia ao backend via webhook para automação.

**Provedor de mensageria:** exclusivamente **360dialog** via `waba-v2.360dialog.io`.
NÃO usar Meta Cloud API direta nem Evolution API.

## Requisitos

- Node.js >= 18
- Projeto [Supabase](https://supabase.com) com schema aplicado (`db/schema.sql`)
- Conta 360dialog com API key ativa (`wabamanagement.360dialog.io`)

## Configuração de ambiente

Copie o arquivo de exemplo e preencha os valores:

```bash
cp .env.example .env
# edite o .env com os valores reais
```

| Variável | Obrigatória | Descrição |
|---|---|---|
| `PORT` | opcional | Porta HTTP — padrão `3000` |
| `WHATSAPP_API_KEY_360D` | **sim** | API key do 360dialog (gerada em wabamanagement.360dialog.io) |
| `WHATSAPP_CHANNEL_NUMBER` | **sim** | Número da clínica E.164 sem `+` (ex.: `5511994295900`) |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | **sim** | Token definido por você; deve coincidir com o configurado no 360dialog |
| `SUPABASE_URL` | **sim** | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | **sim** | Chave `service_role` do Supabase |
| `LINK_PARTICULAR_ONLINE` | Etapa 2+ | Calendly — particular online |
| `LINK_PARTICULAR_PRESENCIAL` | Etapa 2+ | Calendly — particular presencial |
| `LINK_ALICE_ONLINE` | Etapa 2+ | Calendly — Alice online |
| `LINK_ALICE_PRESENCIAL` | Etapa 2+ | Calendly — Alice presencial |

> Use a chave `service_role` (não `anon`) — o backend contorna o Row Level Security.
> O servidor recusa iniciar se `SUPABASE_URL` ou `SUPABASE_SERVICE_ROLE_KEY` estiverem ausentes.
> O log de startup exibe diagnóstico seguro da `WHATSAPP_API_KEY_360D` (comprimento + últimos 4 chars).

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
cd /home/user/whatsapp-clinic-bot
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
    webhook.js             # GET + POST /webhook — 360dialog
    health.js              # GET /health, GET /health/db
  services/
    db.js                  # upsertContact, upsertConversation, logMessage
    whatsapp.js            # sendTextMessage via 360dialog (waba-v2.360dialog.io)
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
