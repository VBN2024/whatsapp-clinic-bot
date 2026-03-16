'use strict';

const supabase = require('../utils/supabaseClient');

// ─── Contacts ────────────────────────────────────────────────────────────────

/**
 * Creates or retrieves a contact by phone number (thread-safe UPSERT).
 *
 * @param {string}      phone - E.164 without leading '+' (as sent by WhatsApp)
 * @param {string|null} name  - Display name from the WhatsApp contacts block
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

// ─── Conversations ────────────────────────────────────────────────────────────

/**
 * Returns the active conversation for a contact, or creates a new one
 * in the menu_root state. Handles the rare race condition where two
 * simultaneous inserts would violate the unique partial index.
 *
 * @param {string} contactId
 * @returns {Promise<{ id: string, state: string, handoff_human: boolean }>}
 */
async function upsertConversation(contactId) {
  const { data: existing, error: fetchError } = await supabase
    .from('conversations')
    .select('id, state, handoff_human')
    .eq('contact_id', contactId)
    .neq('state', 'closed')
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (existing) return existing;

  const { data, error } = await supabase
    .from('conversations')
    .insert({ contact_id: contactId, state: 'menu_root' })
    .select('id, state, handoff_human')
    .single();

  if (error) {
    // Race condition: another concurrent request created the conversation first
    if (error.code === '23505') {
      const { data: retry, error: retryError } = await supabase
        .from('conversations')
        .select('id, state, handoff_human')
        .eq('contact_id', contactId)
        .neq('state', 'closed')
        .single();
      if (retryError) throw retryError;
      return retry;
    }
    throw error;
  }

  return data;
}

/**
 * Updates fields on a conversation record.
 *
 * @param {string} conversationId
 * @param {object} fields - Partial fields to update (state, handoff_human, timestamps…)
 * @returns {Promise<void>}
 */
async function updateConversation(conversationId, fields) {
  const { error } = await supabase
    .from('conversations')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  if (error) throw error;
}

// ─── Message log ─────────────────────────────────────────────────────────────

/**
 * Logs a message (inbound or outbound).
 * Silently ignores duplicate external_message_id (idempotency).
 *
 * @param {string}      externalMessageId
 * @param {string}      contactId
 * @param {string|null} conversationId
 * @param {string}      messageType  - text | button | media | interactive | unknown
 * @param {object}      payload      - Full raw message object
 * @param {'inbound'|'outbound'} direction - defaults to 'inbound'
 * @returns {Promise<void>}
 */
async function logMessage(externalMessageId, contactId, conversationId, messageType, payload, direction = 'inbound') {
  const { error } = await supabase.from('message_log').insert({
    external_message_id: externalMessageId,
    contact_id:          contactId,
    conversation_id:     conversationId || null,
    direction,
    message_type:        messageType,
    payload,
  });

  if (error) {
    if (error.code === '23505') return; // duplicate — safe to ignore
    throw error;
  }
}

module.exports = { upsertContact, upsertConversation, updateConversation, logMessage };
