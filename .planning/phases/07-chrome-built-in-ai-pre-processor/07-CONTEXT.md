# Phase 07: Chrome Built-in AI como Pré-processador Inteligente Local - Context

**Gathered:** 2026-07-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Implementar o módulo `ChromeBuiltInAIProcessor` (Prompt API / Writer API) no contexto da extensão Chrome para realizar correção ortográfica local de jargões técnicos da transcrição Whisper, sumarização incremental da conversa e classificação de categoria on-device antes do envio ao Orquestrador/Gemini Flash.

</domain>

<decisions>
## Implementation Decisions

### Localização de Execução da Prompt API
- **D-01:** O módulo `ChromeBuiltInAIProcessor` será executado dentro do **Offscreen Document** (`apps/chrome-extension/src/offscreen/`).
- **D-02:** O Offscreen Document permanece ativo durante toda a sessão de gravação de áudio da reunião, evitando problemas de suspensão ou inatividade comuns a Service Workers no Manifest V3.

### Estratégia de Correção Ortográfica de Jargões
- **D-03:** Correção Passiva e Silenciosa — O Gemini Nano analisa a transcrição bruta do Whisper e substitui jargões incorretos (ex: "Larabel" -> "Laravel", "Dockerizar" -> "Dockerize") silenciosamente antes de encaminhar ao Orquestrador e exibir no HUD.
- **D-04:** Sem badges ou marcações visuais intrusivas na UI para manter o visual limpo no Shadow DOM.

### Sumarização Incremental & Compressão de Tokens
- **D-05:** Gatilho Híbrido — O resumo incremental da conversa e extração de intenção são disparados a cada **5 frases transcritas** finalizadas OU a cada **60 segundos** (o que ocorrer primeiro).
- **D-06:** O resumo compacto é armazenado em memória no Offscreen/Extension e anexado às requisições do Orquestrador, reduzindo o volume de tokens enviados aos LLMs de nuvem em até 80%.

### Comportamento de Fallback & Resiliência UX
- **D-07:** Bypass Transparente — Se a API `window.ai` não estiver disponível (ou `capabilities().available !== 'readily'`), a extensão redireciona a transcrição bruta diretamente ao Orquestrador sem disparar exceções runtime.
- **D-08:** Exibir um indicador sutil nas Configurações da Extensão: `"Gemini Nano: Indisponível (Bypass Ativo)"` sem bloquear o uso do aplicativo.

### Agent's Discretion
- Formatação exata do prompt de sistema enxuto para o Gemini Nano (respeitando o limite de ~4k tokens).
- Estrutura de dados interna do cache de sumarização em memória.

</decisions>

<canonical_refs>
## Canonical References

### Specification & Architecture
- `.planning/research/ARCHITECTURE.md` — Diagrama da arquitetura híbrida com Chrome Built-in AI como pré-processador local.
- `.planning/research/STACK.md` — APIs do Chrome (`window.ai.languageModel`, Prompt API e Writer API) e feature detection.
- `.planning/REQUIREMENTS.md` — Requisitos `CHROME-01`, `CHROME-02`, `CHROME-03`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/chrome-extension/src/offscreen/offscreen.ts`: Documento Offscreen que gerencia o fluxo de áudio e conexões de captura.
- `apps/orchestrator/src/services/context-manager.ts`: Gerenciador de contexto do orquestrador que receberá a versão compactada/sumarizada do contexto.

### Integration Points
- `apps/chrome-extension/src/background/service-worker.ts`: Roteamento de mensagens entre Offscreen, Content Script e Orquestrador WS.

</code_context>

<deferred>
## Deferred Ideas

- Uso da Rewriter API para reescrever respostas completas localmente — reservado para marcos futuros.
- Suporte a modelos locais customizados via WebLLM/WASM — fora do escopo do Chrome Built-in AI.

</deferred>

---

*Phase: 07-chrome-built-in-ai-pre-processor*
*Context gathered: 2026-07-28*
