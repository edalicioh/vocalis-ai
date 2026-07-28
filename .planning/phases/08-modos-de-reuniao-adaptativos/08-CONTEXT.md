# Phase 08: Modos de Reunião Adaptativos & Contexto Customizado - Context

**Gathered:** 2026-07-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Introduzir o seletor de Modos de Reunião (Entrevista Técnica, System Design, Code Review, Reunião Geral) na interface (HUD & Popup/Opções), permitir a injeção de notas de apoio em Markdown por modo e adaptar os System Prompts e a estrutura de resposta do Orquestrador dinamicamente em tempo real via WebSocket.

</domain>

<decisions>
## Implementation Decisions

### Seletor de Modo na Interface (HUD & Popup)
- **D-01:** O seletor de modo ativo será posicionado no Widget Barra de Funções do HUD e na página de Popup/Opções.
- **D-02:** O modo ativo (`meetingMode`) é persistido em `localStorage` com a chave `copilotMeetingMode` (fallback: `'technical_interview'`).

### Prompts de Sistema Especializados por Modo no Orquestrador
- **D-03:** `technical_interview` (Entrevista Técnica) — Respostas diretas e concisas de até 30s para perguntas de contratação.
- **D-04:** `system_design` (Design de Sistemas) — Foco em requisitos funcionais/não-funcionais, trade-offs de arquitetura, gargalos de escalabilidade e suporte a diagramas Mermaid.
- **D-05:** `code_review` (Revisão de Código) — Foco em qualidade, refatoração de código, complexidade de tempo/espaço ($O(N)$) e segurança.
- **D-06:** `general` (Reunião Geral / Alinhamento) — Foco em síntese de discussões, decisões principais e lista de Action Items.

### Gerenciamento de Notas & Documentos de Apoio
- **D-07:** Cada modo possui seu próprio bloco de notas/documentação customizada em Markdown (`modeNotes[meetingMode]`) gerenciado na aba de Opções/Popup.
- **D-08:** As notas de apoio do modo ativo são enviadas nas mensagens de sessão (`session.start` e `settings.update`) e injetadas pelo `ContextManager` no prompt do LLM.

### Troca Dinâmica em Tempo Real durante a Chamada
- **D-09:** O cliente dispara o evento WebSocket `settings.update` contendo o novo `meetingMode` e `modeNotes` assim que o modo for alterado.
- **D-10:** O Orquestrador atualiza o estado da sessão instantaneamente sem interromper o streaming de áudio ou a captura da reunião.

### Agent's Discretion
- Formatação visual dos botões/pills do seletor no Shadow DOM respeitando o Design System `MASTER.md`.
- Layout dos campos de texto de notas por modo na interface de configurações.

</decisions>

<canonical_refs>
## Canonical References

### Specification & Architecture
- `.planning/research/ARCHITECTURE.md` — Protocolo WS e extensões de `session.start` e `settings.update`.
- `.planning/research/SUMMARY.md` — Visão geral das capacidades dos modos de reunião.
- `.planning/REQUIREMENTS.md` — Requisitos `MODE-01`, `MODE-02`, `MODE-03`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/shared-types/src/messages.ts`: Definição de `Settings` e `WSMessage` onde o tipo `MeetingMode` será adicionado.
- `apps/orchestrator/src/services/context-manager.ts`: Onde os prompts de sistema especializados serão configurados.
- `apps/chrome-extension/src/shared/settings-form.tsx`: Formulário de configurações onde o seletor e as notas por modo serão adicionados.

### Integration Points
- `apps/chrome-extension/src/content/overlay.tsx`: Widget Barra de Funções do Shadow DOM onde o seletor rápido será renderizado.

</code_context>

<deferred>
## Deferred Ideas

- Injeção direta de arquivos PDF/Docx pesados via OCR local — reservado para marcos futuros.
- Geração automática de diagramas de sequência interativos no HUD — reservado para expansões futuras.

</deferred>

---

*Phase: 08-modos-de-reuniao-adaptativos*
*Context gathered: 2026-07-28*
