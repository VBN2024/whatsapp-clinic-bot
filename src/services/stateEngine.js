'use strict';

/**
 * State machine for the WhatsApp triage bot.
 *
 * Pure function — no side effects, no I/O.
 * The caller (webhook route) is responsible for executing the returned action.
 *
 * Action constants:
 *   SEND_MAIN_MENU               — send initial interactive button menu; → menu_root
 *   SEND_FALLBACK_MENU           — unknown text input; caller tracks consecutive error count
 *   SEND_PRICE_INFO              — price intent; send price text + main menu buttons
 *   SEND_MODALITY_PARTICULAR     — ask online / presencial (particular path); → choosing_modality
 *   SEND_MODALITY_ALICE          — ask online / presencial (Alice path);      → choosing_modality
 *   SEND_LINK_PARTICULAR_ONLINE  — send LINK_PARTICULAR_ONLINE;               → waiting_booking
 *   SEND_LINK_PARTICULAR_PRESENCIAL                                           → waiting_booking
 *   SEND_LINK_ALICE_ONLINE       — send LINK_ALICE_ONLINE;                    → waiting_booking
 *   SEND_LINK_ALICE_PRESENCIAL                                                → waiting_booking
 *   HANDOFF                      — hand off to human team;                    → waiting_human
 *   SKIP                         — bot stays silent; no state change
 */

const { classify } = require('./classifier');

/**
 * @param {{ state: string, handoff_human: boolean }} conversation
 * @param {{ type: string, text: string|null, buttonId: string|null }} message
 * @returns {string} action constant
 */
function decide(conversation, message) {
  // Human has taken over — bot stays silent unconditionally
  if (conversation.handoff_human) return 'SKIP';

  // Media messages — V1 does not process them → handoff
  if (message.type === 'media') return 'HANDOFF';

  const btn           = (message.buttonId || '').toUpperCase();
  const isButtonEvent = message.type === 'interactive' || message.type === 'button';

  // ── Button events: route by button ID within current state ────────────────
  if (isButtonEvent && btn) {
    switch (conversation.state) {
      case 'menu_root':
        if (btn === 'BTN_PARTICULAR') return 'SEND_MODALITY_PARTICULAR';
        if (btn === 'BTN_ALICE')      return 'SEND_MODALITY_ALICE';
        if (btn === 'BTN_OUTROS')     return 'HANDOFF';
        return 'SEND_MAIN_MENU';

      case 'choosing_modality':
        if (btn === 'BTN_ONLINE')           return 'SEND_LINK_PARTICULAR_ONLINE';
        if (btn === 'BTN_PRESENCIAL')       return 'SEND_LINK_PARTICULAR_PRESENCIAL';
        if (btn === 'BTN_ALICE_ONLINE')     return 'SEND_LINK_ALICE_ONLINE';
        if (btn === 'BTN_ALICE_PRESENCIAL') return 'SEND_LINK_ALICE_PRESENCIAL';
        return 'SEND_MAIN_MENU';

      case 'waiting_booking':
      case 'waiting_human':
      case 'booked':
        return 'SKIP';

      default:
        return 'SEND_MAIN_MENU';
    }
  }

  // ── Free text: classify intent and route ──────────────────────────────────
  if (message.type === 'text' && message.text) {
    // States where the bot stays silent regardless of what the user types
    if (conversation.state === 'waiting_human' || conversation.state === 'booked') {
      return 'SKIP';
    }

    const intent = classify(message.text);

    switch (intent) {
      case 'human':      return 'HANDOFF';
      case 'price':      return 'SEND_PRICE_INFO';
      case 'alice':      return 'SEND_MODALITY_ALICE';
      case 'particular': return 'SEND_MODALITY_PARTICULAR';
      case 'greeting':
      case 'scheduling': return 'SEND_MAIN_MENU';
      default:
        // Unknown intent — fallback; caller tracks consecutive unknowns
        return 'SEND_FALLBACK_MENU';
    }
  }

  // No text, no button (e.g. status delivery events slipping through)
  return 'SKIP';
}

module.exports = { decide };
