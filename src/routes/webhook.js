'use strict';

const { parseInboundMessage } = require('../utils/parseMessage');
const { upsertContact, logMessage } = require('../services/db');

/**
 * @param {import('fastify').FastifyInstance} fastify
 */
async function webhookRoutes(fastify) {
  /**
   * GET /webhook
   * Meta Cloud API verification handshake.
   */
  fastify.get('/webhook', (request, reply) => {
    const mode      = request.query['hub.mode'];
    const token     = request.query['hub.verify_token'];
    const challenge = request.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      fastify.log.info('Webhook verified by Meta');
      return reply.code(200).send(challenge);
    }

    fastify.log.warn({ mode, token }, 'Webhook verification failed');
    return reply.code(403).send('Forbidden');
  });

  /**
   * POST /webhook
   * Receives inbound events from Meta Cloud API.
   * Always returns 200 OK so Meta does not retry.
   */
  fastify.post('/webhook', async (request, reply) => {
    // Always acknowledge immediately
    reply.code(200).send({ status: 'ok' });

    const parsed = parseInboundMessage(request.body);

    if (!parsed) {
      fastify.log.info('Webhook event contains no message; skipping');
      return;
    }

    const { externalMessageId, phone, name, type, payload } = parsed;

    fastify.log.info(
      { externalMessageId, phone, type },
      'Inbound message received'
    );

    try {
      const contact = await upsertContact(phone, name);
      await logMessage(externalMessageId, contact.id, type, payload);

      fastify.log.info(
        { externalMessageId, contactId: contact.id },
        'Message logged successfully'
      );
    } catch (err) {
      // Log error but do NOT propagate — reply was already sent
      fastify.log.error({ err, externalMessageId }, 'Error processing inbound message');
    }
  });
}

module.exports = webhookRoutes;
