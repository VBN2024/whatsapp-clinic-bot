// ============================================
// NORMALIZE UTILS
// Funções utilitárias de normalização de texto
// ============================================

/**
 * Remove acentos de uma string
 * @param {string} text
 * @returns {string}
 */
function removeAccents(text = "") {
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Normaliza texto para comparação semântica simples
 * - remove acentos
 * - lowercase
 * - trim
 * - colapsa múltiplos espaços
 *
 * @param {string} text
 * @returns {string}
 */
function normalizeText(text = "") {
  return removeAccents(text)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Verifica se o texto contém qualquer keyword
 * @param {string} text
 * @param {string[]} keywords
 * @returns {boolean}
 */
function includesAnyKeyword(text = "", keywords = []) {
  const normalized = normalizeText(text);

  return keywords.some((keyword) =>
    normalized.includes(normalizeText(keyword))
  );
}

module.exports = {
  removeAccents,
  normalizeText,
  includesAnyKeyword,
};
