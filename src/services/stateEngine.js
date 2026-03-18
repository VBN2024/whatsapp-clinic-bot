'use strict';

/**
 * State machine for the WhatsApp triage bot.
 *
 * Pure function — no side effects, no I/O.
 * The caller (webhook route) is responsible for executing the returned action.
 *
 * Action constants:
 *   SEND_MAIN_MENU               — send initial interactive button menu; stays in menu_root
 *   SEND_MODALITY_PARTICULAR     — ask online / presencial (particular path); → choosing_modality
 *   SEND_MODALITY_ALICE          — ask online / presencial (Alice path);      → choosing_modality
 *   SEND_LINK_PARTICULAR_ONLINE  — send LINK_PARTICULAR_ONLINE;               → waiting_booking
 *   SEND_LINK_PARTICULAR_PRESENCIAL                                           → waiting_booking
 *   SEND_LINK_ALICE_ONLINE       — send LINK_ALICE_ONLINE;                    → waiting_booking
 *   SEND_LINK_ALICE_PRESENCIAL                                                → waiting_booking
 *   HANDOFF                      — hand off to human team;                    → waiting_human
 *   SKIP                         — bot stays silent; no state change
 */

const HUMAN_KEYWORDS = ['atendente', 'humano', 'secretaria', 'ajuda'];

function normalize(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function hasHumanKeyword(text) {
  const n = normalize(text);
  return HUMAN_KEYWORDS.some((k) => n.includes(k));
}

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

  // Explicit human keyword in any active state → handoff
  if (message.text && hasHumanKeyword(message.text)) return 'HANDOFF';

  const btn = (message.buttonId || '').toUpperCase();

  switch (conversation.state) {
    case 'menu_root':
      if (btn === 'BTN_PARTICULAR') return 'SEND_MODALITY_PARTICULAR';
      if (btn === 'BTN_ALICE')      return 'SEND_MODALITY_ALICE';
      if (btn === 'BTN_OUTROS')     return 'HANDOFF';
      // Any free text or unknown event → show main menu
      return 'SEND_MAIN_MENU';

    case 'choosing_modality':
      if (btn === 'BTN_ONLINE')           return 'SEND_LINK_PARTICULAR_ONLINE';
      if (btn === 'BTN_PRESENCIAL')       return 'SEND_LINK_PARTICULAR_PRESENCIAL';
      if (btn === 'BTN_ALICE_ONLINE')     return 'SEND_LINK_ALICE_ONLINE';
      if (btn === 'BTN_ALICE_PRESENCIAL') return 'SEND_LINK_ALICE_PRESENCIAL';
      // Out-of-flow input → reset to main menu
      return 'SEND_MAIN_MENU';

    case 'waiting_booking':
    case 'waiting_human':
    case 'booked':
      return 'SKIP';

    default:
      // 'closed' or unknown — upsertConversation already created a fresh menu_root row
      return 'SEND_MAIN_MENU';
  }
}

module.exports = { decide };
