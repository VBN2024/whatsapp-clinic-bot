'use strict';

const supabase = require('../utils/supabaseClient');

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
      {
        phone_e164: phoneE164,
        name: name || null,
        updated_at: new Date().toISOString(),
      },
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

/**
 * Fetches the active conversation for a contact.
 * Rule: at most one active conversation per contact (state != 'closed')
 *
 * @param {string} contactId
 * @returns {Promise<object|null>}
 */
async function getActiveConversation(contactId) {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('contact_id', contactId)
    .neq('state', 'closed')
    .limit(1);

  if (error) throw error;
  return data?.[0] || null;
}

/**
 * Creates a new conversation.
 *
 * @param {string} contactId
 * @param {string} initialState
 * @returns {Promise<object>}
 */
async function createConversation(contactId, initialState = 'menu_root') {
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      contact_id: contactId,
      state: initialState,
      handoff_human: false,
      fallback_count: 0,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Fetches the active conversation or creates one if none exists.
 *
 * @param {string} contactId
 * @returns {Promise<object>}
 */
async function getOrCreateActiveConversation(contactId) {
  const existing = await getActiveConversation(contactId);
  if (existing) return existing;

  return createConversation(contactId, 'menu_root');
}

/**
 * Updates a conversation with a partial patch.
 *
 * @param {string} conversationId
 * @param {object} patch
 * @returns {Promise<object>}
 */
async function updateConversation(conversationId, patch) {
  const { data, error } = await supabase
    .from('conversations')
    .update(patch)
    .eq('id', conversationId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Resets conversation to the main menu state.
 *
 * @param {string} conversationId
 * @returns {Promise<object>}
 */
async function resetConversationToMenu(conversationId) {
  return updateConversation(conversationId, {
    state: 'menu_root',
    handoff_human: false,
    handoff_at: null,
    bot_suppressed_until: null,
    fallback_count: 0,
    last_valid_button_set: 'main_menu_v1',
  });
}

/**
 * Activates human handoff.
 *
 * @param {string} conversationId
 * @returns {Promise<object>}
 */
async function activateHumanHandoff(conversationId) {
  return updateConversation(conversationId, {
    state: 'waiting_human',
    handoff_human: true,
    handoff_at: new Date().toISOString(),
    fallback_count: 0,
    last_valid_button_set: null,
  });
}

/**
 * Increments fallback count by 1.
 *
 * @param {string} conversationId
 * @param {number} currentCount
 * @returns {Promise<object>}
 */
async function incrementFallbackCount(conversationId, currentCount = 0) {
  return updateConversation(conversationId, {
    fallback_count: currentCount + 1,
  });
}

/**
 * Updates timestamp for latest user message.
 *
 * @param {string} conversationId
 * @returns {Promise<object>}
 */
async function touchUserMessage(conversationId) {
  return updateConversation(conversationId, {
    last_user_message_at: new Date().toISOString(),
  });
}

/**
 * Marks that a menu/button set was sent by the bot.
 *
 * @param {string} conversationId
 * @param {string} buttonSet
 * @returns {Promise<object>}
 */
async function markMenuSent(conversationId, buttonSet) {
  const now = new Date().toISOString();

  return updateConversation(conversationId, {
    last_bot_message_at: now,
    last_menu_sent_at: now,
    last_valid_button_set: buttonSet,
  });
}

module.exports = {
  upsertContact,
  logMessage,
  getActiveConversation,
  createConversation,
  getOrCreateActiveConversation,
  updateConversation,
  resetConversationToMenu,
  activateHumanHandoff,
  incrementFallbackCount,
  touchUserMessage,
  markMenuSent,
};