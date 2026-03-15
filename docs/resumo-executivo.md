Sistema de Triagem e Agendamento via WhatsApp

Metadados do Documento



Campo	Valor
Projeto	Automação de triagem e agendamento clínico
Versão do Documento	1.0
Data	2024
Status	Etapa 1 Congelada
Fonte de Verdade	Sim (este documento)


Este documento define escopo, arquitetura, comportamento e regras operacionais da V1.
Qualquer alteração funcional deve atualizar este documento antes da implementação.

1. Objetivo do Projeto
Implementar um sistema automatizado no WhatsApp Business capaz de:
	1.	Classificar pacientes em três categorias iniciais:
	∙	Consulta particular
	∙	Consulta via convênio Alice
	∙	Outros assuntos
	2.	Direcionar pacientes para o link correto de agendamento no Calendly
	3.	Reduzir carga operacional da secretária em tarefas repetitivas de triagem
	4.	Registrar dados estruturados sobre cada interação para análise posterior
O sistema não substitui atendimento humano.
Ele apenas executa triagem estruturada e envio de links de agendamento.

2. Escopo da V1
A primeira versão tem escopo deliberadamente limitado.
O sistema faz
	∙	✅ Valida webhook da Meta Cloud API
	∙	✅ Extrai campos mínimos da mensagem
	∙	✅ Garante idempotência via external_message_id
	∙	✅ Cria ou obtém contato (thread-safe com UPSERT)
	∙	✅ Grava mensagem em message_log (crua, sem processamento)
	∙	✅ Retorna 200 OK para Meta
	∙	✅ Logging estruturado
O sistema não faz
	∙	❌ Processamento de áudio
	∙	❌ Interpretação de linguagem natural complexa
	∙	❌ Respostas clínicas
	∙	❌ Remarcação automática
	∙	❌ Lembretes de consulta
	∙	❌ Atendimento administrativo completo
	∙	❌ State machine
	∙	❌ Triagem automática
	∙	❌ Envio de mensagens
	∙	❌ Integração com Calendly
Essas funções podem ser consideradas Fase 2+.

3. Fluxo Funcional do Paciente
Fluxo simplificado (Etapa 1):

Paciente envia mensagem
         ↓
    Webhook da Meta
         ↓
Validar token
         ↓
Extrair dados
         ↓
Verificar idempotência
         ↓
UPSERT contact
         ↓
Gravar message_log
         ↓
Resposta 200 OK


Fluxo completo (após Etapas 2+):

Paciente envia mensagem
         ↓
Bot apresenta menu inicial
         ↓
Paciente escolhe categoria
         ↓
Bot envia link de agendamento
         ↓
Paciente agenda no Calendly
         ↓
Webhook confirma agendamento
         ↓
Sistema atualiza estado para booked


Exceções levam ao handoff humano.

4. Árvore de Decisão do Bot
Mensagem Inicial

Olá! Bem-vinda ao atendimento da clínica da Dra. Vivian Natale.
Como podemos ajudar?

Botões:
• Consulta particular (BTN_PARTICULAR)
• Consulta pelo convênio Alice (BTN_ALICE)
• Outros assuntos (BTN_OUTROS)


Fluxo — Consulta Particular

As consultas particulares com a Dra. Vivian Natale podem ser 
realizadas online ou presencialmente.

Qual modalidade você prefere?

Botões:
• Consulta online (BTN_ONLINE)
• Consulta presencial (BTN_PRESENCIAL)


Particular — Online

Você pode agendar a consulta online diretamente pelo link abaixo:

Agendar consulta online:
[LINK_PARTICULAR_ONLINE]

Se precisar de ajuda com o agendamento, é só avisar.


Particular — Presencial

Você pode agendar a consulta presencial diretamente pelo link abaixo:

Agendar consulta presencial:
[LINK_PARTICULAR_PRESENCIAL]

