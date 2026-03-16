'use strict';

const { parseEvolutionMessage } = require('../utils/parseEvolutionMessage');
const { upsertContact, logMessage } = require('../services/db');

/**
 * Validates the shared secret sent by Evolution in the request body.
 * Evolution includes the instance API key as body.apikey.
 *
 * If EVOLUTION_WEBHOOK_SECRET is not set, validation is skipped
 * (permissive — useful during initial setup).
 */
function isAuthorized(body) {
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET;
  if (!secret) return true;
  return body?.apikey === secret;
}

/**
 * @param {import('fastify').FastifyInstance} fastify
 */
async function evolutionWebhookRoutes(fastify) {
  /**
   * POST /evolution/webhook
   * Receives inbound events from Evolution API.
   * Always returns 200 OK immediately so Evolution does not retry.
   */
  fastify.post('/evolution/webhook', async (request, reply) => {
    // Always acknowledge immediately
    reply.code(200).send({ status: 'ok' });

    if (!isAuthorized(request.body)) {
      fastify.log.warn('Evolution webhook rejected: invalid secret');
      return;
    }

    const parsed = parseEvolutionMessage(request.body);

    if (!parsed) {
      // Non-message event (connection update, qr, etc.) — safe to ignore
      fastify.log.info({ event: request.body?.event }, 'Evolution event skipped');
      return;
    }

    const { externalMessageId, phone, name, type, payload } = parsed;

    fastify.log.info(
      { externalMessageId, phone, type },
      'Inbound Evolution message received'
    );

    try {
      const contact = await upsertContact(phone, name);
      await logMessage(externalMessageId, contact.id, type, payload);

      fastify.log.info(
        { externalMessageId, contactId: contact.id },
        'Evolution message logged successfully'
      );
    } catch (err) {
      fastify.log.error({ err, externalMessageId }, 'Error processing Evolution message');
    }
  });
}

module.exports = evolutionWebhookRoutes;
