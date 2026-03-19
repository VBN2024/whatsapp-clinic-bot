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

const FALLBACK_TEXT =
  'Posso te ajudar com agendamento. Escolha uma das opções abaixo para continuar.';

const OFFER_HUMAN_TEXT =
  'Não consegui entender bem. Se preferir, posso te direcionar para ' +
  'atendimento da equipe — ou escolha uma opção abaixo:';

const PRICE_TEXT =
  'Os valores das consultas variam de acordo com a modalidade e podem ' +
  'ser confirmados diretamente no agendamento.\n\nEscolha como deseja continuar:';

function bookingLinkText(linkEnvVar) {
  const link = process.env[linkEnvVar] || '[link não configurado]';
  return (
    'Você pode agendar sua consulta diretamente pelo link abaixo:\n\n' +
    `${link}\n\n` +
    'Se precisar de ajuda com o agendamento, é só avisar.'
  );
}

// ─── Consecutive-error counter (in-memory, resets on process restart) ─────────
// Key: conversationId  Value: number of consecutive unrecognised messages
const errorCounters = new Map();

function incrementError(conversationId) {
  const n = (errorCounters.get(conversationId) || 0) + 1;
  errorCounters.set(conversationId, n);
  return n;
}

function resetError(conversationId) {
  errorCounters.delete(conversationId);
}

// ─── Route plugin ─────────────────────────────────────────────────────────────

/**
 * @param {import('fastify').FastifyInstance} fastify
 */
async function webhookRoutes(fastify) {

  // ─── POST / — catch-all for 360dialog status callbacks sent to root path ─────
  fastify.post('/', async (request, reply) => {
    fastify.log.info({ body: request.body }, 'POST / received (360dialog status callback)');
    return reply.code(200).send({ status: 'ok' });
  });

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
      const statuses = request.body?.entry?.[0]?.changes?.[0]?.value?.statuses;
      if (statuses?.length) {
        const s = statuses[0];
        if (s.status === 'failed') {
          console.error(
            `[delivery] FAILED to ${s.recipient_id} — code ${s.errors?.[0]?.code}: ${s.errors?.[0]?.message}`
          );
        } else {
          fastify.log.info({ status: s.status, recipient: s.recipient_id }, 'Delivery status update');
        }
      } else {
        fastify.log.info('No inbound message in event; skipping');
      }
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
          resetError(conversation.id);
          await execSendMenu(ctx, MENUS.main, 'menu_root');
          break;

        case 'SEND_FALLBACK_MENU': {
          const errorCount = incrementError(conversation.id);
          if (errorCount >= 2) {
            // Second consecutive unrecognised message — offer human assistance
            resetError(conversation.id);
            await execSendMenuWithText(ctx, OFFER_HUMAN_TEXT, MENUS.main, 'menu_root');
          } else {
            await execSendMenuWithText(ctx, FALLBACK_TEXT, MENUS.main, 'menu_root');
          }
          break;
        }

        case 'SEND_PRICE_INFO':
          resetError(conversation.id);
          await execSendMenuWithText(ctx, PRICE_TEXT, MENUS.main, 'menu_root');
          break;

        case 'SEND_MODALITY_PARTICULAR':
          resetError(conversation.id);
          await execSendMenu(ctx, MENUS.modalityParticular, 'choosing_modality');
          break;

        case 'SEND_MODALITY_ALICE':
          resetError(conversation.id);
          await execSendMenu(ctx, MENUS.modalityAlice, 'choosing_modality');
          break;

        case 'SEND_LINK_PARTICULAR_ONLINE':
          resetError(conversation.id);
          await execSendLink(ctx, 'LINK_PARTICULAR_ONLINE');
          break;

        case 'SEND_LINK_PARTICULAR_PRESENCIAL':
          resetError(conversation.id);
          await execSendLink(ctx, 'LINK_PARTICULAR_PRESENCIAL');
          break;

        case 'SEND_LINK_ALICE_ONLINE':
          resetError(conversation.id);
          await execSendLink(ctx, 'LINK_ALICE_ONLINE');
          break;

        case 'SEND_LINK_ALICE_PRESENCIAL':
          resetError(conversation.id);
          await execSendLink(ctx, 'LINK_ALICE_PRESENCIAL');
          break;

        case 'HANDOFF':
          resetError(conversation.id);
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

/**
 * Sends a plain-text message followed by an interactive menu.
 * Used for fallback, price info, and offer-human flows.
 */
async function execSendMenuWithText({ phone, contact, conversation, fastify }, textBody, menu, nextState) {
  console.log(`[sendMenuWithText] Sending text + menu to user ${phone} — nextState: ${nextState}`);

  const textOutboundId = await sendTextMessage(phone, textBody);
  if (textOutboundId) {
    await logMessage(textOutboundId, contact.id, conversation.id, 'text', { body: textBody }, 'outbound');
  }

  const menuOutboundId = await sendInteractiveButtons(phone, menu.body, menu.buttons);
  fastify.log.info({ phone, menuOutboundId, nextState }, 'Text + menu sent');

  await updateConversation(conversation.id, {
    state:               nextState,
    last_bot_message_at: new Date().toISOString(),
  });

  if (menuOutboundId) {
    await logMessage(
      menuOutboundId, contact.id, conversation.id,
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
