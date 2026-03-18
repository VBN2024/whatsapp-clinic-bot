'use strict';

const { parseInboundMessage }                  = require('../utils/parseMessage');
const { upsertContact, upsertConversation,
        updateConversation, logMessage }        = require('../services/db');
const { sendTextMessage,
        sendInteractiveButtons }               = require('../services/whatsapp');
const { decide }                               = require('../services/stateEngine');

// ─── Message catalogue ────────────────────────────────────────────────────────

const MENUS = {
  main: {
    body: 'Olá! Bem-vinda ao atendimento da Dra. Vivian Natale.\n\nComo podemos ajudar?',
    buttons: [
      { id: 'BTN_PARTICULAR', title: 'Consulta particular' },
      { id: 'BTN_ALICE',      title: 'Convênio Alice' },
      { id: 'BTN_OUTROS',     title: 'Outros assuntos' },
    ],
  },
  modalityParticular: {
    body: 'As consultas particulares com a Dra. Vivian Natale podem ser realizadas online ou presencialmente.\n\nQual modalidade você prefere?',
    buttons: [
      { id: 'BTN_ONLINE',     title: 'Consulta online' },
      { id: 'BTN_PRESENCIAL', title: 'Consulta presencial' },
    ],
  },
  modalityAlice: {
    body: 'Para consultas pelo convênio Alice, priorizamos o atendimento online, que costuma ter agenda mais rápida.\n\nQual modalidade você prefere?',
    buttons: [
      { id: 'BTN_ALICE_ONLINE',     title: 'Consulta online' },
      { id: 'BTN_ALICE_PRESENCIAL', title: 'Consulta presencial' },
    ],
  },
};

const HANDOFF_TEXT =
  'Certo! Vou encaminhar sua mensagem para a equipe da clínica. ' +
  'Em breve alguém do time retorna para ajudar.';

function bookingLinkText(linkEnvVar) {
  const link = process.env[linkEnvVar] || '[link não configurado]';
  return (
    'Você pode agendar sua consulta diretamente pelo link abaixo:\n\n' +
    `${link}\n\n` +
    'Se precisar de ajuda com o agendamento, é só avisar.'
  );
}

// ─── Route plugin ─────────────────────────────────────────────────────────────

/**
 * @param {import('fastify').FastifyInstance} fastify
 */
