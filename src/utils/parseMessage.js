'use strict';

/**
 * Extracts the minimum required fields from a Meta Cloud API webhook body.
 *
 * Returns null if the body does not contain a valid WhatsApp message event.
 *
 * @param {object} body - Raw parsed JSON body from the webhook POST request
 * @returns {{
 *   externalMessageId: string,
 *   phone: string,
 *   name: string|null,
 *   type: string,
 *   text: string|null,
 *   buttonId: string|null,
 *   timestamp: string,
 *   payload: object
 * } | null}
 */
function parseInboundMessage(body) {
  try {
    const entry   = body?.entry?.[0];
    const change  = entry?.changes?.[0];
    const value   = change?.value;

    if (!value?.messages?.length) return null;

    const message = value.messages[0];
    const contact = value.contacts?.[0];

    const externalMessageId = message.id;
    const phone             = message.from; // E.164 without leading '+'
    const name              = contact?.profile?.name || null;
    const type              = normalizeType(message.type);
    const text              = extractText(message);
    const buttonId          = extractButtonId(message);
    const timestamp         = message.timestamp
      ? new Date(parseInt(message.timestamp, 10) * 1000).toISOString()
      : new Date().toISOString();

    return { externalMessageId, phone, name, type, text, buttonId, timestamp, payload: message };
  } catch {
    return null;
  }
}

/**
 * Maps Meta Cloud API message types to the internal vocabulary defined in the spec.
 */
function normalizeType(rawType) {
  switch (rawType) {
    case 'text':        return 'text';
    case 'button':      return 'button';
    case 'interactive': return 'interactive';
    case 'audio':
    case 'image':
    case 'video':
    case 'document':
    case 'sticker':     return 'media';
    default:            return 'unknown';
  }
}

/**
 * Extracts the human-readable text body from a message of any type.
 */
function extractText(message) {
  switch (message.type) {
    case 'text':
      return message.text?.body || null;
    case 'button':
      return message.button?.text || null;
    case 'interactive': {
      const i = message.interactive;
      if (i?.type === 'button_reply') return i.button_reply?.title || null;
      if (i?.type === 'list_reply')   return i.list_reply?.title   || null;
      return null;
    }
    default:
      return null;
  }
}

/**
 * Extracts the button/list payload ID for routing in the state machine.
 *
 * Meta sends button clicks in two ways:
 *   - Template button:   message.type === 'button',      message.button.payload
 *   - Interactive reply: message.type === 'interactive', message.interactive.button_reply.id
 */
function extractButtonId(message) {
  if (message.type === 'button') {
    return message.button?.payload || null;
  }
  if (message.type === 'interactive') {
    const i = message.interactive;
    if (i?.type === 'button_reply') return i.button_reply?.id || null;
    if (i?.type === 'list_reply')   return i.list_reply?.id   || null;
  }
  return null;
}

module.exports = { parseInboundMessage };
