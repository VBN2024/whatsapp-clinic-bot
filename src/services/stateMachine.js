'use strict';

const db = require('./db');
const messageService = require('./messageService');
const { isValidButtonForState } = require('./buttonValidation');
const {
  STATES,
  BUTTON_IDS,
  MENU_COMMAND_KEYWORDS,
  HUMAN_REQUEST_KEYWORDS,
  SIMPLE_INTENT_KEYWORDS,
  LIMITS,
} = require('../config/constants');
const { normalizeText, includesAnyKeyword } = require('../utils/normalize');

/**
 * Helpers
 */

function isMenuCommand(text) {
  return includesAnyKeyword(text, MENU_COMMAND_KEYWORDS);
}

function isHumanCommand(text) {
  return includesAnyKeyword(text, HUMAN_REQUEST_KEYWORDS);
}

function isParticularIntent(text) {
  return includesAnyKeyword(text, SIMPLE_INTENT_KEYWORDS.PARTICULAR);
}

function isAliceIntent(text) {
  return includesAnyKeyword(text, SIMPLE_INTENT_KEYWORDS.ALICE);
}

function isOnlineIntent(text) {
  return includesAnyKeyword(text, SIMPLE_INTENT_KEYWORDS.ONLINE);
}

function isPresencialIntent(text) {
  return includesAnyKeyword(text, SIMPLE_INTENT_KEYWORDS.PRESENCIAL);
}

function isSuppressActive(conversation) {
  if (!conversation?.bot_suppressed_until) return false;
  return new Date(conversation.bot_suppressed_until).getTime() > Date.now();
}

/**
 * Fallback controlado:
 * - 1ª falha => envia fallback
 * - 2ª falha => ativa handoff
 */
async function handleFallbackOrHandoff(to, conversation) {
  const currentCount = conversation?.fallback_count || 0;

  if (currentCount < LIMITS.MAX_MENU_ERRORS_BEFORE_HANDOFF) {
    await db.incrementFallbackCount(conversation.id, currentCount);
    return messageService.sendFallbackMessage(to);
  }

  await db.activateHumanHandoff(conversation.id);
  return messageService.sendHandoffMessage(to);
}

/**
 * Trata menu_root
 */
async function handleMenuRoot(to, conversation, parsedMessage) {
  const text = normalizeText(parsedMessage.text || '');
  const buttonId = parsedMessage.buttonId;

  if (
    buttonId === BUTTON_IDS.BTN_PARTICULAR ||
    (!buttonId && isParticularIntent(text))
  ) {
    await db.updateConversation(conversation.id, {
      state: STATES.CHOOSING_MODALITY_PARTICULAR,
      fallback_count: 0,
    });

    return messageService.sendParticularModalityMenu(to, conversation.id);
  }

  if (
    buttonId === BUTTON_IDS.BTN_ALICE ||
    (!buttonId && isAliceIntent(text))
  ) {
    await db.updateConversation(conversation.id, {
      state: STATES.CHOOSING_MODALITY_ALICE,
      fallback_count: 0,
    });

    return messageService.sendAliceModalityMenu(to, conversation.id);
  }

  if (buttonId === BUTTON_IDS.BTN_OUTROS) {
    await db.activateHumanHandoff(conversation.id);
    return messageService.sendHandoffMessage(to);
  }

  return handleFallbackOrHandoff(to, conversation);
}

/**
 * Trata submenu particular
 */
async function handleParticularModality(to, conversation, parsedMessage) {
  const text = normalizeText(parsedMessage.text || '');
  const buttonId = parsedMessage.buttonId;

  if (
    buttonId === BUTTON_IDS.BTN_PARTICULAR_ONLINE ||
    (!buttonId && isOnlineIntent(text))
  ) {
    return messageService.sendBookingLink(
      to,
      'particular_online',
      conversation.id
    );
  }

  if (
    buttonId === BUTTON_IDS.BTN_PARTICULAR_PRESENCIAL ||
    (!buttonId && isPresencialIntent(text))
  ) {
    return messageService.sendBookingLink(
      to,
      'particular_presencial',
      conversation.id
    );
  }

  return handleFallbackOrHandoff(to, conversation);
}

/**
 * Trata submenu Alice
 */
async function handleAliceModality(to, conversation, parsedMessage) {
  const text = normalizeText(parsedMessage.text || '');
  const buttonId = parsedMessage.buttonId;

  if (
    buttonId === BUTTON_IDS.BTN_ALICE_ONLINE ||
    (!buttonId && isOnlineIntent(text))
  ) {
    return messageService.sendBookingLink(
      to,
      'alice_online',
      conversation.id
    );
  }

  if (
    buttonId === BUTTON_IDS.BTN_ALICE_PRESENCIAL ||
    (!buttonId && isPresencialIntent(text))
  ) {
    return messageService.sendBookingLink(
      to,
      'alice_presencial',
      conversation.id
    );
  }

  return handleFallbackOrHandoff(to, conversation);
}

/**
 * Trata waiting_booking
 */
async function handleWaitingBooking(to, conversation, parsedMessage) {
  return handleFallbackOrHandoff(to, conversation);
}

/**
 * Trata booked
 */
async function handleBookedState(to, conversation, parsedMessage) {
  return handleFallbackOrHandoff(to, conversation);
}

/**
 * Processa mensagem inbound conforme estado/contexto
 *
 * @param {object} params
 * @param {string} params.to
 * @param {object} params.contact
 * @param {object} params.conversation
 * @param {object} params.parsedMessage
 * @returns {Promise<void>}
 */
async function processInbound({ to, contact, conversation, parsedMessage }) {
  const rawText = parsedMessage.text || '';
  const normalizedText = normalizeText(rawText);

  // 1. Comando global MENU sempre vence
  if (isMenuCommand(normalizedText)) {
    await db.resetConversationToMenu(conversation.id);
    await messageService.sendMainMenu(to, conversation.id);
    return;
  }

  // 2. Handoff soberano = silêncio total
  if (conversation.handoff_human === true || conversation.state === STATES.WAITING_HUMAN) {
    return;
  }

  // 3. Suppress ativo = silêncio
  if (isSuppressActive(conversation)) {
    return;
  }

  // 4. Pedido explícito de humano
  if (isHumanCommand(normalizedText)) {
    await db.activateHumanHandoff(conversation.id);
    await messageService.sendHandoffMessage(to);
    return;
  }

  // 5. Mídia
  if (parsedMessage.isMedia) {
    return handleFallbackOrHandoff(to, conversation);
  }

  // 6. Validação de botão antigo
  if (parsedMessage.buttonId) {
    const valid = isValidButtonForState(
      parsedMessage.buttonId,
      conversation.state,
      conversation.last_valid_button_set
    );

    if (!valid) {
      return;
    }
  }

  // 7. Switch principal por estado
  switch (conversation.state) {
    case STATES.MENU_ROOT:
      return handleMenuRoot(to, conversation, parsedMessage);

    case STATES.CHOOSING_MODALITY_PARTICULAR:
      return handleParticularModality(to, conversation, parsedMessage);

    case STATES.CHOOSING_MODALITY_ALICE:
      return handleAliceModality(to, conversation, parsedMessage);

    case STATES.WAITING_BOOKING:
      return handleWaitingBooking(to, conversation, parsedMessage);

    case STATES.BOOKED:
      return handleBookedState(to, conversation, parsedMessage);

    case STATES.WAITING_HUMAN:
      return;

    default:
      return handleFallbackOrHandoff(to, conversation);
  }
}

module.exports = {
  processInbound,
  handleFallbackOrHandoff,
};
