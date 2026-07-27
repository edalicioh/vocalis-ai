# Plano da Fase 5 — Streaming de Respostas e Cancelamento Ativo

## 🎯 Objetivo
Exibir a resposta da IA no painel flutuante token-a-token em tempo real à medida que é gerada, e cancelar requisições/respostas anteriores caso uma nova pergunta surja durante o processo.

---

## 📋 Escopo da Fase

1. Streaming via WebSocket:
   - Ciclo de vida completo com os seguintes eventos (RF-010):
     - `answer.started` — início da geração.
     - `answer.delta` — chunks parciais de texto.
     - `answer.section.completed` — seção do JSON pronta (ex: `opening`, `keyPoints`).
     - `answer.completed` — resposta completa entregue.
     - `answer.cancelled` — geração interrompida por nova pergunta.
     - `answer.failed` — erro na geração.
   - Atualização em tempo real do card de sugestão no Shadow DOM sem refazer o layout.
2. Mecanismo de Cancelamento Ativo (RF-011):
   - Uma nova pergunta sempre terá prioridade sobre uma resposta anterior (RN-002).
   - Cancelamento imediato de chamadas anteriores em andamento ao detectar nova pergunta.
   - O TTS anterior deverá parar.
   - A interface deverá marcar a resposta anterior como interrompida visualmente.
   - Processamentos secundários (resumo, classificação) deverão ocorrer em paralelo, sem atrasar a resposta principal (RN-011).

---

## 🏁 Critérios de Aceite
- [ ] O usuário vê os primeiros caracteres da sugestão em menos de 2 a 3 segundos.
- [ ] O surgimento de uma nova pergunta interrompe imediatamente a geração anterior.
- [ ] A resposta interrompida é marcada visualmente na interface.
- [ ] Todos os eventos do ciclo de vida (`answer.started` → `answer.completed`/`answer.cancelled`/`answer.failed`) são emitidos corretamente.

---

## 📎 Requisitos Rastreados
- **RF-010** — Resposta em streaming (eventos completos)
- **RF-011** — Cancelar resposta antiga
- **RN-002** — Nova pergunta sempre tem prioridade
- **RN-011** — Processamentos secundários em paralelo
