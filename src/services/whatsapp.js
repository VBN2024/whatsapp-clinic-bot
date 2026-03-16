'use strict';

const GRAPH_API_VERSION = 'v18.0';

/**
 * Sends a plain text message via Meta WhatsApp Cloud API.
 *
 * Throws if the API returns a non-2xx status or if the required
 * environment variables are missing.
 *
 * @param {string} phone - Recipient phone in E.164 without leading '+' (e.g. "5511999999999")
 * @param {string} text  - Message body
 * @returns {Promise<string|null>} - The outbound message ID assigned by Meta, or null
 */
async function sendTextMessage(phone, text) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken   = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken ||
      phoneNumberId === 'NOT_USED_YET' || accessToken === 'NOT_USED_YET') {
    throw new Error('WhatsApp Cloud API credentials not configured (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN)');
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type':  'application/json',
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
    throw new Error(`Meta API error ${response.status}: ${JSON.stringify(json)}`);
  }

  return json?.messages?.[0]?.id ?? null;
}

module.exports = { sendTextMessage };
