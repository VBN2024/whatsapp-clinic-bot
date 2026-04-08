'use strict';

const { STATES, BUTTON_IDS, BUTTON_SETS } = require('../config/constants');

/**
 * Verifica se o botão recebido é válido para o estado atual e para o último conjunto de botões enviado.
 *
 * @param {string|null} buttonId
 * @param {string} state
 * @param {string|null} lastValidButtonSet
 * @returns {boolean}
 */
function isValidButtonForState(buttonId, state, lastValidButtonSet) {
  if (!buttonId) return false;

  if (
    state === STATES.MENU_ROOT &&
    lastValidButtonSet === BUTTON_SETS.MAIN_MENU
  ) {
    return [
      BUTTON_IDS.BTN_PARTICULAR,
      BUTTON_IDS.BTN_ALICE,
      BUTTON_IDS.BTN_OUTROS,
    ].includes(buttonId);
  }

  if (
    state === STATES.CHOOSING_MODALITY_PARTICULAR &&
    lastValidButtonSet === BUTTON_SETS.PARTICULAR_MODALITY
  ) {
    return [
      BUTTON_IDS.BTN_PARTICULAR_ONLINE,
      BUTTON_IDS.BTN_PARTICULAR_PRESENCIAL,
    ].includes(buttonId);
  }

  if (
    state === STATES.CHOOSING_MODALITY_ALICE &&
    lastValidButtonSet === BUTTON_SETS.ALICE_MODALITY
  ) {
    return [
      BUTTON_IDS.BTN_ALICE_ONLINE,
      BUTTON_IDS.BTN_ALICE_PRESENCIAL,
    ].includes(buttonId);
  }

  return false;
}

module.exports = {
  isValidButtonForState,
};
