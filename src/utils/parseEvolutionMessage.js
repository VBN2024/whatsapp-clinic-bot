'use strict';

/**
 * Parses an inbound Evolution API webhook payload into the internal
 * normalized message contract (same shape as parseInboundMessage).
 *
 * Returns null for:
 *  - non-message events (connection, qr, etc.)
 *  - outbound messages (fromMe = true)
 *  - group messages (@g.us)
 *  - any payload that cannot be parsed safely
 *
 * @param {object} body - Raw parsed JSON body from the Evolution webhook POST
 * @returns {{ externalMessageId: string, phone: string, name: string|null, type: string, payload: object } | null}
 */
function parseEvolutionMessage(body) {
  try {
    if (body?.event !== 'messages.upsert') return null;

    const data = body?.data;
    if (!data) return null;

    const key = data.key;
    if (!key) return null;

    // Ignore messages sent by the bot itself
    if (key.fromMe === true) return null;

    const remoteJid = key.remoteJid || '';

    // Ignore group messages
    if (remoteJid.endsWith('@g.us')) return null;

    // Strip the WhatsApp JID suffix to get a bare phone number
    const phone = remoteJid.replace('@s.whatsapp.net', '');
    if (!phone) return null;

    const externalMessageId = key.id;
    if (!externalMessageId) return null;

    const name = data.pushName || null;
    const type = normalizeEvolutionType(data.messageType);

    return { externalMessageId, phone, name, type, payload: data };
  } catch {
    return null;
  }
}

/**
 * Maps Evolution messageType values to the internal vocabulary.
 *
 * Evolution messageType reference:
 *   conversation / extendedTextMessage → text
 *   buttonsResponseMessage / listResponseMessage / templateButtonReplyMessage → button
 *   audioMessage / imageMessage / videoMessage / documentMessage / stickerMessage → media
 *   interactiveResponseMessage → interactive
 */
function normalizeEvolutionType(messageType) {
  switch (messageType) {
    case 'conversation':
    case 'extendedTextMessage':
      return 'text';

    case 'buttonsResponseMessage':
    case 'listResponseMessage':
    case 'templateButtonReplyMessage':
      return 'button';

    case 'audioMessage':
    case 'imageMessage':
    case 'videoMessage':
    case 'documentMessage':
    case 'stickerMessage':
      return 'media';

    case 'interactiveResponseMessage':
      return 'interactive';

    default:
      return 'unknown';
  }
}

module.exports = { parseEvolutionMessage };
