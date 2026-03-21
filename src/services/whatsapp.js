'use strict';

// 360dialog Cloud API — BSP for this clinic number.
// Auth: D360-API-KEY header (not Bearer token).
// The API key is already bound to the number in the 360dialog Hub;
// no phone_number_id is needed in the URL.
// NOTE: number is "Cloud API hosted by Meta" — requires the v2 endpoint.
const DIALOG360_BASE_URL = 'https://waba-v2.360dialog.io/messages';

function getApiKey() {
  const key = process.env.WHATSAPP_API_KEY_360D;
  if (!key || key.trim() === '') {
    throw new Error(
      'Credencial 360dialog ausente: defina WHATSAPP_API_KEY_360D no .env ou no ecosystem.config.js'
    );
  }
  return key.trim();
}

async function post360(body) {
  const response = await fetch(DIALOG360_BASE_URL, {
    method: 'POST',
    headers: {
      'D360-API-KEY': getApiKey(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const json = await response.json();

  if (!response.ok) {
    if (response.status === 401) {
      const key = process.env.WHATSAPP_API_KEY_360D || '';
      console.error(
        '[360dialog] 401 Invalid API token —',
        `len=${key.length}`,
        `tail=****${key.slice(-4)}`,
        '— verifique WHATSAPP_API_KEY_360D no .env ou gere nova key em wabamanagement.360dialog.io'
      );
    } else {
      console.error('[360dialog] API error', response.status, JSON.stringify(json));
    }
    throw new Error(`360dialog API error ${response.status}: ${JSON.stringify(json)}`);
  }

  const msgId = json?.messages?.[0]?.id ?? null;
  console.log('[360dialog] Message accepted, wamid:', msgId, '| to:', body.to, '| type:', body.type);
  return msgId;
}

/**
 * Sends a plain text message via 360dialog.
 *
 * @param {string} phone - Recipient in E.164 without leading '+' (e.g. "5511999999999")
 * @param {string} text  - Message body
 * @returns {Promise<string|null>} Outbound message ID assigned by Meta, or null
 */
async function sendTextMessage(phone, text) {
  return post360({
    messaging_product: 'whatsapp',
    to:   phone,
    type: 'text',
    text: { body: text },
  });
}

/**
 * Sends an interactive button message via 360dialog.
 *
 * WhatsApp limits: max 3 buttons, title ≤ 20 chars, id ≤ 256 chars.
 *
 * @param {string} phone     - Recipient in E.164 without leading '+'
 * @param {string} bodyText  - Message body shown above the buttons
 * @param {{ id: string, title: string }[]} buttons - 1–3 buttons
 * @returns {Promise<string|null>} Outbound message ID, or null
 */
async function sendInteractiveButtons(phone, bodyText, buttons) {
  return post360({
    messaging_product: 'whatsapp',
    to:   phone,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: buttons.map((b) => ({
          type:  'reply',
          reply: { id: b.id, title: b.title },
        })),
      },
    },
  });
}

module.exports = { sendTextMessage, sendInteractiveButtons };
