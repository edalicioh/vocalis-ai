# Research Summary — Milestone v1.3

> Síntese das pesquisas para o Marco v1.3: Chrome Built-in AI, Modos de Reunião & Otimizações de Áudio.

---

## 1. Stack Adicionada
- **Chrome Built-in AI APIs**: `window.ai.languageModel` (Prompt API), `window.ai.writer` (Writer API) com suporte a streaming via `promptStreaming()`.
- **Silero VAD (Voice Activity Detection)**: Integração nativa no `faster-whisper` (`vad_filter=True`) + RMS Energy Gate no Worklet de áudio client-side.
- **Tipos & Enums**: `MeetingMode` em `@conversation-copilot/shared-types`.

## 2. Destaques de Funcionalidades
- Provedor nativo `ChromeBuiltInAIProvider` no `AnswerProviderManager` com fallback para Gemini Cloud/Ollama.
- Seletor de Modo de Reunião (Entrevista Técnica, System Design, Code Review, Alinhamento) na interface HUD.
- Pipeline de transcrição resiliente com redução de consumo de CPU/largura de banda via VAD duplo.

## 3. Cuidados & Pontos Críticos (Watch Out For)
- Tratar graciosamente a ausência do `window.ai` em navegadores sem a flag ativa.
- Manter o prompt de sistema do Gemini Nano enxuto (janela de contexto restrita).
- Adicionar padding de 200ms no buffer PCM para evitar que o VAD corte o início das frases.

---
*Commit efetuado com sucesso.*
