# Architecture Reference — conversation-copilot

> Visão geral da arquitetura do sistema, padrões de projeto, fluxo de dados e abstrações principais.

---

## Diagrama da Arquitetura

```
+----------------------------------------------------------------------------------+
| Chrome Extension (Manifest V3)                                                   |
|                                                                                  |
| +-------------------------+   +-------------------+   +------------------------+ |
| | Offscreen Document      |   | Content Script    |   | SpeechManager          | |
| | (AudioContext PCM 16k)  |   | (Overlay UI React)|   | (Web Speech Synthesis) | |
| +------------+------------+   +---------+---------+   +-----------^------------+ |
|              |                          |                         |              |
+--------------|--------------------------|-------------------------|--------------+
               | (PCM Audio)              | (WebSocket JSON)        | (TTS Text)
               v                          v                         |
+-------------------------------------------------------------------|--------------+
| Orchestrator (Node.js + Fastify)                                  |              |
|                                                                   |              |
| +--------------------+  +----------------------+  +---------------|------------+ |
| | WhisperClient      |  | QuestionDetector     |  | ContextManager|            | |
| | (ws client)        |  | (Regex/Heuristic)    |  | (Window 10min/Sliding)     | |
| +----------+---------+  +----------+-----------+  +---------------+------------+ |
|            |                       |                          |                  |
|            |                       +------------+-------------+                  |
|            |                                    |                                |
|            |                                    v                                |
|            |                         +--------------------+                      |
|            |                         | AnswerProvider     |                      |
|            |                         | (GeminiProvider)   |                      |
|            |                         +----------+---------+                      |
+------------|------------------------------------|--------------------------------+
             | (WS audio)                         | (Streaming API)
             v                                    v
+------------------------+             +--------------------+
| Transcription Service  |             | Google Gemini API  |
| (Python + FastAPI)     |             | (LLM Engine)       |
| faster-whisper CTrans  |             +--------------------+
+------------------------+
```

---

## Camadas e Responsabilidades

### 1. Extensão Chrome (`apps/chrome-extension`)
- **Captura de Áudio (`src/offscreen/`)**: O Offscreen Document utiliza `chrome.tabCapture` / `getUserMedia` para capturar áudio da aba da reunião em tempo real, processando via AudioWorklet/PCM Worklet a 16kHz e enviando blocos binários/PCM ao Orquestrador.
- **Interface Flutuante (`src/content/overlay.tsx`)**: Injetada via Shadow DOM no Content Script para evitar conflitos de estilo com a página da reunião (ex: Google Meet, Zoom, Teams). Suporta redimensionamento livre (drag-to-resize), ajuste de opacidade, minimização e cópia com toast.
- **Gerenciador de Leitura de Voz (`src/tts/speech-manager.ts`)**: Controla a síntese de voz (TTS) nativa do navegador para leitura em áudio das sugestões geradas.

### 2. Orquestrador (`apps/orchestrator`)
- **Servidor Fastify (`src/server.ts`)**: Ponto central de sincronização WebSocket (`/ws`) com a extensão.
- **Gerenciador de Contexto (`src/services/context-manager.ts`)**: Mantém a janela deslizante de transcrições recentes (últimos 10 minutos ou buffer ajustável) e constrói o prompt contextualizado para a IA.
- **Detector de Perguntas (`src/services/question-detector.ts`)**: Analisa sentenças transcritas e aplica regras heurísticas para identificar perguntas direcionadas ao candidato/usuário.
- **Provedor de Respostas Abstrato (`src/services/answer-provider.ts`)**: Interface `AnswerProvider` que desacopla o backend de IA da regra de negócio, permitindo trocar o provedor Gemini por outro modelo.
- **Provedor Gemini (`src/services/gemini.ts`)**: Implementação concreta da interface `AnswerProvider` integrada com o SDK da Google Gemini.

### 3. Serviço de Transcrição (`apps/transcription-service`)
- **FastAPI / Uvicorn (`main.py`)**: Endpoints `/health` e `/ws/transcribe`. Recebe o fluxo de bytes PCM de áudio e executa a transcrição incremental usando `faster-whisper`.

---

## Principais Abstrações de Código

- **`AnswerProvider`**: Interface TypeScript em `apps/orchestrator/src/services/answer-provider.ts`. Define o contrato com emissão de eventos em streaming (`started`, `delta`, `completed`, `failed`, `cancelled`).
- **`ContextManager`**: Classe em `apps/orchestrator/src/services/context-manager.ts`. Responsável pela limpeza de histórico antigo, deduplicação de transcrições parciais e formatação do histórico da conversa.
- **`SpeechManager`**: Classe em `apps/chrome-extension/src/tts/speech-manager.ts`. Abstrai a `window.speechSynthesis` do navegador com callbacks para sentenças e estado de reprodução.
