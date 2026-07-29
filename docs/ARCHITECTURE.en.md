# Technical Architecture — Vocalis AI

🌐 **[Português (Brasil)](ARCHITECTURE.md)** | **[English](ARCHITECTURE.en.md)**

This document details the architecture of **Vocalis AI**, covering real-time data flow, monorepo infrastructure, audio pipeline, and AI provider integration.

---

## 1. System Overview

```
+-----------------------------------------------------------------------------------+
|                        Chrome Browser (Manifest V3)                               |
|                                                                                   |
|  +---------------------------+               +---------------------------------+  |
|  | Offscreen Document        |               | Content Script                  |  |
|  | (tabCapture + AudioWorklet|               | (Shadow DOM + React UI)         |  |
|  | PCM 16kHz + RMS Gate)     |               | (HUD + ResponsePanel + i18n)    |  |
|  +-------------+-------------+               +----------------+----------------+  |
|                |                                              |                   |
+----------------|----------------------------------------------|-------------------+
                 | Audio Stream PCM                             | WebSocket (ws://)
                 v                                              v
+-----------------------------------------------------------------------------------+
|                        Orchestrator (Node.js + Fastify)                           |
|                                                                                   |
|  +--------------------+  +----------------------+  +---------------------------+  |
|  | WhisperClient      |  | QuestionDetector     |  | ContextManager            |  |
|  | (WS Connection)    |  | (RegEx / Heuristics) |  | (10min Sliding Window)    |  |
|  +----------+---------+  +----------+-----------+  +-------------+-------------+  |
|             |                       |                            |                |
|             v                       +--------------+-------------+                |
|  +--------------------+                            v                              |
|  | Python Transcriber |                 +--------------------+                    |
|  | (faster-whisper +  |                 | AnswerProvider     |                    |
|  | Silero VAD)        |                 | (Gemini, OpenAI,   |                    |
|  +--------------------+                 | Anthropic, Ollama) |                    |
|                                         +----------+---------+                    |
+----------------------------------------------------+------------------------------+
                                                     |
                                                     v
                                          +--------------------+
                                          | Google Gemini API  |
                                          | / OpenAI / Ollama  |
                                          +--------------------+
```

---

## 2. Monorepo Structure

| Package / App | Path | Tech | Role |
|:---|:---|:---|:---|
| `@conversation-copilot/shared-types` | `packages/shared-types/` | TypeScript | Shared types, WebSocket protocol, `UiLanguage`. |
| `@conversation-copilot/orchestrator` | `apps/orchestrator/` | Node.js + Fastify | Core WS/HTTP server, context manager, question detector, LLM providers. |
| `@conversation-copilot/chrome-extension` | `apps/chrome-extension/` | React + Vite + Shadow DOM | Floating overlay UI, offscreen audio capture, Chrome AI, i18n (`pt-BR`/`en`). |
| `transcription-service` | `apps/transcription-service/` | Python + FastAPI | Local STT using `faster-whisper` and Silero VAD. |
