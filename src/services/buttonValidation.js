// Import constants
const { STATES, BUTTON_IDS, BUTTON_SETS } = require('../constants');

/**
 * Validates if a button is valid for a given state.
 * @param {string} buttonId - The ID of the button to validate.
 * @param {string} state - The current state to validate against.
 * @returns {boolean} - Returns true if the button is valid for the state, false otherwise.
 */
function isValidButtonForState(buttonId, state) {
    if (!BUTTON_IDS.includes(buttonId) || !STATES.includes(state)) {
        return false; // Invalid button ID or state
    }
    
    const validButtonSets = BUTTON_SETS[state];
    return validButtonSets ? validButtonSets.includes(buttonId) : false;
}

module.exports = { isValidButtonForState };