async function webhookRoutes(fastify) {

  // ─── GET /webhook — hub.challenge verification (used by 360dialog on webhook registration) ──
  fastify.get('/webhook', (request, reply) => {
    const mode      = request.query['hub.mode'];
    const token     = request.query['hub.verify_token'];
    const challenge = request.query['hub.challenge'];

    const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN;
    if (mode === 'subscribe' && token === verifyToken) {
      fastify.log.info('Webhook verified by 360dialog');
      return reply.code(200).send(challenge);
    }

    fastify.log.warn({ mode, token }, 'Webhook verification failed — check WEBHOOK_VERIFY_TOKEN');
    return reply.code(403).send('Forbidden');
  });

  // ─── POST /webhook — inbound WhatsApp events ──────────────────────────────
  fastify.post('/webhook', async (request, reply) => {
    // Acknowledge immediately — 360dialog will retry on slow or failed responses
    reply.code(200).send({ status: 'ok' });

    fastify.log.info('Webhook received from 360dialog');

    // ── 1. Parse ─────────────────────────────────────────────────────────────
    const parsed = parseInboundMessage(request.body);
    if (!parsed) {
      fastify.log.info(
        { event: request.body?.entry?.[0]?.changes?.[0]?.value?.statuses },
        'No inbound message in event; skipping'
      );
      return;
    }

    const { externalMessageId, phone, name, type, text, buttonId, payload } = parsed;
    fastify.log.info({ externalMessageId, phone, type, text, buttonId }, 'Inbound message received');

    // ── 2. Persist contact, conversation, inbound message ────────────────────
    let contact, conversation;
    try {
      contact      = await upsertContact(phone, name);
      conversation = await upsertConversation(contact.id);
      await logMessage(externalMessageId, contact.id, conversation.id, type, payload);

      fastify.log.info(
        { externalMessageId, contactId: contact.id, conversationId: conversation.id, state: conversation.state },
        'Inbound message stored'
      );
    } catch (err) {
      fastify.log.error({ err, externalMessageId }, 'Error storing inbound message');
      return;
    }

    // ── 3. State machine decision ─────────────────────────────────────────────
    const action = decide(conversation, { text, buttonId, type });
    fastify.log.info(
      { action, prevState: conversation.state, conversationId: conversation.id },
      'State machine decision'
    );

    // ── 4. Execute action ─────────────────────────────────────────────────────
    const ctx = { phone, contact, conversation, fastify };
    try {
      switch (action) {

        case 'SEND_MAIN_MENU':
          await execSendMenu(ctx, MENUS.main, 'menu_root');
          break;

        case 'SEND_MODALITY_PARTICULAR':
          await execSendMenu(ctx, MENUS.modalityParticular, 'choosing_modality');
          break;

        case 'SEND_MODALITY_ALICE':
          await execSendMenu(ctx, MENUS.modalityAlice, 'choosing_modality');
          break;

        case 'SEND_LINK_PARTICULAR_ONLINE':
          await execSendLink(ctx, 'LINK_PARTICULAR_ONLINE');
          break;

        case 'SEND_LINK_PARTICULAR_PRESENCIAL':
          await execSendLink(ctx, 'LINK_PARTICULAR_PRESENCIAL');
          break;

        case 'SEND_LINK_ALICE_ONLINE':
          await execSendLink(ctx, 'LINK_ALICE_ONLINE');
          break;

        case 'SEND_LINK_ALICE_PRESENCIAL':
          await execSendLink(ctx, 'LINK_ALICE_PRESENCIAL');
          break;

        case 'HANDOFF':
          await execHandoff(ctx);
          break;

        case 'SKIP':
          fastify.log.info(
            { conversationId: conversation.id, state: conversation.state, handoff_human: conversation.handoff_human },
            'Bot silent (SKIP) — human in control or state requires no response'
          );
          break;

        default:
          fastify.log.warn({ action }, 'Unknown action — skipping');
      }
    } catch (err) {
      console.error('[webhook] Error executing action:', err.message);
      console.error(err.stack);
      fastify.log.error(
        { err: { message: err.message, stack: err.stack }, phone, action },
        'Error executing action'
      );
    }
  });
}

// ─── Action executors ─────────────────────────────────────────────────────────

async function execSendMenu({ phone, contact, conversation, fastify }, menu, nextState) {
  console.log(`[sendMenu] Sending message to user ${phone} — nextState: ${nextState}`);
  const outboundId = await sendInteractiveButtons(phone, menu.body, menu.buttons);
  fastify.log.info({ phone, outboundId, nextState }, 'Interactive menu sent');

  await updateConversation(conversation.id, {
    state:               nextState,
    last_bot_message_at: new Date().toISOString(),
  });

  if (outboundId) {
    await logMessage(
      outboundId, contact.id, conversation.id,
      'interactive',
      { type: 'interactive', body: menu.body, buttons: menu.buttons },
      'outbound'
    );
  }
}

async function execSendLink({ phone, contact, conversation, fastify }, linkEnvVar) {
  console.log(`[sendLink] Sending message to user ${phone} — link: ${linkEnvVar}`);
  const text = bookingLinkText(linkEnvVar);
  const outboundId = await sendTextMessage(phone, text);
  fastify.log.info({ phone, outboundId, linkEnvVar }, 'Booking link sent');

  await updateConversation(conversation.id, {
    state:                'waiting_booking',
    last_bot_message_at:  new Date().toISOString(),
    booking_link_sent_at: new Date().toISOString(),
  });

  if (outboundId) {
    await logMessage(outboundId, contact.id, conversation.id, 'text', { body: text }, 'outbound');
  }
}

async function execHandoff({ phone, contact, conversation, fastify }) {
  console.log(`[sendHandoff] Sending message to user ${phone}`);
  const outboundId = await sendTextMessage(phone, HANDOFF_TEXT);
  fastify.log.info({ phone, outboundId }, 'Conversation handed off to human');

  await updateConversation(conversation.id, {
    state:               'waiting_human',
    handoff_human:       true,
    handoff_at:          new Date().toISOString(),
    last_bot_message_at: new Date().toISOString(),
  });

  if (outboundId) {
    await logMessage(outboundId, contact.id, conversation.id, 'text', { body: HANDOFF_TEXT }, 'outbound');
  }
}

module.exports = webhookRoutes;
