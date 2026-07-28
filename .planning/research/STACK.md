# Research: Stack — Milestone v1.3

## Novas Tecnologias & APIs

### 1. Chrome Built-in AI APIs (Gemini Nano)
- **API Surface**: `window.ai.languageModel` (Prompt API), `window.ai.writer` (Writer API), `window.ai.rewriter` (Rewriter API).
- **Disponibilidade**: Chrome 127+ (Origin Trial / Flags `chrome://flags/#optimization-guide-on-device-model` e `chrome://flags/#prompt-api-for-gemini-nano`).
- **Feature Detection**:
  ```typescript
  const capabilities = await window.ai?.languageModel?.capabilities();
  // capabilities.available === 'readily' | 'after-download' | 'no'
  ```
- **Streaming**: Suporte nativo a `session.promptStreaming(prompt)` retornando um `ReadableStream`.
- **Limitações Conhecidas**: Tamanho de janela de contexto menor (aproximadamente 4k tokens). Prompts devem ser curtos e diretos.

### 2. Voice Activity Detection (VAD) & Otimização do Whisper
- **Server-side VAD (Python/FastAPI)**: Integração nativa de Silero VAD no `faster-whisper` (`vad_filter=True`, `vad_parameters=dict(min_silence_duration_ms=500)`).
- **Client-side VAD (Web Audio API / Worklet)**: Filtro de amplitude/energia no PCM AudioWorklet do Chrome Offscreen Document para evitar o envio de buffers com 100% de silêncio via WebSocket.

### 3. Modos de Reunião & Schemas de Prompt
- **Estrutura de Modos**: Enums e tipos em `@conversation-copilot/shared-types` (`MeetingMode = 'technical_interview' | 'system_design' | 'code_review' | 'general'`).
- **Prompt Strategy**: System Prompts customizados por modo para moldar as respostas geradas pelos provedores de IA.

---
*Gerado durante o planejamento do Milestone v1.3*
