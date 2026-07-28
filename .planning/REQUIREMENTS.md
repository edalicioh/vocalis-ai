# Requirements — Milestone v1.3

> Especificação de requisitos para o Marco v1.3: Chrome Built-in AI, Modos de Reunião & Otimizações de Áudio.

---

## v1.3 Requirements

### Chrome Built-in AI (Pré-processador Inteligente Local)
- [ ] **CHROME-01**: A extensão utiliza a Prompt API (`window.ai.languageModel`) para realizar a correção ortográfica local de termos técnicos e jargões na transcrição do Whisper.
- [ ] **CHROME-02**: O módulo local realiza sumarização incremental contínua do histórico da conversa para compressão de tokens e classificação de categoria antes do envio ao Orquestrador.
- [ ] **CHROME-03**: A extensão lida graciosamente com a indisponibilidade da API `window.ai` desativando o pré-processamento on-device sem interromper o fluxo com o Orquestrador/Gemini Flash.


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
