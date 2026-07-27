# Phase 2: Aprimoramento da Orquestração & IA - Context

**Gathered:** 2026-07-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Esta fase compreende a melhoria dos serviços de backend do Orquestrador (`apps/orchestrator`), focando na injeção dinâmica de Perfil Profissional e Descrição da Vaga nas chamadas de IA e na gestão de streaming com cancelamento instantâneo via `AbortController`.
</domain>

<decisions>
## Implementation Decisions

### Prompt e Contexto de IA (`GeminiProvider`)
- **D-01:** Estruturar o contexto do Gemini injetando o perfil profissional e a vaga na propriedade `systemInstruction` do SDK `@google/generative-ai`.
- **D-02:** Organizar o `systemInstruction` em blocos Markdown claros: `[PERFIL DO CANDIDATO]` (contendo nome, cargo, senioridade, habilidades, experiências, projetos, pontos fortes e pontos a desenvolver) e `[DETALHES DA VAGA]` (contendo título da vaga, empresa, descrição, requisitos obrigatórios, diferenciais e tecnologias).
- **D-03:** Manter a persona da IA configurada para fornecer respostas curtas (30-60 palavras), objetivas, em tom profissional em Português do Brasil (`pt-BR`).

### Cancelamento de Streaming & Controle de Requisições
- **D-04:** Utilizar `AbortController` no `GeminiProvider` para abortar imediatamente qualquer streaming ativo de IA quando uma nova pergunta for detectada (`question.detected`) ou forçada (`answer.force`).
- **D-05:** Emitir o evento WebSocket `answer.cancelled` com o `id` da requisição para que a extensão Chrome interrompa o efeito visual de carregamento e limpe/atualize a sugestão ativa.
- **D-06:** Manter a abstração da interface `AnswerProvider` desacoplada em `apps/orchestrator/src/services/answer-provider.ts`.

### Gerenciamento de Sessão e Histórico (`ContextManager`)
- **D-07:** Manter a janela deslizante de transcrições ativas dos últimos 10 minutos no `ContextManager`, deduplicando sentenças parciais enviadas continuamente pelo serviço Whisper.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `apps/orchestrator/src/services/answer-provider.ts` — Interface abstrata do provedor de IA
- `apps/orchestrator/src/services/gemini.ts` — Implementação do SDK Gemini
- `apps/orchestrator/src/services/context-manager.ts` — Gerenciador de histórico e contexto da conversa
- `apps/orchestrator/src/server.ts` — Servidor Fastify e manipuladores WebSocket
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `GeminiProvider` em `apps/orchestrator/src/services/gemini.ts`: Já possui inicialização do `GoogleGenerativeAI` e suporte inicial a streaming.
- `ContextManager` em `apps/orchestrator/src/services/context-manager.ts`: Gerencia o buffer de transcrições e formatador de histórico.

### Integration Points
- Evento `settings.update` via WebSocket: Atualiza as configurações de `userProfile` e `jobDescription` armazenadas na sessão.
</code_context>

<specifics>
## Specific Ideas

- Se o usuário não tiver preenchido a vaga ou o perfil profissional, o prompt deve usar fallbacks genéricos de conduta profissional sem falhar.
- O sinal de `AbortController` deve ser propagado até o iterador de streaming para liberar conexões imediatamente.
</specifics>

<deferred>
## Deferred Ideas

- Suporte a modelos alternativos de IA rodando 100% localmente (ex: Ollama / Llama 3).
- Histórico estendido com indexação por busca vetorial.
</deferred>

---
*Phase: 02-aprimoramento-da-orquestra-o-ia*
*Context gathered: 2026-07-27*
