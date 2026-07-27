# Plano da Fase 1 — Prova de Conceito de Áudio

## 🎯 Objetivo
Capturar o áudio da aba da reunião no navegador Chrome através da extensão, converter para o formato adequado e transmiti-lo via WebSocket para o servidor local, confirmando a reprodução normal sem interferir na reunião.

---

## 📋 Escopo da Fase

1. Configuração da Extensão Chrome (Manifest V3):
   - Permissões: `tabCapture`, `offscreen`.
   - Service Worker em `src/background/service-worker.ts`.
2. Criação do Documento Offscreen (`src/offscreen/offscreen.html` e `offscreen.ts`):
   - Captura de `MediaStream` da aba via `chrome.tabCapture.getMediaStreamId`.
   - Inicialização do `AudioContext` a 16 kHz.
3. Processamento e Streaming de Áudio:
   - Extração dos dados PCM Mono 16-bit (16 kHz).
   - Envio dos blocos de áudio via WebSocket para `ws://localhost:3001/ws`.
4. Manutenção do Áudio Original:
   - Redirecionamento da saída para os alto-falantes/fones do usuário para evitar silenciar a chamada.
5. Encerramento de Sessão (RF-002):
   - Parar a captura de áudio.
   - Fechar a conexão WebSocket.
   - Cancelar TTS ativo e gerações de IA pendentes.
   - Ocultar o painel flutuante.
   - Opcionalmente salvar o resumo final da sessão.
6. Segurança Básica (RNF-005 parcial):
   - O servidor local (orquestrador) deverá aceitar conexões somente de `127.0.0.1`.
   - Não expor endpoints na rede local por padrão.

---

## 🏁 Critérios de Aceite
- [ ] O áudio da aba é capturado sem silenciar a reunião para o usuário.
- [ ] Os blocos de áudio são convertidos em PCM 16kHz Mono.
- [ ] Os pacotes binários chegam corretamente via WebSocket ao orquestrador local.
- [ ] O encerramento da sessão libera todos os recursos (captura, WebSocket, painel).
- [ ] O servidor aceita conexões somente de `127.0.0.1`.

---

## 📎 Requisitos Rastreados
- **RF-001** — Iniciar sessão
- **RF-002** — Encerrar sessão
- **RF-003** — Capturar áudio da aba
- **RNF-005** — Segurança (parcial: bind localhost)
