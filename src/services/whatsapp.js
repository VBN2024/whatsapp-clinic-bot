'use strict';

// 360dialog Cloud API — BSP for this clinic number.
// Auth: D360-API-KEY header (not Bearer token).
// The API key is already bound to the number in the 360dialog Hub;
// no phone_number_id is needed in the URL.
const DIALOG360_BASE_URL = 'https://waba.360dialog.io/v1/messages';

/**
 * Sends a plain text message via 360dialog Cloud API.
 *
 * Throws if the API returns a non-2xx status or if the required
 * environment variables are missing.
 *
 * @param {string} phone - Recipient phone in E.164 without leading '+' (e.g. "5511999999999")
 * @param {string} text  - Message body
 * @returns {Promise<string|null>} - The outbound message ID assigned by Meta, or null
 */
async function sendTextMessage(phone, text) {
  const apiKey = process.env.D360_API_KEY;

  if (!apiKey || apiKey === 'NOT_USED_YET') {
    throw new Error('360dialog credentials not configured (D360_API_KEY)');
  }

  const response = await fetch(DIALOG360_BASE_URL, {
    method: 'POST',
    headers: {
      'D360-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to:   phone,
      type: 'text',
      text: { body: text },
    }),
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(`360dialog API error ${response.status}: ${JSON.stringify(json)}`);
  }

  return json?.messages?.[0]?.id ?? null;
}

module.exports = { sendTextMessage };
