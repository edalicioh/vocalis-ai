# AGENTS.md — conversation-copilot

## Project overview

Real-time conversation copilot: Chrome extension captures meeting audio, sends it to a local Whisper transcription service, detects questions, and generates AI suggestions via Gemini. Displayed in a floating panel over the meeting.

**Language**: All code comments, docs, and UI text are in Brazilian Portuguese.

## Regras de Execução & Validação do Agente (MANDATÓRIO)

- **Cheque de Compilação & Testes Obrigatório**: **APÓS QUALQUER ALTERAÇÃO DE CÓDIGO** em qualquer arquivo do monorepo, o agente **DEVE OBRIGATORIAMENTE** executar os comandos de build e validação (`npm run build:types`, `npm run build:extension`, `npm run build:orchestrator` e `npm test` / `npm run test:e2e`) para comprovar que não há erros de compilação, regressões de TypeScript ou quebra de testes antes de finalizar o atendimento.
- **Ordem de Build**: Caso tenha alterado `packages/shared-types`, executar `npm run build:types` PRIMEIRO antes de compilar os outros pacotes.
- **Idioma**: Todo texto de interface, comentários e documentação deve ser estritamente em Português do Brasil (`pt-BR`).

## Monorepo structure

npm workspaces (`packages/*`, `apps/*`):

| Package | Path | Tech | Role |
|:---|:---|:---|:---|
| `@conversation-copilot/shared-types` | `packages/shared-types/` | TypeScript | Shared types (WebSocket protocol, settings, metrics, meeting modes, agent definitions) |
| `@conversation-copilot/chrome-extension` | `apps/chrome-extension/` | React + Vite + Manifest V3 | **Orquestrador Principal**: floating panel, audio capture, QuestionDetector, ContextManager, ProviderManager, AgentRouter, Chrome AI (Gemini Nano), TTS, E2E Playwright tests |
| `@conversation-copilot/orchestrator` | `apps/orchestrator/` | Node.js + Fastify + WS | Backend de proxy/servidor opcional (suporte a execução em modo headless ou proxy) |
| (no package.json) | `apps/transcription-service/` | Python + FastAPI + faster-whisper | Serviço local de Speech-to-Text (`áudio -> texto`) com Silero VAD (`vad_filter=True`) |

## Build order (critical)

Shared types must be built before other packages can resolve them:

```bash
npm run build:types    # builds packages/shared-types → dist/
```

Then you can run `npm run dev:orchestrator`, `npm run build:extension`, etc.

## Developer commands

```bash
# Shared types (run first after any change to packages/shared-types/)
npm run build:types

# Orchestrator dev (uses tsx watch)
npm run dev:orchestrator

# Extension dev (Vite dev server)
npm run dev:extension

# Extension production build (output: apps/chrome-extension/dist/)
npm run build:extension

# Orchestrator production build
npm run build:orchestrator

# Unit & Integration tests (Vitest)
npm test

# E2E tests for Chrome Extension & UI (Playwright)
npm run test:e2e
```

## Docker

Three profiles: `gpu`, `cpu`, `dev`. Whisper container takes ~90s to start (model loading).

```bash
docker compose --profile gpu up -d    # GPU (needs NVIDIA Container Toolkit)
docker compose --profile cpu up -d    # CPU fallback
docker compose --profile dev up -d    # Dev (CPU whisper + orchestrator)
```

Health checks: `http://localhost:3001/health` (orchestrator), `http://localhost:8000/health` (whisper).

## Environment

Copy `.env copy.example` to `.env`. Required: `GEMINI_API_KEY`.

Key env vars: `WHISPER_MODEL` (default `small`), `WHISPER_DEVICE`, `WHISPER_COMPUTE`, `ORCHESTRATOR_PORT`, `WHISPER_PORT`.

## Architecture notes

- **Extensão Chrome como Orquestrador Principal (v1.1.0)**: A Extensão assume a inteligência de detecção de perguntas (`QuestionDetector`), gerenciamento de contexto (`ContextManager`), roteamento de agentes (`AgentRouter`) e execução/streaming de provedores de IA (`ProviderManager`).
- O serviço de transcrição Python (`apps/transcription-service`) fornece o endpoint WebSocket direto `ws://localhost:8000/ws/transcribe` para envio de áudio e recebimento de transcrições parciais/finais.
- O servidor Node.js Orquestrador (`apps/orchestrator` em `ws://localhost:3001/ws`) é mantido para suporte opcional de proxy ou execuções headless.
- All WebSocket events use `dot.notation` (e.g., `session.start`, `answer.delta`, `transcript.final`, `settings.update`). Types in `packages/shared-types/src/messages.ts`.
- `LlmProvider` interface em `apps/chrome-extension/src/providers/provider.interface.ts` desacopla a IA (Google Gemini, OpenAI, Anthropic, Ollama, Chrome AI, Custom Proxy para DeepSeek/Groq/OpenRouter).
- **Chrome Built-in AI (Gemini Nano on-device)**:
  - `ChromeBuiltInAIProcessor` (`apps/chrome-extension/src/offscreen/chrome-ai-processor.ts`): Correção ortográfica passiva e silenciosa de jargões técnicos de TI (Prompt API `window.ai.languageModel`) + sumarização incremental contínua do histórico.
  - `ChromeRewriterProcessor` (`apps/chrome-extension/src/offscreen/chrome-rewriter-processor.ts`): Reescrita rápida on-device em 100-300ms (Rewriter API `window.ai.rewriter` + fallback para Prompt API) com chips de ação rápida (`Encurtar`, `Formal`, `Técnico`, `Expandir`) e botão `Desfazer` no `ResponsePanelWidget.tsx`.
