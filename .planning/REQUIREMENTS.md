# Requirements — Milestone v1.5

> Especificação de requisitos para o Marco v1.5: Supressão de Ruído Avançada, Diagnósticos de Latência & Atalhos Globais.

---

## v1.5 Requirements

### Supressão de Ruído Avançada & Filtros DSP
- [ ] **AUDIO-03**: O Offscreen Document / AudioWorklet aplica um filtro de supressão de ruído (DynamicsCompressor & BiquadFilter DSP / RNNoise) para eliminar ruído ambiente pesado de fundo.

### Métrica & Painel de Diagnósticos de Latência
- [ ] **DIAG-01**: O painel HUD exibe métricas de latência end-to-end em tempo real (tempo de transcrição Whisper, tempo de inferência LLM e latência de rede WebSocket em ms).

### Atalhos de Teclado Globais & Comandos do Chrome
- [ ] **SHORTCUT-01**: Suporte a atalhos de teclado globais configuráveis (`chrome.commands`) para forçar resposta de IA (`Alt+A`), alternar gravação (`Alt+R`) e alternar leitura TTS (`Alt+S`).

---

## Completed Requirements (Milestones v1.0 - v1.4)
- [x] **CHROME-01**: A extensão utiliza a Prompt API (`window.ai.languageModel`) para correção ortográfica local.
- [x] **CHROME-02**: Sumarização incremental contínua do histórico da conversa.
- [x] **CHROME-03**: Fallback gracioso na ausência de `window.ai`.
- [x] **CHROME-04**: Suporte à Writer API e Rewriter API para reescrever respostas diretamente no HUD.
- [x] **MODE-01**: Seleção de modo de reunião ativo no painel/popup.
- [x] **MODE-02**: Prompts de sistema adaptativos no Orquestrador.
- [x] **MODE-03**: Notas de apoio em Markdown por modo de reunião.
- [x] **AUDIO-01**: Silero VAD nativo (`vad_filter=True`) no servidor Whisper.
- [x] **AUDIO-02**: RMS Energy Gate no AudioWorklet para descarte local de silêncio.

---

## Requirement Traceability

| Requirement | Phase | Status |
|:---|:---|:---|
| CHROME-01 | Phase 7 | Completed |
| CHROME-02 | Phase 7 | Completed |
| CHROME-03 | Phase 7 | Completed |
| MODE-01 | Phase 8 | Completed |
| MODE-02 | Phase 8 | Completed |
| MODE-03 | Phase 8 | Completed |
| AUDIO-01 | Phase 9 | Completed |
| AUDIO-02 | Phase 9 | Completed |
| CHROME-04 | Phase 10 | Completed |
| AUDIO-03 | Phase 11 | Pending |
| DIAG-01 | Phase 12 | Pending |
| SHORTCUT-01 | Phase 13 | Pending |
