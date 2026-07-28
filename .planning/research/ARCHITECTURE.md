# Research: Architecture — Milestone v1.3

## Arquitetura de Integração das Novas Funcionalidades

### 1. `ChromeBuiltInAIProvider` no `AnswerProviderManager`
```
+-------------------------------------------------------------------------+
| Chrome Extension                                                        |
| +----------------------------------+  +-------------------------------+ |
| | Offscreen / Extension Page       |  | AnswerProviderManager         | |
| | (window.ai.languageModel)        |  | (Seleção: Gemini, OpenAI,     | |
| | Prompt API & Writer API          |  |  Anthropic, Ollama, ChromeAI) | |
| +-----------------+----------------+  +---------------+---------------+ |
|                   |                                   |                 |
+-------------------|-----------------------------------|-----------------+
                    |                                   |
                    v                                   v
        Local Browser Inference                 Orchestrator WS / Cloud LLMs
```

### 2. Modos de Reunião no Protocolo de Mensagens WS
- O tipo de mensagem `session.start` e `settings.update` em `packages/shared-types/src/messages.ts` é estendido com `meetingMode: 'technical_interview' | 'system_design' | 'code_review' | 'general'`.
- O `ContextManager` no Orquestrador injeta diretrizes específicas no prompt (`SYSTEM_PROMPTS[mode]`) dependendo do modo ativo.

### 3. Pipeline de Áudio com VAD Duplo
- **Camada 1 (Client / Offscreen Audio Worklet)**: RMS Threshold Filter descarta pacotes PCM com nível de áudio abaixo do limiar de ruído.
- **Camada 2 (Server / Python Transcription Service)**: `faster-whisper` processa o áudio com `vad_filter=True` usando Silero VAD para isolar apenas segmentos de voz humana.

---
*Gerado durante o planejamento do Milestone v1.3*