- **Modos de Reunião Adaptativos**:
  - 4 Modos (`MeetingMode`): `technical_interview`, `system_design`, `code_review`, `general`.
  - Prompts de sistema adaptativos no `ContextManager` e injeção de notas de apoio em Markdown (`modeNotes`). Seletor rápido no HUD (`FunctionBarWidget.tsx`) e nas Opções com atualização em tempo real.
- **Pipeline de Áudio & Silero VAD / RMS Energy Gate**:
  - Silero VAD (`vad_filter=True`) no servidor Python (`main.py`).
  - RMS Energy Gate no `pcm-worklet.js` para descarte local de pacotes silenciosos (economizando 80% de tráfego WebSocket/CPU) com indicação visual de fala ativa no HUD (verde radiante `#22c55e` vs azul `#818cf8`).
- Extension build uses a custom Vite plugin that compiles `content-script.ts` as IIFE separately (Chrome content scripts can't use ES modules).
- `apps/chrome-extension/manifest.json` is Manifest V3. Content script: `content/content-script.js` (IIFE, built separately).

## Diretrizes de UI & Usabilidade (Chrome Extension)

- **Estilização em Shadow DOM**: O `content-script` roda isolado em Shadow DOM (`#conversation-copilot-host`). Usar `React.CSSProperties` inline + `<style>` injetada no Shadow DOM para pseudo-classes/animações. Não utilizar Tailwind ou CSS externo que dependa de loaders runtime.
- **Redimensionamento do Painel**: O painel flutuante deve suportar redimensionamento livre (drag-to-resize) respeitando os limites: Largura Mínima: 280px / Máxima: 700px | Altura Mínima: 200px / Máxima: 90vh. Persistir dimensões no `localStorage` (`copilotDimensions`).
- **Recursos de Usabilidade**: O painel deve suportar ajuste de opacidade/transparência (`copilotOpacity`), minimização rápida por duplo clique no header e feedback visual toast ao copiar texto (`Copiado! ✓`).
- **Idioma**: Todo texto de interface, comentários e documentação deve ser estritamente em Português do Brasil (pt-BR).

## Testing

- **Regra Obrigatória**: Após qualquer alteração de código, rodar a suíte de build e testes para garantir que nada foi quebrado.
- **Testes Unitários & Integração (Vitest)**: `npm test` executa testes dos serviços do Orquestrador (`WhisperClient`, `ContextManager`, `QuestionDetector`, `CustomProxyProvider`, `meeting-modes.test.ts`, servidores Fastify WS/HTTP), orquestração client-side da extensão (`client-orchestration.test.ts`), processadores locais Chrome AI (`chrome-ai-processor.test.ts`, `chrome-rewriter-processor.test.ts`), medição VAD (`vad-meter.test.ts`) e estado dos widgets (**151 testes aprovados**).
- **Testes End-to-End (Playwright)**: `npm run test:e2e` executa testes automatizados no Chromium carregando a Extensão Chrome Manifest V3 (`apps/chrome-extension/dist`), validando injeção no Shadow DOM, a barra de ferramentas HUD (`overlay.spec.ts`), o formulário de perfil e opções (`options.spec.ts`), a interface de popup (`popup.spec.ts`) e a busca no histórico (`storage-history.spec.ts`).

## Gotchas

- `npm run build:types` must run before orchestrator or extension will resolve `@conversation-copilot/shared-types`.
- `npm run build:extension` must run before `npm run test:e2e` so Playwright loads the latest built extension files from `apps/chrome-extension/dist`.
- Whisper model loading takes 30-90s on first start. Health check won't pass until model is loaded.
- Extension popup HTML path is referenced directly in `manifest.json` as `src/popup/popup.html` (not from `dist/`).
- The `.env` file at root contains a real API key — never commit it.
- No `.gitignore` at root; `.dockerignore` excludes `node_modules`, `dist`, `.env`, `*.md`, `context/`, `.planning/`.

