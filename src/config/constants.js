// ============================================
// CONSTANTS
// V1.1 - Controle de conversa e handoff
// ============================================

// ============================================
// Estados da Máquina
// ============================================
const STATES = {
  MENU_ROOT: "menu_root",
  CHOOSING_MODALITY_PARTICULAR: "choosing_modality_particular",
  CHOOSING_MODALITY_ALICE: "choosing_modality_alice",
  WAITING_BOOKING: "waiting_booking",
  WAITING_HUMAN: "waiting_human",
  BOOKED: "booked",
  CLOSED: "closed",
};

const VALID_STATES = Object.values(STATES);

// ============================================
// Button IDs
// IDs explícitos por contexto para evitar ambiguidade
// ============================================
const BUTTON_IDS = {
  BTN_PARTICULAR: "BTN_PARTICULAR",
  BTN_ALICE: "BTN_ALICE",
  BTN_OUTROS: "BTN_OUTROS",

  BTN_PARTICULAR_ONLINE: "BTN_PARTICULAR_ONLINE",
  BTN_PARTICULAR_PRESENCIAL: "BTN_PARTICULAR_PRESENCIAL",

  BTN_ALICE_ONLINE: "BTN_ALICE_ONLINE",
  BTN_ALICE_PRESENCIAL: "BTN_ALICE_PRESENCIAL",
};

// ============================================
// Button Sets Válidos por Estado
// ============================================
const BUTTON_SETS = {
  MAIN_MENU: "main_menu_v1",
  PARTICULAR_MODALITY: "particular_modality_v1",
  ALICE_MODALITY: "alice_modality_v1",
};

// ============================================
// Tipos de Mensagem
// ============================================
const MESSAGE_TYPES = {
  TEXT: "text",
  BUTTON: "button",
  MEDIA: "media",
  INTERACTIVE: "interactive",
  UNKNOWN: "unknown",
};

// ============================================
// Direção de Mensagem
// ============================================
const MESSAGE_DIRECTION = {
  INBOUND: "inbound",
  OUTBOUND: "outbound",
};

// ============================================
// Closed Reasons
// ============================================
const CLOSED_REASONS = {
  COMPLETED: "completed",
  ABANDONED: "abandoned",
  HUMAN_RESOLVED: "human_resolved",
  RESTARTED: "restarted",
};

// ============================================
// Match Confidence (Calendly <-> WhatsApp)
// ============================================
const MATCH_CONFIDENCE = {
  GOLD: "gold",
  SILVER: "silver",
  BRONZE: "bronze",
  NONE: "none",
};

// ============================================
// Comandos Globais
// ============================================
const MENU_COMMAND_KEYWORDS = [
  "menu",
  "reiniciar",
  "recomecar",
  "recomeçar",
];

const HUMAN_REQUEST_KEYWORDS = [
  "atendente",
  "humano",
  "secretaria",
  "secretária",
  "ajuda",
  "atendimento",
];

// ============================================
// Intenções Simples
// Não usar para NLP livre. Apenas atalhos controlados.
// ============================================
const SIMPLE_INTENT_KEYWORDS = {
  PARTICULAR: ["particular"],
  ALICE: ["alice"],
  ONLINE: ["online"],
  PRESENCIAL: ["presencial"],
  PRICE: ["preco", "preço", "valor"],
};

// ============================================
// Limites e Timeouts
// ============================================
const LIMITS = {
  MAX_MENU_ERRORS_BEFORE_HANDOFF: 1,
  BOOKING_TIMEOUT_MINUTES: 60,
  SESSION_TIMEOUT_MINUTES: 1440,
  HUMAN_SUPPRESS_HOURS: 2,
};

// ============================================
// Normalização
// ============================================
const NORMALIZATION = {
  REMOVE_ACCENTS: true,
  LOWERCASE: true,
  TRIM_SPACES: true,
};

module.exports = {
  STATES,
  VALID_STATES,
  BUTTON_IDS,
  BUTTON_SETS,
  MESSAGE_TYPES,
  MESSAGE_DIRECTION,
  CLOSED_REASONS,
  MATCH_CONFIDENCE,
  MENU_COMMAND_KEYWORDS,
  HUMAN_REQUEST_KEYWORDS,
  SIMPLE_INTENT_KEYWORDS,
  LIMITS,
  NORMALIZATION,
};
