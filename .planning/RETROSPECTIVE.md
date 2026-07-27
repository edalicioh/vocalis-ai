# Living Retrospective

## Milestone: v1.0 — MVP

**Shipped:** 2026-07-27
**Phases:** 2 | **Plans:** 2

### What Was Built
- **Fase 1 (Refinamento de Usabilidade da Extensão)**:
  - Painel flutuante injetado no Shadow DOM com suporte a redimensionamento livre por arrasto (`drag-to-resize`), slider visual de opacidade/transparência (30%-100%), minimização rápida via duplo clique ou `Alt+C` e toast de cópia ("Copiado! ✓").
- **Fase 2 (Aprimoramento da Orquestração & IA)**:
  - Injeção dinâmica do Perfil Profissional (`UserProfile`) e Vaga (`JobDescription`) no `systemInstruction` do Gemini e suporte a cancelamento de streaming em tempo quase real via `AbortController` ao detectar novas perguntas.

### What Worked
- A arquitetura monorepo com pacotes TypeScript desacoplados (`@conversation-copilot/shared-types`) garantiu consistência nos contratos de mensagens WebSocket.
- O isolamento CSS no Shadow DOM via `React.CSSProperties` inline evitou vazamento ou interferências de estilo nas páginas de chamadas de vídeo.
- A abstração da interface `AnswerProvider` permitiu estender o `GeminiProvider` mantendo a interoperabilidade.

### Key Lessons
- O compilador Vite com plugin customizado para o `content-script` IIFE é altamente eficiente para extensões Chrome Manifest V3.
- Sinalizadores de `AbortController` integrados ao iterador assíncrono de streaming evitam requisições desnecessárias da IA quando a conversa muda rapidamente.

---

## Milestone: v1.1 — Resumo Automático da Reunião

**Shipped:** 2026-07-27
**Phases:** 1 | **Plans:** 1

### What Was Built
- **Fase 3 (Resumo Automático da Reunião)**:
  - Serviço `MeetingSummaryService` no Orquestrador para compilar o diálogo e estruturar automaticamente a ata em Markdown contendo: `Resumo Executivo`, `Decisões Tomadas`, `Action Items (Tarefas)` e `Transcrição Completa`.
  - Disparo em background ao encerrar a chamada (`session.stop`), notificação visual via toast `"Ata Pronta! 📄"` e download sob demanda no painel flutuante.

### What Worked
- A execução da geração de ata em background no Fastify manteve o encerramento de sessão instantâneo e não-bloqueante para a extensão Chrome.
- A atualização do utilitário `triggerMarkdownDownload` permitiu exportar o documento gerado sob demanda mantendo a retrocompatibilidade.

---
*Retrospective last updated: 2026-07-27 after v1.1 milestone*
