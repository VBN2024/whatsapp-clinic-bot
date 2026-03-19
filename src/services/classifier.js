'use strict';

/**
 * Intent classifier — rule-based keyword matching, no external dependencies.
 *
 * Priority order matters: human > price > alice > particular > scheduling > greeting > unknown.
 * Each entry is checked in sequence; first match wins.
 */

const INTENT_RULES = [
  {
    intent:   'human',
    keywords: ['humano', 'atendente', 'secretaria', 'secretária', 'ajuda'],
  },
  {
    intent:   'price',
    keywords: ['preço', 'preco', 'valor', 'quanto custa', 'custo'],
  },
  {
    intent:   'alice',
    keywords: ['alice', 'convenio', 'convênio'],
  },
  {
    intent:   'particular',
    keywords: ['particular'],
  },
  {
    intent:   'scheduling',
    keywords: [
      'consulta', 'agendar', 'marcar', 'quero consulta',
      'agenda', 'horario', 'horário', 'atendimento',
      'disponivel', 'disponibilidade', 'medico', 'médico',
      'medica', 'médica', 'doutora', 'doutor', 'clinica', 'clínica',
    ],
  },
  {
    intent:   'greeting',
    keywords: ['oi', 'ola', 'olá', 'bom dia', 'boa tarde', 'boa noite', 'boas', 'hello', 'hi'],
  },
];

/**
 * Strips diacritics and lowercases a string for comparison.
 */
function normalize(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Classifies a free-text message into one of the known intents.
 *
 * @param {string} text - Raw message text from the user
 * @returns {'human'|'price'|'alice'|'particular'|'scheduling'|'greeting'|'unknown'}
 */
function classify(text) {
  const n = normalize(text);
  for (const { intent, keywords } of INTENT_RULES) {
    if (keywords.some((k) => new RegExp(`\\b${normalize(k)}\\b`).test(n))) {
      return intent;
    }
  }
  return 'unknown';
}

module.exports = { classify };
