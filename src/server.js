'use strict';

// override:true garante que o .env sobrescreve variáveis já definidas pelo PM2 ecosystem.
require('dotenv').config({ override: true });

// ─── Diagnóstico seguro de credenciais no startup ────────────────────────────
(function checkEnv() {
  const key     = process.env.WHATSAPP_API_KEY_360D || '';
  const len     = key.length;
  const present = len > 0;
  const hasLeadingSpace  = present && key[0] === ' ';
  const hasTrailingSpace = present && key[key.length - 1] === ' ';
  const hasNewline       = present && /[\r\n]/.test(key);
  const tail             = present ? `****${key.slice(-4)}` : 'N/A';

  console.log(
    '[startup] WHATSAPP_API_KEY_360D —',
    `presente=${present}`,
    `len=${len}`,
    `tail=${tail}`,
    hasLeadingSpace  ? '⚠ ESPAÇO NO INÍCIO' : '',
    hasTrailingSpace ? '⚠ ESPAÇO NO FINAL'  : '',
    hasNewline       ? '⚠ QUEBRA DE LINHA'  : '',
  );

  if (!present) {
    console.error('[startup] ERRO CRÍTICO: WHATSAPP_API_KEY_360D não definida — o envio outbound falhará.');
  }

  console.log('[startup] SUPABASE_URL presente =', (process.env.SUPABASE_URL || '').length > 0);
  console.log('[startup] SUPABASE_SERVICE_ROLE_KEY presente =', (process.env.SUPABASE_SERVICE_ROLE_KEY || '').length > 0);
})();

const fastify = require('fastify')({
  logger: {
    level: 'info',
    serializers: {
      req(request) {
        return { method: request.method, url: request.url };
      },
    },
  },
});

fastify.register(require('./routes/health'));
fastify.register(require('./routes/webhook'));

const PORT = parseInt(process.env.PORT || '3000', 10);

fastify.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
});
