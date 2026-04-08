---

# 🔄 Atualização V1.1 — Governança de Conversa (CRÍTICO)

## Contexto

A infraestrutura do sistema foi validada e estabilizada:
- Webhook funcionando
- Persistência no Supabase funcionando
- Integração com WhatsApp validada
- Fluxo principal de menu e envio de links operacional

O principal problema atual NÃO é técnico de infraestrutura.

O gargalo atual é comportamental:
> o bot está interferindo indevidamente em conversas entre paciente e humano

---

## Problema identificado

- Bot responde a mensagens fora do fluxo
- Bot reenvia menu no meio de conversa humana
- Bot interpreta mensagens contextuais como nova triagem
- Botões antigos reativam fluxos indevidos

Isso degrada a experiência e reduz confiança no atendimento.

---

## Decisão V1.1 (OBRIGATÓRIA)

A partir desta versão, o bot passa a operar com controle rígido de contexto.

### Regra central

> Na dúvida, o bot NÃO responde

---

## Regras operacionais V1.1

### 1. Handoff humano é soberano

Se `state = waiting_human`:
- bot NÃO responde
- bot NÃO interpreta mensagem
- bot NÃO envia menu
- única exceção: comando `MENU`

---

### 2. Retomada do bot

O bot só retoma o controle se o usuário enviar:

- `menu`
- `reiniciar`
- `recomeçar`

Ação:
- resetar estado para `menu_root`
- limpar handoff
- enviar menu principal

---

### 3. Fallback limitado

- máximo de 1 tentativa de fallback
- na segunda falha → handoff automático
- proibido loop de fallback

---

### 4. Botões antigos

Botões antigos no histórico do WhatsApp:

- NÃO devem reativar fluxo
- devem ser ignorados se não compatíveis com o estado atual

---

### 5. Pós-envio de link (waiting_booking)

Após envio de link:

- bot NÃO deve reabrir menu automaticamente
- bot NÃO deve tentar resolver assuntos fora de escopo
- no máximo 1 fallback → depois handoff

---

### 6. Mídia (áudio, imagem, etc)

- se bot ativo → responder uma vez orientando texto
- se insistir → handoff
- se em handoff → silêncio

---

## Novos campos obrigatórios (conversations)

- `fallback_count`
- `last_valid_button_set`
- `bot_suppressed_until` (opcional)
- `last_human_message_at` (opcional)

---

## Critério de aceite da V1.1

A versão só é válida se:

- bot NÃO interrompe conversa humana
- `MENU` reinicia corretamente
- fallback NÃO entra em loop
- botões antigos NÃO quebram o fluxo
- mensagens livres NÃO geram menu automático indevido

---

## Prioridade técnica atual

Foco exclusivo:

1. controle de handoff
2. controle de fallback
3. validação de contexto
4. silêncio do bot quando necessário

---

## Fora de escopo (por enquanto)

NÃO implementar agora:

- NLP avançado
- respostas automáticas sobre exames/documentos
- lógica complexa de intenção
- novas integrações

---

## Diretriz final

Este sistema agora é um sistema de controle de conversa, não apenas de resposta automática.

> responder menos é melhor do que responder errado

---
