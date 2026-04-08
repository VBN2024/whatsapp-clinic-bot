'use strict'; const axios = require('axios'); const db = require('./db'); const { BUTTON_IDS, BUTTON_SETS, } = require('../config/constants'); const { WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, LINK_PARTICULAR_ONLINE, LINK_PARTICULAR_PRESENCIAL, LINK_ALICE_ONLINE, LINK_ALICE_PRESENCIAL, } = process.env; if (!WHATSAPP_ACCESS_TOKEN) { throw new Error('Missing environment variable: WHATSAPP_ACCESS_TOKEN'); } if (!WHATSAPP_PHONE_NUMBER_ID) { throw new Error('Missing environment variable: WHATSAPP_PHONE_NUMBER_ID'); } async function sendWhatsAppMessage(payload) { const url = `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`; const { data } = await axios.post(url, payload, { headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json', }, }); return data; } function buildReplyButtons(buttons) { return buttons.map((btn) => ({ type: 'reply', reply: { id: btn.id, title: btn.title, }, })); } async function sendInteractiveButtons(to, bodyText, buttons) { return sendWhatsAppMessage({ messaging_product: 'whatsapp', to, type: 'interactive', interactive: { type: 'button', body: { text: bodyText, }, action: { buttons: buildReplyButtons(buttons), }, }, }); } async function sendTextMessage(to, text) { return sendWhatsAppMessage({ messaging_product: 'whatsapp', to, type: 'text', text: { preview_url: false, body: text, }, }); } async function sendMainMenu(to, conversationId) { const text = 'Olá. Bem-vinda ao atendimento do Instituto Natale.

' + 'Para agendamento, escolha uma opção abaixo.
' + 'Se seu assunto for exame, receita, documento, resultado ou outra dúvida, toque em Outros assuntos.'; const response = await sendInteractiveButtons(to, text, [ { id: BUTTON_IDS.BTN_PARTICULAR, title: 'Agendar particular' }, { id: BUTTON_IDS.BTN_ALICE, title: 'Agendar Alice' }, { id: BUTTON_IDS.BTN_OUTROS, title: 'Outros assuntos' }, ]); if (conversationId) { await db.markMenuSent(conversationId, BUTTON_SETS.MAIN_MENU); } return response; } async function sendParticularModalityMenu(to, conversationId) { const text = 'Você deseja agendar consulta particular em qual modalidade?'; const response = await sendInteractiveButtons(to, text, [ { id: BUTTON_IDS.BTN_PARTICULAR_ONLINE, title: 'Consulta online' }, { id: BUTTON_IDS.BTN_PARTICULAR_PRESENCIAL, title: 'Consulta presencial' }, ]); if (conversationId) { await db.markMenuSent(conversationId, BUTTON_SETS.PARTICULAR_MODALITY); } return response; } async function sendAliceModalityMenu(to, conversationId) { const text = 'Para pacientes Alice, o primeiro atendimento é preferencialmente online. ' + 'Se necessário, o presencial pode ser definido depois.

' + 'Escolha a modalidade:'; const response = await sendInteractiveButtons(to, text, [ { id: BUTTON_IDS.BTN_ALICE_ONLINE, title: 'Consulta online' }, { id: BUTTON_IDS.BTN_ALICE_PRESENCIAL, title: 'Consulta presencial' }, ]); if (conversationId) { await db.markMenuSent(conversationId, BUTTON_SETS.ALICE_MODALITY); } return response; } async function sendHandoffMessage(to) { const text = 'Certo. Vou direcionar seu atendimento para a equipe.
' + 'Para voltar ao atendimento automático, envie MENU.'; return sendTextMessage(to, text); } async function sendFallbackMessage(to) { const text = 'Não consegui identificar seu pedido.
' + 'Se quiser recomeçar, envie MENU.
' + 'Se preferir falar com a equipe, escreva HUMANO.'; return sendTextMessage(to, text); } async function sendMediaFallbackMessage(to) { const text = 'Para o atendimento automático, funciona melhor se você escrever sua solicitação por texto.
' + 'Se quiser recomeçar, envie MENU.
' + 'Se preferir falar com a equipe, escreva HUMANO.'; return sendTextMessage(to, text); } async function sendBookingLink(to, kind, conversationId) { let text = ''; let lastBookingType = null; switch (kind) { case 'particular_online': text = 'Você pode agendar sua consulta particular online pelo link abaixo:

' + `${LINK_PARTICULAR_ONLINE}

` + 'Se quiser recomeçar, envie MENU.
' + 'Se preferir falar com a equipe, escreva HUMANO.'; lastBookingType = 'particular_online'; break; case 'particular_presencial': text = 'Você pode agendar sua consulta particular presencial pelo link abaixo:

' + `${LINK_PARTICULAR_PRESENCIAL}

` + 'Se quiser recomeçar, envie MENU.
' + 'Se preferir falar com a equipe, escreva HUMANO.'; lastBookingType = 'particular_presencial'; break; case 'alice_online': text = 'Você pode agendar sua consulta Alice online pelo link abaixo:

' + `${LINK_ALICE_ONLINE}

` + 'Se quiser recomeçar, envie MENU.
' + 'Se preferir falar com a equipe, escreva HUMANO.'; lastBookingType = 'alice_online'; break; case 'alice_presencial': text = 'Você pode agendar sua consulta Alice presencial pelo link abaixo:

' + `${LINK_ALICE_PRESENCIAL}

` + 'Se quiser recomeçar, envie MENU.
' + 'Se preferir falar com a equipe, escreva HUMANO.'; lastBookingType = 'alice_presencial'; break; default: throw new Error(`Invalid booking link kind: ${kind}`); } const response = await sendTextMessage(to, text); if (conversationId) { await db.updateConversation(conversationId, { state: 'waiting_booking', booking_link_sent_at: new Date().toISOString(), last_booking_type: lastBookingType, last_valid_button_set: null, fallback_count: 0, last_bot_message_at: new Date().toISOString(), }); } return response; } module.exports = { sendWhatsAppMessage, sendTextMessage, sendInteractiveButtons, sendMainMenu, sendParticularModalityMenu, sendAliceModalityMenu, sendHandoffMessage, sendFallbackMessage, sendMediaFallbackMessage, sendBookingLink, };