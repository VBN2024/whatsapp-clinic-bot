'use strict';

const db = require('../services/db');
const { parseInboundMessage } = require('../services/inboundParser');
const { processInbound } = require('../services/stateMachine');

/**
 * GET /webhook
 * Verificação do webhook
 */
async function verifyWebhook(req, reply) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (
    mode === 'subscribe' &&
    token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  ) {
    return reply.code(200).send(challenge);
  }

  return reply.code(403).send('Forbidden');
}

/**
 * Extrai a primeira mensagem inbound válida do payload da Meta
 * @param {object} body
 * @returns {object|null}
 */
function extractInboundMessage(body) {
  const entry = body?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;

  if (!value?.messages?.length) {
    return null;
  }

  const message = value.messages[0];
  const contact = value.contacts?.[0];

  return {
    message,
    contact,
  };
}

/**
 * POST /webhook
 * Recebe mensagens WhatsApp
 */
async function receiveWebhook(req, reply) {
  try {
    const inbound = extractInboundMessage(req.body);

    // Status, delivery receipts ou payload sem mensagem
    if (!inbound) {
      return reply.code(200).send({ ok: true });
    }

    const { message, contact } = inbound;
    const messageId = message.id;
    const phone = message.from;
    const profileName = contact?.profile?.name || null;

    // 1. Contato
    const savedContact = await db.upsertContact(phone, profileName);

    // 2. Log inbound bruto
    const parsedMessage = parseInboundMessage(message);

    await db.logMessage(
      messageId,
      savedContact.id,
      parsedMessage.type,
      {
        raw_message: message,
        raw_contact: contact,
        parsed: parsedMessage,
      }
    );

    // 3. Conversa ativa
    const conversation = await db.getOrCreateActiveConversation(savedContact.id);

    // 4. Marca última mensagem do usuário
    await db.touchUserMessage(conversation.id);

    // 5. Recarrega conversa após touch para usar versão mais atual
    const freshConversation = await db.getActiveConversation(savedContact.id);

    // 6. Processa state machine
    await processInbound({
      to: phone,
      contact: savedContact,
      conversation: freshConversation,
      parsedMessage,
    });

    return reply.code(200).send({ ok: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return reply.code(200).send({ ok: false });
  }
}

module.exports = async function routes(fastify) {
  fastify.get('/webhook', verifyWebhook);
  fastify.post('/webhook', receiveWebhook);
};
