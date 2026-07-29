# Arquitetura Técnica — Vocalis AI

Este documento descreve a arquitetura detalhada do **Vocalis AI**, cobrindo o fluxo de dados em tempo real, a infraestrutura do monorepo, o pipeline de áudio e a integração com provedores de Inteligência Artificial.

---

## 1. Visão Geral do Sistema

O **Vocalis AI** é um sistema distribuído de baixíssima latência que opera durante chamadas de vídeo (Google Meet, Zoom, Teams). Ele é capaz de capturar áudio em tempo real, transcrever a fala via modelo Whisper local, filtrar silêncio com VAD, pré-processar jargões técnicos via IA no próprio navegador e gerar sugestões adaptativas acionadas por LLMs.

```
+-----------------------------------------------------------------------------------+
|                        Navegador Chrome (Manifest V3)                             |
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
|                        Orquestrador (Node.js + Fastify)                           |
|                                                                                   |
|  +--------------------+  +----------------------+  +---------------------------+  |
|  | WhisperClient      |  | QuestionDetector     |  | ContextManager            |  |
|  | (WS Connection)    |  | (RegEx / Heurística) |  | (Janela Deslizante 10min) |  |
|  +----------+---------+  +----------+-----------+  +-------------+-------------+  |
|             |                       |                            |                |
|             v                       +--------------+-------------+                |
|  +--------------------+                            v                              |
|  | Transcriber Python |                 +--------------------+                    |
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

## 2. Estrutura do Monorepo

O projeto utiliza **npm workspaces** com TypeScript fortemente tipado:

| Pacote / Aplicação | Caminho | Tecnologia | Responsabilidade |
|:---|:---|:---|:---|
| `@conversation-copilot/shared-types` | `packages/shared-types/` | TypeScript | Tipos compartilhados, protocolo WebSocket, definições de estado e `UiLanguage`. |
| `@conversation-copilot/orchestrator` | `apps/orchestrator/` | Node.js + Fastify | Servidor central WebSocket/HTTP, gerenciamento de contexto, detecção de perguntas e abstração de LLMs. |
| `@conversation-copilot/chrome-extension` | `apps/chrome-extension/` | React + Vite + Shadow DOM | Interface flutuante do copiloto, captura de áudio offscreen, Chrome Built-in AI e i18n (`pt-BR`/`en`). |
| `transcription-service` | `apps/transcription-service/` | Python + FastAPI | Serviço local de Speech-to-Text usando `faster-whisper` e Silero VAD. |

---

## 3. Pipeline de Áudio & Processamento Local

1. **Captura em Tempo Real**: O *Offscreen Document* da extensão Chrome utiliza `chrome.tabCapture` / `getUserMedia` para acessar o fluxo de áudio da aba da reunião.
2. **AudioWorklet PCM 16kHz**: O áudio é convertido em tempo real para PCM 16kHz Mono.
3. **RMS Energy Gate Local**: Antes do envio para a rede, o `pcm-worklet.js` calcula a energia RMS do sinal. Blocos silenciosos são descartados localmente, economizando **até 80% do tráfego de dados e CPU**.
4. **Silero VAD Server Side**: O servidor Python aplica `vad_filter=True` com o Silero VAD para garantir transcrições sem ruídos de fundo.

---

## 4. Chrome Built-in AI (Gemini Nano On-Device)

O Vocalis AI tira proveito da aceleração de hardware local oferecida pelo navegador Chrome:

- **`ChromeBuiltInAIProcessor`**: Correção ortográfica passiva e silenciosa de termos técnicos usando a Prompt API (`window.ai.languageModel`).
- **`ChromeRewriterProcessor`**: Reescrita instantânea on-device em **100-300ms** através da Rewriter API (`window.ai.rewriter`). Altera o tom da resposta com botões rápidos:
  - ✂️ *Encurtar / Shorten*
  - 💼 *Formal*
  - 💻 *Técnico / Technical*
  - 📝 *Expandir / Expand*

---

## 5. Arquitetura de Internacionalização (i18n)

A extensão possui um motor de i18n nativo e fortemente tipado em `apps/chrome-extension/src/shared/i18n/`:

- Suporte completo aos idiomas `pt-BR` (Português do Brasil) e `en` (Inglês).
- Resolução com fallback inteligente.
- Sincronização do estado de idioma entre a aba de Opções, Popup e Overlay flutuante via `chrome.storage.local`.

---

## 6. Provedores de IA Pluggáveis

A interface `AnswerProvider` em `apps/orchestrator/src/services/answer-provider.ts` desacopla a regra de negócio do motor de IA:

- **Google Gemini API**: Provedor padrão (modelos `gemini-2.5-flash`, `gemini-1.5-pro`).
- **OpenAI**: Suporte oficial a `gpt-4o` e `gpt-4o-mini`.
- **Anthropic**: Suporte a `claude-3-5-sonnet-20241022`.
- **Ollama Local**: Execução 100% offline via `llama3`, `mistral` ou `codestral`.
- **CustomProxyProvider**: Gateway agnóstico compatível com a API OpenAI Chat Completions (DeepSeek, Groq, OpenRouter, LM Studio).
