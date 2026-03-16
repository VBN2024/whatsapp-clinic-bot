'use strict';

const { parseInboundMessage }                             = require('../utils/parseMessage');
const { upsertContact, upsertConversation,
        updateConversation, logMessage }                  = require('../services/db');
const { sendTextMessage }                                 = require('../services/whatsapp');
const { evaluate }                                        = require('../services/triage');

/**
 * @param {import('fastify').FastifyInstance} fastify
 */
async function webhookRoutes(fastify) {

  // ─── GET /webhook — Meta hub.challenge verification ───────────────────────
  fastify.get('/webhook', (request, reply) => {
    const mode      = request.query['hub.mode'];
    const token     = request.query['hub.verify_token'];
    const challenge = request.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      fastify.log.info('Webhook verified by Meta');
      return reply.code(200).send(challenge);
    }

    fastify.log.warn({ mode, token }, 'Webhook verification failed — check WHATSAPP_VERIFY_TOKEN');
    return reply.code(403).send('Forbidden');
  });

  // ─── POST /webhook — inbound WhatsApp events ──────────────────────────────
  fastify.post('/webhook', async (request, reply) => {
    // Always acknowledge immediately — Meta will retry if we don't answer fast
    reply.code(200).send({ status: 'ok' });

    fastify.log.info('Webhook received');

    // ── 1. Parse ─────────────────────────────────────────────────────────────
    const parsed = parseInboundMessage(request.body);
    if (!parsed) {
      fastify.log.info({ event: request.body?.entry?.[0]?.changes?.[0]?.value?.statuses },
        'No inbound message in event; skipping');
      return;
    }

    const { externalMessageId, phone, name, type, text, buttonId, timestamp, payload } = parsed;

    fastify.log.info({ externalMessageId, phone, type, text }, 'Inbound message received');

    // ── 2. Persist contact, conversation, message ─────────────────────────────
    let contact, conversation;
    try {
      contact      = await upsertContact(phone, name);
      conversation = await upsertConversation(contact.id);
      await logMessage(externalMessageId, contact.id, conversation.id, type, payload);

      fastify.log.info(
        { externalMessageId, contactId: contact.id, conversationId: conversation.id },
        'Message stored'
      );
    } catch (err) {
      fastify.log.error({ err, externalMessageId }, 'Error storing message');
      return;
    }

    // ── 3. Triage ─────────────────────────────────────────────────────────────
    const decision = evaluate(conversation, { text, buttonId, type });
    fastify.log.info({ action: decision.action, conversationId: conversation.id }, 'Triage decision');

    try {
      if (decision.action === 'send_link') {
        await handleSendLink({ phone, contact, conversation, fastify });

      } else if (decision.action === 'handoff') {
        await handleHandoff({ phone, contact, conversation, fastify });
      }
      // 'skip' → bot stays silent
    } catch (err) {
      fastify.log.error({ err, phone, action: decision.action }, 'Error executing triage action');
    }
  });
}

// ─── Action handlers ──────────────────────────────────────────────────────────

async function handleSendLink({ phone, contact, conversation, fastify }) {
  const link = process.env.LINK_PARTICULAR_ONLINE || '';
  const msg  =
    'Ola! Para agendar sua consulta com a Dra. Vivian Natale, ' +
    'acesse o link abaixo:\n\n' +
    `${link}\n\n` +
    'Se precisar de ajuda com o agendamento, e so avisar.';

  const outboundId = await sendTextMessage(phone, msg);
  fastify.log.info({ phone, outboundId }, 'Scheduling link sent');

  await updateConversation(conversation.id, {
    state:               'waiting_booking',
    last_bot_message_at: new Date().toISOString(),
    booking_link_sent_at: new Date().toISOString(),
  });

  if (outboundId) {
    await logMessage(outboundId, contact.id, conversation.id, 'text', { body: msg }, 'outbound');
  }
}

async function handleHandoff({ phone, contact, conversation, fastify }) {
  const msg =
    'Certo! Vou encaminhar sua mensagem para a equipe da clinica. ' +
    'Em breve alguem do time retorna para ajudar.';

  const outboundId = await sendTextMessage(phone, msg);
  fastify.log.info({ phone, outboundId }, 'Conversation handed off to human');

  await updateConversation(conversation.id, {
    state:         'waiting_human',
    handoff_human: true,
    handoff_at:    new Date().toISOString(),
  });

  if (outboundId) {
    await logMessage(outboundId, contact.id, conversation.id, 'text', { body: msg }, 'outbound');
  }
}

module.exports = webhookRoutes;
