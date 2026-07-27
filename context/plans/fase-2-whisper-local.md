# Plano da Fase 2 — Transcrição Whisper Local

## 🎯 Objetivo
Configurar e executar o serviço de transcrição local em Python utilizando `faster-whisper`, recebendo o streaming de áudio PCM do Orquestrador e emitindo transcrições parciais e finais em tempo quase real.

---

## 📋 Escopo da Fase

1. Estruturação da Aplicação Python (`services/whisper/`):
   - Dependências: `fastapi`, `uvicorn`, `websockets`, `faster-whisper`, `numpy`.
   - Suporte a aceleração via GPU (CUDA) com fallback para CPU (`int8` ou `float16`).
2. Implementação do Servidor WebSocket:
   - Endpoint `ws://localhost:8000/ws/transcribe`.
   - Recepção contínua de buffers de áudio PCM 16kHz.
   - Aplicação de Voice Activity Detection (VAD) para ignorar trechos de silêncio.
3. Emissão de Transcrições:
   - Envio de eventos `transcript.partial` com transcrição parcial.
   - Envio de eventos `transcript.final` com transcrição confirmada, confiança e idioma detectado.
4. Conexão do Orquestrador com o Whisper:
   - `WhisperClient` em TypeScript no Orquestrador Node.js mantendo reconexão automática e encaminhamento de buffers.

---

## 🏁 Critérios de Aceite
- [ ] O modelo `faster-whisper` carrega e transcreve áudio em português.
- [ ] O serviço gera eventos `transcript.partial` e `transcript.final`.
- [ ] O orquestrador recebe e repassa as transcrições para a extensão.

---

## 📎 Requisitos Rastreados
- **RF-004** — Transcrever áudio
- **RNF-002** — Desempenho local (parcial: validação GPU)