Se precisar de ajuda com o agendamento, é só avisar.


Fluxo — Convênio Alice

Para consultas pelo convênio Alice, priorizamos o atendimento 
online, que costuma ter agenda mais rápida.

Nessa consulta, a Dra. Vivian avalia sua queixa com calma e, 
se for necessário exame físico, poderá orientar o atendimento 
presencial depois.

Botões:
• Agendar consulta online (BTN_ALICE_ONLINE)
• Prefiro consulta presencial (BTN_ALICE_PRESENCIAL)


Alice — Online

Você pode agendar a consulta online diretamente pelo link abaixo:

Agendar consulta online:
[LINK_ALICE_ONLINE]

Se precisar de ajuda com o agendamento, é só avisar.


Alice — Presencial

Você pode agendar a consulta presencial pelo convênio Alice 
no link abaixo:

Agendar consulta presencial:
[LINK_ALICE_PRESENCIAL]

Se precisar de ajuda com o agendamento, é só avisar.


Fluxo — Outros Assuntos

Certo! Vou encaminhar sua mensagem para a equipe da clínica.

Em breve alguém do time retorna para ajudar.

[HANDOFF PARA HUMANO]


Fallback (Mensagem Fora do Fluxo)

Para facilitar o atendimento, escolha uma das opções abaixo:

Botões:
• Consulta particular (BTN_PARTICULAR)
• Consulta pelo convênio Alice (BTN_ALICE)
• Outros assuntos (BTN_OUTROS)


5. Estados do Sistema
Cada conversa possui um estado persistido no banco.



