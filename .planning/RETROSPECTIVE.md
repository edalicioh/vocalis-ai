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

## Milestone: v1.2 — Histórico, Busca & Provedores de IA

**Shipped:** 2026-07-27
**Phases:** 2 | **Plans:** 2

### What Was Built
- **Fase 4 (Histórico & Busca de Reuniões)**:
  - Aba "📚 Histórico" na tela de opções (`options.tsx`) com busca por palavra-chave em tempo real (*case-insensitive*) sobre títulos, URLs, transcrições e atas.
  - Download individual de atas em `.md`, exclusão de registros do `chrome.storage.local` e botão de atalho `📚` na barra de ferramentas do painel flutuante.
- **Fase 5 (Suporte a Novos Provedores de IA)**:
  - Integração dos provedores `OpenAIProvider` (GPT-4o), `AnthropicProvider` (Claude 3.5 Sonnet) e `OllamaProvider` (100% local/offline) via `AnswerProvider`.
  - Alternador dinâmico `AnswerProviderManager` no Orquestrador e seletor com campos de chave de API condicionais no formulário de configurações do painel.

### What Worked
- A arquitetura `AnswerProviderManager` permitiu alternar o provedor de IA ativo sem a necessidade de reiniciar o servidor Orquestrador.
- O filtro de busca em memória na página de opções proporcionou uma experiência extremamente fluida e instantânea para encontrar reuniões passadas.

---
*Retrospective last updated: 2026-07-27 after v1.2 milestone*
