# Integrations Reference — conversation-copilot

> Mapeamento de integrações externas, APIs, conexões WebSocket e variáveis de ambiente.

---

## Servicios de IA & APIs Externas

### 1. Google Gemini API
- **Papel**: Geração de sugestões de resposta em tempo real e análise de contexto de conversas/entrevistas.
- **Cliente / SDK**: `@google/generative-ai` (`apps/orchestrator/src/services/gemini.ts`)
- **Autenticação**: Variável de ambiente `GEMINI_API_KEY`
- **Padrão de Resposta**: Streaming via `generateContentStream` com fallback gracioso e suporte a cancelamento.

---

## Comunicação Inter-serviços (WebSockets)

```
[ Chrome Extension ] <---> (ws://localhost:3001/ws) <---> [ Orchestrator ] <---> (ws://localhost:8000/ws/transcribe) <---> [ Whisper Service ]
```

### 1. Extensão Chrome <-> Orquestrador Node.js
- **URL**: `ws://localhost:3001/ws` (ou customizável nas configurações da extensão)
- **Protocolo**: Mensagens em formato JSON estruturado com notação de ponto (`dot.notation`).
- **Definições de Tipos**: [`packages/shared-types/src/messages.ts`](file:///d:/dev/projetos/Edalicio/conversation-copilot/packages/shared-types/src/messages.ts)
- **Principais Eventos**:
  - `session.start` / `session.stop`: Controle de gravação de áudio
  - `audio.chunk`: Envio de chunks PCM da extensão para transcrição
  - `transcript.final` / `transcript.delta`: Envio de transcrições do servidor para o painel flutuante
  - `question.detected`: Notificação de pergunta identificada na conversa
  - `answer.started` / `answer.delta` / `answer.completed` / `answer.cancelled`: Streaming de sugestões geradas pela IA

### 2. Orquestrador Node.js <-> Serviço Whisper (FastAPI)
- **URL Interna Docker**: `ws://whisper:8000/ws/transcribe`
- **URL Local Dev**: `ws://localhost:8000/ws/transcribe`
- **Cliente**: [`apps/orchestrator/src/services/whisper-client.ts`](file:///d:/dev/projetos/Edalicio/conversation-copilot/apps/orchestrator/src/services/whisper-client.ts)
- **Protocolo**: Transferência contínua de áudio PCM raw / float32 e recebimento de segmentos transcritos.

---

## Variáveis de Ambiente

| Variável | Padrão | Descrição |
|:---|:---|:---|
| `GEMINI_API_KEY` | *(obrigatório)* | Chave de API da Google Gemini |
| `ORCHESTRATOR_PORT` | `3001` | Porta de escuta do Orquestrador Fastify |
| `WHISPER_PORT` | `8000` | Porta de escuta do serviço Whisper FastAPI |
| `WHISPER_MODEL` | `small` | Modelo do Whisper (`tiny`, `base`, `small`, `medium`, `large-v3`) |
| `WHISPER_DEVICE` | `cuda` (GPU) / `cpu` | Dispositivo de inferência do faster-whisper |
| `WHISPER_COMPUTE` | `float16` (GPU) / `int8` (CPU) | Precisão de computação do CTranslate2 |
| `WHISPER_WS_URL` | `ws://whisper:8000/ws/transcribe` | Endpoint de conexão do cliente Whisper |
