'use strict';

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Creates or retrieves a contact by phone number (thread-safe UPSERT).
 *
 * @param {string} phone  - Phone in E.164 format WITHOUT leading '+' (as sent by WhatsApp)
 * @param {string|null} name - Display name from WhatsApp contacts block
 * @returns {Promise<{ id: string }>}
 */
async function upsertContact(phone, name) {
  const phoneE164 = phone.startsWith('+') ? phone : `+${phone}`;

  const { data, error } = await supabase
    .from('contacts')
    .upsert(
      { phone_e164: phoneE164, name: name || null, updated_at: new Date().toISOString() },
      { onConflict: 'phone_e164', ignoreDuplicates: false }
    )
    .select('id')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Logs an inbound message. Silently ignores duplicate external_message_id (idempotency).
 *
 * @param {string} externalMessageId
 * @param {string} contactId
 * @param {string} messageType - text | button | media | interactive | unknown
 * @param {object} payload     - Full raw message object
 * @returns {Promise<void>}
 */
async function logMessage(externalMessageId, contactId, messageType, payload) {
  const { error } = await supabase.from('message_log').insert({
    external_message_id: externalMessageId,
    contact_id: contactId,
    direction: 'inbound',
    message_type: messageType,
    payload,
  });

  if (error) {
    // Unique constraint violation = duplicate message; safe to ignore
    if (error.code === '23505') return;
    throw error;
  }
}

module.exports = { upsertContact, logMessage };
