# Requirements — Milestone v1.3

> Especificação de requisitos para o Marco v1.3: Chrome Built-in AI, Modos de Reunião & Otimizações de Áudio.

---

## v1.3 Requirements

### Chrome Built-in AI (Gemini Nano)
- [ ] **CHROME-01**: O usuário pode selecionar o provedor `Chrome Built-in AI (Gemini Nano)` no seletor de IA se o navegador suportar a Prompt API (`window.ai`).
- [ ] **CHROME-02**: A extensão realiza streaming em tempo real das sugestões usando a Prompt API (`session.promptStreaming`) sem requisições de rede externas.
- [ ] **CHROME-03**: A aplicação realiza fallback automático para outro provedor configurado caso a API `window.ai` não esteja disponível ou ocorra um erro de inferência on-device.

### Modos de Reunião Adaptativos & Contexto
- [ ] **MODE-01**: O usuário pode selecionar o modo de reunião ativo no painel/popup entre: Entrevista Técnica, System Design, Code Review e Reunião Geral.
- [ ] **MODE-02**: O orquestrador ajusta dinamicamente os prompts de sistema e heurísticas de resposta com base no modo de reunião selecionado.
- [ ] **MODE-03**: O usuário pode fornecer notas ou documentos de contexto específicos para o modo ativo (ex: requisitos da vaga ou diretrizes do projeto).

### Pipeline de Áudio & VAD (Voice Activity Detection)
- [ ] **AUDIO-01**: O serviço de transcrição Whisper utiliza Silero VAD (`vad_filter=True`) para descartar trechos de silêncio e ruído antes do reconhecimento de fala.
- [ ] **AUDIO-02**: O Offscreen Document descarta pacotes de áudio PCM abaixo do limiar de energia (RMS Energy Gate) para poupar uso de CPU e tráfego WebSocket.

---

## Future Requirements (Deferred)
- [ ] **CHROME-04**: Suporte à Writer API e Rewriter API para reescrever respostas curtas diretamente no HUD.
- [ ] **AUDIO-03**: Supressão de ruído por redes neurais (RNNoise) no áudio antes do envio ao servidor.

---

## Out of Scope
- Processamento de vídeo ou visão computacional no Gemini Nano — *Escopo estritamente focado em áudio e texto*.
- Fine-tuning do modelo on-device — *Modelos do Chrome Built-in AI são imutáveis e gerenciados pelo próprio navegador*.

---

## Requirement Traceability

| Requirement | Phase | Status |
|:---|:---|:---|
| CHROME-01 | Phase 7 | Pending |
| CHROME-02 | Phase 7 | Pending |
| CHROME-03 | Phase 7 | Pending |
| MODE-01 | Phase 8 | Pending |
| MODE-02 | Phase 8 | Pending |
| MODE-03 | Phase 8 | Pending |
| AUDIO-01 | Phase 9 | Pending |
| AUDIO-02 | Phase 9 | Pending |
