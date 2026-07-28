# Phase 10: Writer & Rewriter API com Gemini Nano - Context

**Gathered:** 2026-07-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Implementar o módulo de reescrita e refinamento local no navegador utilizando as Chrome Built-in AI APIs (Writer API, Rewriter API e Prompt API) integradas ao Gemini Nano on-device. Permite ao usuário reescrever e ajustar respostas diretamente no HUD sem requisições à rede.

</domain>

<decisions>
## Implementation Decisions

### Arquitetura de Reescrita On-Device (Chrome AI)
- **D-01:** Módulo `ChromeRewriterProcessor` em `apps/chrome-extension/src/offscreen/chrome-rewriter-processor.ts` (ou utilitário de content script/offscreen).
- **D-02:** Estratégia Híbrida com Fallback: Tenta a `Rewriter API` (`window.ai.rewriter`) nativa do Chrome. Se indisponível ou experimental, utiliza a `Prompt API` local (`window.ai.languageModel`) com prompts customizados de reescrita.
- **D-03:** Operação 100% local com baixa latência (~100-300ms) executada on-device via Gemini Nano.

### UI de Ações Rápidas no HUD (`SuggestionCardWidget`)
- **D-04:** Adicionar chips de ação rápida no rodapé de cada sugestão gerada no `SuggestionCardWidget.tsx`:
  - `✂️ Encurtar` (modo conciso)
  - `💼 Formal` (tom profissional)
  - `💻 Técnico` (foco em termos técnicos e arquitetura)
  - `📝 Expandir` (detalhar explicação)
- **D-05:** Ao reescrever, a resposta no HUD é substituída instantaneamente e um botão `↩️ Desfazer` é exibido para restaurar a sugestão original caso desejado.

### Detecção de Suporte & Fallback Gracioso
- **D-06:** Se a API `window.ai` não estiver disponível no Chrome do usuário, os chips de reescrita rápida são ocultados silenciosamente.

### Agent's Discretion
- Formatação das animações de carregamento local e transições CSS de desdobramento do texto reescrito.

</decisions>

<canonical_refs>
## Canonical References

### Specification & Architecture
- `.planning/research/ARCHITECTURE.md` — Arquitetura de Offscreen Document e Content Script.
- `.planning/REQUIREMENTS.md` — Requisito `CHROME-04`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/chrome-extension/src/offscreen/chrome-ai-processor.ts`: Processador local que consome a Prompt API no Chrome.
- `apps/chrome-extension/src/content/widgets/SuggestionCardWidget.tsx`: Widget de exibição de sugestões no HUD.
- `apps/chrome-extension/src/content/overlay.tsx`: Estado principal da extensão.

</code_context>

<deferred>
## Deferred Ideas

- Inferência multimodal de vídeo e imagem no Gemini Nano — *Fora do escopo do Marco v1.4*.

</deferred>

---

*Phase: 10-writer-and-rewriter-api-com-gemini-nano*
*Context gathered: 2026-07-28*
