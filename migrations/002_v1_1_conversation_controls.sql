-- ============================================
-- MIGRATION 002: V1.1 Conversation Controls
-- ============================================

-- 1) Novos campos de controle
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS bot_suppressed_until TIMESTAMP NULL;

ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS last_user_message_at TIMESTAMP NULL;

ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS last_human_message_at TIMESTAMP NULL;

ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS last_menu_sent_at TIMESTAMP NULL;

ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS fallback_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS last_booking_type VARCHAR(50) NULL;

ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS last_valid_button_set VARCHAR(50) NULL;

-- 2) Migrar estado antigo para o novo modelo
-- Como o estado antigo era genérico, a conversão segura é mandar tudo para menu_root
UPDATE conversations
SET state = 'menu_root'
WHERE state = 'choosing_modality';

-- 3) Recriar constraint de states
ALTER TABLE conversations
DROP CONSTRAINT IF EXISTS conversations_state_check;

ALTER TABLE conversations
ADD CONSTRAINT conversations_state_check CHECK (
  state IN (
    'menu_root',
    'choosing_modality_particular',
    'choosing_modality_alice',
    'waiting_booking',
    'waiting_human',
    'booked',
    'closed'
  )
);

-- 4) Índices auxiliares
CREATE INDEX IF NOT EXISTS idx_conversations_bot_suppressed_until
ON conversations(bot_suppressed_until);

CREATE INDEX IF NOT EXISTS idx_conversations_last_human_message_at
ON conversations(last_human_message_at);

CREATE INDEX IF NOT EXISTS idx_conversations_last_valid_button_set
ON conversations(last_valid_button_set);
