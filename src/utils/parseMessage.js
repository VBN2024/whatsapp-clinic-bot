'use strict';

/**
 * Extracts the minimum required fields from a Meta Cloud API webhook body.
 *
 * Returns null if the body does not contain a valid WhatsApp message event.
 *
 * @param {object} body - Raw parsed JSON body from the webhook POST request
 * @returns {{ externalMessageId: string, phone: string, type: string, payload: object } | null}
 */
function parseInboundMessage(body) {
  try {
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value?.messages?.length) {
      return null;
    }

    const message = value.messages[0];
    const contact = value.contacts?.[0];

    const externalMessageId = message.id;
    const phone = message.from; // E.164 without leading '+'
    const type = normalizeType(message.type);

    // Derive display name from contacts block when available
    const name = contact?.profile?.name || null;

    return { externalMessageId, phone, name, type, payload: message };
  } catch {
    return null;
  }
}

/**
 * Maps WhatsApp message types to the internal vocabulary defined in the spec.
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

module.exports = { parseInboundMessage };
