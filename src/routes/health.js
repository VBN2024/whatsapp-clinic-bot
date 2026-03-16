'use strict';

const supabase = require('../utils/supabaseClient');

/**
 * @param {import('fastify').FastifyInstance} fastify
 */
async function healthRoutes(fastify) {
  /**
   * GET /health
   * Confirms the server process is running.
   */
  fastify.get('/health', async (_request, reply) => {
    return reply.code(200).send({ status: 'ok' });
  });

  /**
   * GET /health/db
   * Verifies Supabase connectivity with a minimal round-trip query.
   */
  fastify.get('/health/db', async (_request, reply) => {
    const { error } = await supabase.from('contacts').select('id').limit(1);

    if (error) {
      fastify.log.error({ err: error }, 'Database health check failed');
      return reply.code(503).send({ status: 'error', message: error.message });
    }

    return reply.code(200).send({ status: 'ok' });
  });
}

module.exports = healthRoutes;
