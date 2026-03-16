'use strict';

require('dotenv').config();

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
fastify.register(require('./routes/evolutionWebhook'));
fastify.register(require('./routes/webhook'));

const PORT = parseInt(process.env.PORT || '3000', 10);

fastify.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
});
