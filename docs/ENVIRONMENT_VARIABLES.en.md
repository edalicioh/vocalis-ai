# Environment Variables Reference — Vocalis AI

🌐 **[Português (Brasil)](ENVIRONMENT_VARIABLES.md)** | **[English](ENVIRONMENT_VARIABLES.en.md)**

All settings for **Vocalis AI** can be configured via environment variables defined in `.env` at the repository root.

---

## 1. AI Providers (LLM)

| Variable | Type | Default | Description |
|:---|:---|:---|:---|
| `GEMINI_API_KEY` | `string` | *(None)* | Official Google Gemini API key. |
| `OPENAI_BASE_URL` | `string` | `https://api.openai.com/v1` | OpenAI API base endpoint. |
| `OLLAMA_ENDPOINT` | `string` | `http://localhost:11434` | Local Ollama server endpoint. |
| `CUSTOM_PROXY_ENDPOINT` | `string` | `https://api.deepseek.com/v1/chat/completions` | Custom OpenAI-compatible proxy endpoint (DeepSeek, Groq, OpenRouter). |

---

## 2. Orchestrator & WebSocket Communication

| Variable | Type | Default | Description |
|:---|:---|:---|:---|
| `ORCHESTRATOR_PORT` | `number` | `3001` | Fastify Orchestrator HTTP/WS port. |
| `WHISPER_WS_URL` | `string` | `ws://localhost:8000/ws/transcribe` | Whisper Python transcription WebSocket URL. |
| `VITE_ORCHESTRATOR_WS_URL` | `string` | `ws://localhost:3001/ws` | Chrome Extension Orchestrator WebSocket URL. |
| `VITE_ORCHESTRATOR_HTTP_URL` | `string` | `http://localhost:3001` | Chrome Extension Orchestrator HTTP API URL. |
