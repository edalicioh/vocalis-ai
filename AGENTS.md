# AGENTS.md — conversation-copilot

## Project overview

Real-time conversation copilot: Chrome extension captures meeting audio, sends it to a local Whisper transcription service, detects questions, and generates AI suggestions via Gemini. Displayed in a floating panel over the meeting.

**Language**: All code comments, docs, and UI text are in Brazilian Portuguese.

## Monorepo structure

npm workspaces (`packages/*`, `apps/*`):

| Package | Path | Tech | Role |
|:---|:---|:---|:---|
| `@conversation-copilot/shared-types` | `packages/shared-types/` | TypeScript | Shared types (WebSocket protocol, settings, metrics) |
| `@conversation-copilot/orchestrator` | `apps/orchestrator/` | Node.js + Fastify + WS | Core server: context, question detection, AI |
| `@conversation-copilot/chrome-extension` | `apps/chrome-extension/` | React + Vite + Manifest V3 | UI: floating panel, audio capture, TTS |
| (no package.json) | `apps/transcription-service/` | Python + FastAPI + faster-whisper | Local speech-to-text |

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

- Orchestrator connects to Whisper via WebSocket (`ws://whisper:8000/ws/transcribe` in Docker, `ws://localhost:8000/ws/transcribe` locally).
- Extension connects to Orchestrator at `ws://localhost:3001/ws`.
- All WebSocket events use `dot.notation` (e.g., `session.start`, `answer.delta`, `transcript.final`). Types in `packages/shared-types/src/messages.ts`.
- `AnswerProvider` interface in `apps/orchestrator/src/services/answer-provider.ts` makes the AI backend swappable (default: Gemini).
- Extension build uses a custom Vite plugin that compiles `content-script.ts` as IIFE separately (Chrome content scripts can't use ES modules).
- `apps/chrome-extension/manifest.json` is Manifest V3. Content script: `content/content-script.js` (IIFE, built separately).

## Diretrizes de UI & Usabilidade (Chrome Extension)

- **Estilização em Shadow DOM**: O `content-script` roda isolado em Shadow DOM. Usar `React.CSSProperties` inline + `<style>` injetada no Shadow DOM para pseudo-classes/animações. Não utilizar Tailwind ou CSS externo que dependa de loaders runtime.
- **Redimensionamento do Painel**: O painel flutuante deve suportar redimensionamento livre (drag-to-resize) respeitando os limites: Largura Mínima: 280px / Máxima: 700px | Altura Mínima: 200px / Máxima: 90vh. Persistir dimensões no `localStorage` (`copilotDimensions`).
- **Recursos de Usabilidade**: O painel deve suportar ajuste de opacidade/transparência (`copilotOpacity`), minimização rápida por duplo clique no header e feedback visual toast ao copiar texto (`Copiado! ✓`).
- **Idioma**: Todo texto de interface, comentários e documentação deve ser estritamente em Português do Brasil (pt-BR).

## Testing

No test framework or test files exist in this repo yet. No lint or formatter config at project level.

## Gotchas

- `npm run build:types` must run before orchestrator or extension will resolve `@conversation-copilot/shared-types`.
- Whisper model loading takes 30-90s on first start. Health check won't pass until model is loaded.
- Extension popup HTML path is referenced directly in `manifest.json` as `src/popup/popup.html` (not from `dist/`).
- The `.env` file at root contains a real API key — never commit it.
- No `.gitignore` at root; `.dockerignore` excludes `node_modules`, `dist`, `.env`, `*.md`, `context/`, `.planning/`.
