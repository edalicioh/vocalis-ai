# Phase 5: Suporte a Novos Provedores de IA - Context

**Gathered:** 2026-07-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Esta fase compreende a expansão do orquestrador e da interface da extensão para suportar múltiplos provedores de IA intercambiáveis (Gemini, OpenAI, Anthropic e Ollama Local) configuráveis via painel de opções em tempo real.
</domain>

<decisions>
## Implementation Decisions

### Interface de Configuração no Painel (`settings-form.tsx`)
- **D-01:** Adicionar seletor dropdown `aiProvider` (`'gemini' | 'openai' | 'anthropic' | 'ollama'`) na aba de configurações.
- **D-02:** Exibir campos de chave de API condicionais baseados no provedor selecionado:
  - `geminiApiKey` para Gemini
  - `openaiApiKey` para OpenAI (GPT-4o)
  - `anthropicApiKey` para Anthropic (Claude 3.5 Sonnet)
  - `ollamaEndpoint` (padrão `http://localhost:11434`) e `ollamaModel` (padrão `llama3`) para Ollama Local
- **D-03:** Persistir as preferências do provedor no `chrome.storage.local` e transmiti-las ao Orquestrador via evento WS `settings.update`.

### Orquestração e Provedores no Servidor (`apps/orchestrator`)
- **D-04:** Atualizar a interface `AnswerProvider` e criar implementações concretas para cada provedor em `apps/orchestrator/src/services/`:
  - `gemini.ts` (Já existente)
  - `openai.ts` (Integração via Fetch/SDK da OpenAI com streaming Server-Sent Events)
  - `anthropic.ts` (Integração com Anthropic Messages API com streaming SSE)
  - `ollama.ts` (Integração com API REST local do Ollama `/api/generate` com streaming JSON Lines)
- **D-05:** Criar `AnswerProviderManager` que gerencia a instância ativa e alterna dinamicamente o provedor conforme recebimento do evento WS `settings.update`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `packages/shared-types/src/settings.ts` — Interfaces de tipo `Settings` e `AIProvider`
- `apps/orchestrator/src/services/answer-provider.ts` — Contrato da interface `AnswerProvider`
- `apps/chrome-extension/src/shared/settings-form.tsx` — Formulário visual de opções no Shadow DOM e Options Page
- `apps/orchestrator/src/server.ts` — Handlers do WS `settings.update` e despacho de sugestões
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Interface `AnswerProvider` em `apps/orchestrator/src/services/answer-provider.ts`: Contrato de streaming `generate` e `cancel`.
- `GeminiProvider` em `apps/orchestrator/src/services/gemini.ts`: Exemplo de implementação com `AbortSignal`.

### Integration Points
- `packages/shared-types/src/settings.ts`: Expandir tipo `Settings` para incluir `aiProvider`, `openaiApiKey`, `anthropicApiKey`, `ollamaEndpoint`, `ollamaModel`.
</code_context>

<specifics>
## Specific Ideas

- Se a chave do provedor selecionado não estiver preenchida, o sistema exibe aviso amigável no painel pedindo a chave da API correspondente.
</specifics>

<deferred>
## Deferred Ideas

- Suporte a modelos Hugging Face ou LM Studio customizados via WebSocket.
</deferred>

---
*Phase: 05-suporte-a-novos-provedores-de-ia*
*Context gathered: 2026-07-27*