Estado	Descrição	Quando Entra	Como Sai
menu_root	Menu inicial / ponto de retorno	Início da conversa ou comando “menu”	Usuário escolhe uma opção
choosing_modality	Escolha entre consulta online/presencial	Usuário escolhe “Consulta particular”	Usuário escolhe a modalidade
waiting_booking	Link enviado, aguardando agendamento	Após envio do link de agendamento	Webhook do Calendly, timeout ou handoff
waiting_human	Conversa bloqueada aguardando humano	Recebe mídia, keyword, erro 2x ou “Outros assuntos”	Apenas com comando “menu”
booked	Agendamento confirmado	Webhook do Calendly com correspondência	Estado terminal (pode voltar com “menu”)
closed	Conversa encerrada	Timeout no estado waiting_booking	Estado terminal (pode voltar com “menu`)


Regra crítica: Uma única conversa ATIVA por contato (state != ‘closed’)

6. Regras de Handoff Humano
O bot deve interromper automação nos seguintes casos:
Mensagem de Mídia
Se paciente enviar:
	∙	áudio
	∙	imagem
	∙	vídeo
	∙	documento
Motivo: V1 não processa mídia
Pedido Explícito de Humano
Palavras-chave:
	∙	atendente
	∙	humano
	∙	secretária
	∙	ajuda
Erro Repetido de Menu
Se o paciente errar opção 2 vezes consecutivas
Comportamento Após Handoff
	∙	handoff_human = true
	∙	Bot não responde mais
	∙	Apenas comando “menu” reativa automação
	∙	Secretária pode assumir conversa manualmente

7. Integração com Calendly
O Calendly é responsável por:
	∙	Interface de agendamento
	∙	Validação de horário
	∙	Escrita do evento no Google Calendar
O sistema apenas:
	∙	Envia o link
	∙	Escuta o webhook de confirmação

8. Papel do Google Calendar
Google Calendar é a fonte de verdade da agenda.
Funções:
	∙	Bloquear horários indisponíveis
	∙	Evitar double booking
	∙	Registrar eventos confirmados
Calendly lê o Google Calendar para saber disponibilidade.

9. Reconciliação WhatsApp ↔ Calendly
Quando um agendamento ocorre, o sistema tenta identificar qual conversa originou o booking.
Match Ouro (GOLD)
Critério: Telefone idêntico ao WhatsApp
Resultado: Match automático
Match Prata (SILVER)
Critério: Últimos 9 dígitos + email coincidente
Resultado: Match automático
Match Bronze (BRONZE)
Critério: Nome coincide + link enviado recentemente
Resultado: Marcado como provável match
Sem Match (NONE)
Critério: Nenhuma correspondência
Resultado: Cria agendamento órfão

10. Estrutura de Banco de Dados
Tabela: contacts
Registro único por paciente.
Campos principais:
	∙	id (UUID, PK)
	∙	phone_e164 (VARCHAR, UNIQUE) — formato E.164: +5511999999999
	∙	name (VARCHAR)
	∙	email (VARCHAR)
	∙	created_at (TIMESTAMP)
	∙	updated_at (TIMESTAMP)
Índices:
	∙	idx_contacts_phone_e164
	∙	idx_contacts_email
Tabela: conversations
Estado da interação.
Campos principais:
	∙	id (UUID, PK)
	∙	contact_id (FK → contacts)
	∙	state (VARCHAR) — menu_root | choosing_modality | waiting_booking | waiting_human | booked | closed
	∙	handoff_human (BOOLEAN)
	∙	last_bot_message_at (TIMESTAMP)
	∙	booking_link_sent_at (TIMESTAMP)
	∙	booked_at (TIMESTAMP)
	∙	handoff_at (TIMESTAMP)
	∙	closed_at (TIMESTAMP)
	∙	closed_reason (VARCHAR) — completed | abandoned | human_resolved | restarted
	∙	created_at (TIMESTAMP)
	∙	updated_at (TIMESTAMP)
Índices:
	∙	idx_conversations_contact_id
	∙	idx_conversations_state
	∙	idx_conversations_handoff_human
	∙	idx_conversations_one_active_per_contact (UNIQUE PARTIAL: WHERE state != ‘closed’)
Constraint:
Uma única conversa ATIVA (state != ‘closed’) por contato
Tabela: message_log
Registro de mensagens para auditoria e idempotência.
Campos principais:
	∙	id (UUID, PK)
	∙	external_message_id (VARCHAR, UNIQUE) — ID do WhatsApp
	∙	contact_id (FK → contacts)
	∙	conversation_id (FK → conversations, nullable)
	∙	direction (VARCHAR) — inbound | outbound
	∙	message_type (VARCHAR) — text | button | media | interactive | unknown
	∙	payload (JSONB) — dados completos
	∙	created_at (TIMESTAMP)
Índices:
	∙	idx_message_log_contact_id
	∙	idx_message_log_external_message_id
	∙	idx_message_log_direction
	∙	idx_message_log_created_at
Tabela: appointments
Registro de agendamentos vindos do Calendly.
Campos principais:
	∙	id (UUID, PK)
	∙	calendly_invitee_uri (VARCHAR, UNIQUE)
	∙	calendly_event_uri (VARCHAR)
	∙	contact_id (FK → contacts, nullable)
	∙	conversation_id (FK → conversations, nullable)
	∙	scheduled_at (TIMESTAMP)
	∙	match_confidence (VARCHAR) — gold | silver | bronze | none
	∙	match_rule (VARCHAR) — ex: “exact_phone”, “last_9_digits_email”, “name_and_link”, “no_match”
	∙	calendly_payload (JSONB)
	∙	created_at (TIMESTAMP)
	∙	updated_at (TIMESTAMP)
Índices:
	∙	idx_appointments_contact_id
	∙	idx_appointments_calendly_invitee_uri
	∙	idx_appointments_scheduled_at
	∙	idx_appointments_match_confidence

10A. Contrato de Mensagem (Formato Interno)
Para evitar dependência direta do formato da API do WhatsApp (Meta Cloud API ou Evolution API), toda mensagem recebida deve ser convertida para um formato interno normalizado antes de ser processada.
Estrutura do Objeto de Mensagem Normalizada

{
  "message_id": "string",
  "phone": "5511999999999",
  "type": "text | button | media | interactive",
  "text": "texto normalizado",
  "button_id": "id_do_botao",
  "timestamp": "ISO8601"
}


Descrição dos Campos



Campo	Descrição
message_id	Identificador único da mensagem recebido do WhatsApp
phone	Número do paciente no formato E.164
type	Tipo da mensagem recebida
text	Conteúdo textual normalizado
button_id	Identificador do botão clicado
timestamp	Momento em que a mensagem foi enviada/recebida


Tipos Possíveis de Mensagem



Tipo	Descrição
text	Mensagem digitada
button	Botão clicado
media	Áudio, imagem, vídeo ou documento
interactive	Botões interativos, listas, etc.

Regras de Normalização
	∙	Remover acentos
	∙	Converter texto para minúsculo
	∙	Remover espaços extras
	∙	Padronizar números e opções

Exemplo:

Entrada do paciente: "Consulta Particular"
Texto normalizado: "consulta particular"


O Input Parser é responsável por executar essa conversão.

10B. Identificadores de Botões (Button IDs)
As APIs do WhatsApp trabalham com IDs internos de botões, não com o texto exibido ao usuário.
Por esse motivo, toda lógica do sistema deve utilizar IDs fixos, e nunca depender do texto.
Mapeamento de Botões



Texto Exibido ao Paciente	ID Interno
Consulta particular	BTN_PARTICULAR
Consulta pelo convênio Alice	BTN_ALICE
Outros assuntos	BTN_OUTROS
Consulta online	BTN_ONLINE
Consulta presencial	BTN_PRESENCIAL
Agendar consulta online	BTN_ALICE_ONLINE
Prefiro consulta presencial	BTN_ALICE_PRESENCIAL


Regra de Implementação
O motor de estados deve avaliar apenas o button_id.
Exemplo de evento recebido:

{
  "type": "button",
  "button_id": "BTN_PARTICULAR"
}


Nunca utilizar o texto do botão para decisões lógicas.

10C. Variáveis de Configuração de Links
Os links de agendamento não devem estar hardcoded dentro das mensagens.
Eles devem ser definidos como variáveis de configuração do sistema.
Variáveis Obrigatórias
	∙	LINK_PARTICULAR_ONLINE
	∙	LINK_PARTICULAR_PRESENCIAL
	∙	LINK_ALICE_ONLINE
	∙	LINK_ALICE_PRESENCIAL
Exemplo de Configuração

LINK_PARTICULAR_ONLINE = https://calendly.com/inatale/consulta-particular-online
LINK_PARTICULAR_PRESENCIAL = https://calendly.com/inatale/consulta-particular-presencial
LINK_ALICE_ONLINE = https://calendly.com/inatale/consulta-convenio-online
LINK_ALICE_PRESENCIAL = https://calendly.com/inatale/consulta-convenio-presencial


Regra de Implementação
O código deve sempre referenciar os links através das variáveis de configuração.
Exemplo:

config.LINK_PARTICULAR_ONLINE


Isso permite alterar os links de agendamento sem modificar o código do sistema.

11. Idempotência
Eventos externos podem ser enviados mais de uma vez.
WhatsApp
external_message_id é único.
Se evento duplicado chegar, ele é ignorado.
Calendly
calendly_invitee_uri é único.
Se evento duplicado chegar, ele é ignorado.

12. Métricas Operacionais
O sistema registra timestamps para análise.
Campos importantes:
	∙	last_bot_message_at
	∙	booking_link_sent_at
	∙	booked_at
	∙	handoff_at
Esses dados permitem medir:
	∙	Tempo até agendamento
	∙	Taxa de abandono
	∙	Volume de handoff humano

13. Critério de Sucesso da V1
A V1 é considerada funcional quando o fluxo abaixo funciona de forma consistente:
	1.	✅ Paciente inicia conversa
	2.	✅ Sistema recebe e valida webhook
	3.	✅ Sistema extrai dados e garante idempotência
	4.	✅ Sistema cria contato de forma thread-safe
	5.	✅ Sistema grava mensagem em message_log
	6.	✅ Sistema retorna 200 OK para Meta
Sem intervenção manual.

14. Limitações Conhecidas da V1
Limitações deliberadas:
	∙	❌ Não interpreta linguagem livre
	∙	❌ Não processa mídia
	∙	❌ Não gerencia remarcação
	∙	❌ Não envia lembretes
	∙	❌ Não responde perguntas complexas
	∙	❌ Não executa triagem automática
	∙	❌ Não envia mensagens
	∙	❌ Não integra com Calendly
Essas capacidades são candidatas para futuras versões.

15. Princípios de Implementação
Durante o desenvolvimento devem ser respeitados os seguintes princípios:
	1.	Estados explícitos — Máquina de estados bem definida
	2.	Logs completos — Cada transição registrada
	3.	Idempotência obrigatória — External IDs únicos
	4.	Escopo mínimo — Apenas o necessário para V1
	5.	Fallback humano seguro — Handoff sempre disponível
	6.	Separação de responsabilidades — Módulos independentes
	7.	Arquitetura orientada a eventos — Processamento assíncrono
	8.	Thread-safety — UPSERT para operações concorrentes
	9.	Sem aspas tipográficas — Sempre ASCII
	10.	Sem dependências diretas — Normalização de dados

16. Arquitetura Técnica
Tecnologias Aprovadas para V1
Backend:
	∙	Node.js + Fastify
Banco de dados:
	∙	Supabase (PostgreSQL)
Agendamento:
	∙	Calendly
Agenda:
	∙	Google Calendar
Mensageria:
	∙	WhatsApp Business API (Meta Cloud API)
Nenhuma outra tecnologia deve ser introduzida sem validação.
Componentes do Backend
Input Parser:
	∙	Responsável por normalizar mensagens recebidas
State Engine:
	∙	Motor da máquina de estados do bot
Message Service:
	∙	Responsável por enviar mensagens via API do WhatsApp
Calendly Webhook Handler:
	∙	Responsável por processar eventos de agendamento
Database Layer:
	∙	Responsável por persistência e leitura do banco
Diagrama de Arquitetura




17. Fonte de Verdade do Projeto
Este documento deve ser considerado a referência principal do sistema.
Qualquer implementação, ajuste ou nova feature deve ser validada contra estas definições.
Se houver divergência entre código e este documento, o documento deve ser atualizado antes da mudança ser considerada oficial.

18. Histórico de Versões



Versão	Data	Status	Alterações
1.0	2024	Etapa 1 Congelada	Documentação inicial com Etapa 1 congelada


19. Próximas Etapas (Roadmap)
Etapa 2: Input Parser + State Engine
	∙	Normalização de texto
	∙	Detecção de keywords
	∙	Detecção de mídia
	∙	Máquina de estados
	∙	Envio de mensagens
Etapa 3: Message Service Completo
	∙	Templates de mensagens
	∙	Formatação de respostas
	∙	Tratamento de erros
Etapa 4: Calendly Webhook Handler
	∙	Processamento de eventos
	∙	Reconciliação de agendamentos
	∙	Atualização de estados
Etapa 5: Melhorias e Expansão
	∙	Remarcação automática
	∙	Lembretes de consulta
	∙	Análise de métricas
	∙	Suporte a múltiplos idiomas

20. Contato e Suporte
Para dúvidas sobre a arquitetura ou implementação, consulte este documento como fonte única de verdade.
Qualquer alteração deve ser documentada aqui antes de ser implementada no código.

Documento Aprovado para Etapa 1
Status: CONGELADO
Data: 2024
Versão: 1.0​​​​​​​​​​​​​​​​
