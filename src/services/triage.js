'use strict';

/**
 * Triage service — placeholder version (Etapa 2).
 *
 * Evaluates an inbound message and returns the action the bot should take.
 * This will be replaced by the full state machine in a future step.
 *
 * Possible actions:
 *   'skip'      — conversation is under human control; bot stays silent
 *   'send_link' — scheduling intent detected; send Calendly link
 *   'handoff'   — no match or explicit human request; hand off to human team
 */

const SCHEDULING_KEYWORDS = [
  'consulta', 'agendar', 'marcar', 'agenda',
  'atendimento', 'horario', 'disponivel', 'disponibilidade',
  'medico', 'medica', 'doutora', 'doutor', 'clinica',
];

const HUMAN_KEYWORDS = [
  'atendente', 'humano', 'secretaria', 'ajuda',
];

/**
 * Strips diacritics and lowercases a string for keyword matching.
 */
function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Evaluates the inbound message and returns a triage decision.
 *
 * @param {{ state: string, handoff_human: boolean }} conversation
 * @param {{ text: string|null, buttonId: string|null, type: string }} message
 * @returns {{ action: 'skip' | 'send_link' | 'handoff' }}
 */
function evaluate(conversation, message) {
  // Bot never responds when a human has taken over
  if (conversation.handoff_human) {
    return { action: 'skip' };
  }

  // Media messages — handoff per spec (V1 does not process media)
  if (message.type === 'media') {
    return { action: 'handoff' };
  }

  // Button IDs — handled by the full state machine (Etapa 2+)
  // For now, fall through to text analysis
  if (message.buttonId) {
    const id = message.buttonId.toUpperCase();
    if (id === 'BTN_OUTROS') return { action: 'handoff' };
    if (['BTN_PARTICULAR', 'BTN_ALICE', 'BTN_ONLINE', 'BTN_PRESENCIAL',
         'BTN_ALICE_ONLINE', 'BTN_ALICE_PRESENCIAL'].includes(id)) {
      return { action: 'send_link' };
    }
  }

  if (!message.text) {
    return { action: 'handoff' };
  }

  const normalized = normalize(message.text);

  if (HUMAN_KEYWORDS.some((k) => normalized.includes(k))) {
    return { action: 'handoff' };
  }

  if (SCHEDULING_KEYWORDS.some((k) => normalized.includes(k))) {
    return { action: 'send_link' };
  }

  return { action: 'handoff' };
}

module.exports = { evaluate };
