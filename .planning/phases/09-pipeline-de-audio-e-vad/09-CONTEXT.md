# Phase 09: Pipeline de Áudio & Silero VAD (Voice Activity Detection) - Context

**Gathered:** 2026-07-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Implementar a otimização do pipeline de áudio com suporte a Voice Activity Detection (VAD). Inclui a ativação do Silero VAD nativo no backend Python (`faster-whisper`), a criação do RMS Energy Gate no `pcm-worklet.js` (cliente Chrome), feedback visual de voz ativa no HUD e controle de sensibilidade no painel de configurações.

</domain>

<decisions>
## Implementation Decisions

### Silero VAD no Serviço Whisper (Backend Python)
- **D-01:** Habilitar `vad_filter=True` com `vad_parameters=dict(min_silence_duration_ms=500, speech_pad_ms=400, threshold=0.5)` no `apps/transcription-service/main.py`.
- **D-02:** Descartar trechos de silêncio longo e ruído ambiente antes de realizar a inferência no `faster-whisper`.

### RMS Energy Gate no AudioWorklet (`pcm-worklet.js`)
- **D-03:** O `pcm-worklet.js` calcula a energia RMS ($\sqrt{\frac{1}{N}\sum x_i^2}$) para cada bloco de 4096 amostras PCM 16kHz.
- **D-04:** Se o RMS for inferior ao limiar (`rmsThreshold`), o buffer é descartado e não enviado via WebSocket, notificando `isAudioActive: false` à UI.

### Feedback Visual de Voz Ativa no HUD
- **D-05:** O botão "Ouvindo" no `FunctionBarWidget` fica com classe de pulso verde brilhante (`#22c55e`) quando `isAudioActive` for `true` (fala ativa) e azul suave/estático (`#818cf8`) em silêncio.

### Controle de Sensibilidade nas Configurações
- **D-06:** Adicionar o campo "Sensibilidade do Filtro de Ruído/Silêncio" no `SettingsForm` (`settings-form.tsx`):
  - Baixa (`rmsThreshold: 0.02`)
  - Média (`rmsThreshold: 0.01` - Padrão)
  - Alta (`rmsThreshold: 0.005`)
  - Desativado (`rmsThreshold: 0.0`)
- **D-07:** O valor é salvo no `chrome.storage.local` e comunicado ao `pcm-worklet.js` via porta de mensagem do Offscreen Document.

### Agent's Discretion
- Formatação dos logs e tratamento de reconexão de áudio no Offscreen Document.

</decisions>

<canonical_refs>
## Canonical References

### Specification & Architecture
- `.planning/research/ARCHITECTURE.md` — Estrutura de áudio PCM 16kHz e Offscreen Document.
- `.planning/REQUIREMENTS.md` — Requisitos `AUDIO-01` e `AUDIO-02`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/chrome-extension/public/pcm-worklet.js`: Processador de áudio em AudioWorklet.
- `apps/chrome-extension/src/offscreen/offscreen.ts`: Ponto de inicialização do AudioWorklet.
- `apps/transcription-service/main.py`: Servidor FastAPI com `faster-whisper`.
- `apps/chrome-extension/src/content/widgets/FunctionBarWidget.tsx`: Widget de controle de áudio no HUD.

</code_context>

<deferred>
## Deferred Ideas

- Supressão de ruído neurais pesados via RNNoise no cliente — reservado para `AUDIO-03` em marcos futuros.

</deferred>

---

*Phase: 09-pipeline-de-audio-e-vad*
*Context gathered: 2026-07-28*
