// ============================================
// INBOUND PARSER
// Padroniza mensagens recebidas do WhatsApp
// ============================================

const { MESSAGE_TYPES } = require("../config/constants");

/**
 * Extrai texto bruto mais útil possível da mensagem
 * @param {Object} message
 * @returns {string|null}
 */
function extractRawText(message = {}) {
  if (message.text?.body) {
    return message.text.body;
  }

  if (message.button?.text) {
    return message.button.text;
  }

  if (message.interactive?.button_reply?.title) {
    return message.interactive.button_reply.title;
  }

  if (message.interactive?.list_reply?.title) {
    return message.interactive.list_reply.title;
  }

  return null;
}

/**
 * Extrai button ID, quando existir
 * @param {Object} message
 * @returns {string|null}
 */
function extractButtonId(message = {}) {
  if (message.interactive?.button_reply?.id) {
    return message.interactive.button_reply.id;
  }

  if (message.button?.payload) {
    return message.button.payload;
  }

  return null;
}

/**
 * Classifica o tipo de mensagem em padrão interno
 * @param {Object} message
 * @returns {string}
 */
function detectMessageType(message = {}) {
  if (message.text) return MESSAGE_TYPES.TEXT;

  if (message.interactive?.button_reply || message.interactive?.list_reply) {
    return MESSAGE_TYPES.INTERACTIVE;
  }

  if (message.button) return MESSAGE_TYPES.BUTTON;

  if (
    message.image ||
    message.audio ||
    message.video ||
    message.document ||
    message.sticker
  ) {
    return MESSAGE_TYPES.MEDIA;
  }

  return MESSAGE_TYPES.UNKNOWN;
}

/**
 * Faz o parse padronizado da mensagem inbound
 * @param {Object} message
 * @returns {{
 *   type: string,
 *   text: string|null,
 *   buttonId: string|null,
 *   raw: Object,
 *   isMedia: boolean,
 *   isInteractive: boolean
 * }}
 */
function parseInboundMessage(message = {}) {
  const type = detectMessageType(message);
  const text = extractRawText(message);
  const buttonId = extractButtonId(message);

  return {
    type,
    text,
    buttonId,
    raw: message,
    isMedia: type === MESSAGE_TYPES.MEDIA,
    isInteractive:
      type === MESSAGE_TYPES.INTERACTIVE || type === MESSAGE_TYPES.BUTTON,
  };
}

module.exports = {
  extractRawText,
  extractButtonId,
  detectMessageType,
  parseInboundMessage,
};
