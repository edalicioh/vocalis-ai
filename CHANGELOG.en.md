# Changelog - Vocalis AI

🌐 **[Português (Brasil)](CHANGELOG.md)** | **[English](CHANGELOG.en.md)**

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] - 2026-08-11

### Added
- **Default Disabled Capture & Closed Panels**: Audio capture always initializes disabled (`isCapturing = false`) on meeting load, keeping floating widgets closed until explicitly activated.
- **Dynamic New Session Renewal**: Starting audio capture generates a fresh dynamic `sessionId` and completely resets prior transcript and suggestion state.
- **General Meeting & Transcription-Only Modes**: Added `general` and `transcription_only` modes to suppress automatic interview answer generation for casual meetings.
- **Complete Call Audio Recording**: Dual stream audio mixing (Tab + Microphone) recorded via WebM/Opus `MediaRecorder` into local **IndexedDB** (`CopilotAudioDB`), with privacy toggles and a 🎧 **"Download Audio (.webm)"** button.

## [1.0.0] - 2026-07-29

### Added
- **Fastify Orchestrator & WebSocket**: Central server in TypeScript supporting bidirectional dot-notation messaging (`dot.notation`).
- **Local Whisper Transcription Service**: Python FastAPI server with `faster-whisper` and Silero VAD (`vad_filter=True`).
- **Chrome Extension (Manifest V3)**:
  - React floating panel injected via Shadow DOM with drag-to-resize, opacity controls, double-click minimize, and copy toasts.
  - Offscreen 16kHz audio processing with RMS Energy Gate saving WebSocket bandwidth.
  - Web Speech Synthesis API TTS reader.
- **Chrome Built-in AI On-Device**:
  - `ChromeBuiltInAIProcessor`: Silent IT jargon spelling correction via Prompt API (`window.ai.languageModel`).
  - `ChromeRewriterProcessor`: Instant 100-300ms on-device rewriting via Rewriter API (*Shorten*, *Formal*, *Technical*, *Expand*).
- **Adaptive Meeting Modes**:
  - 4 built-in modes: `technical_interview`, `system_design`, `code_review`, and `general`.
- **Flexible AI Providers**:
  - Native Google Gemini SDK + OpenAI, Anthropic, Ollama, and `CustomProxyProvider` (OpenRouter, Groq, DeepSeek).
- **Internationalization (i18n)**:
  - Full support for `pt-BR` and `en` with dynamic UI language switching.
- **Licensing & Branding**:
  - GNU General Public License v2.0 (`GPL-2.0-only`).
  - **Vocalis AI** 3D Glassmorphism brand identity and complete documentation in `docs/`.
