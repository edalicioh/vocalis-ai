# Research: Pitfalls — Milestone v1.3

## Cuidados, Riscos & Mitigações

### 1. Disponibilidade do Chrome Built-in AI
- **Risco**: A API `window.ai` é experimental e só está presente em versões recentes do Chrome (com flags ou Origin Trial ativas).
- **Mitigação**: Implementar feature detection com `window.ai?.languageModel?.capabilities()`. Caso o status seja `'no'` ou a API não esteja definida, a interface deve desabilitar o provedor Chrome AI e sugerir o uso do Gemini Cloud ou Ollama, emitindo fallback limpo sem exceções não tratadas.

### 2. Janela de Contexto & Desempenho do Gemini Nano
- **Risco**: O Gemini Nano (modelo on-device ~3B) possui restrições de tamanho de prompt e pode alucinar se o histórico de transcrição for muito longo.
- **Mitigação**: Truncar o histórico de transcrição enviado ao Gemini Nano para as últimas 2-3 frases mais recentes e utilizar prompts de sistema concisos.

### 3. VAD Cortando Início/Fim de Frases (Audio Clipping)
- **Risco**: Se o limiar do VAD for rígido demais, ele pode cortar consoantes fracas ou o início de perguntas em português.
- **Mitigação**: Configurar `min_silence_duration_ms=500` e adicionar um padding de áudio pré-fala (pre-roll buffer de 200ms) no PCM Worklet antes de disparar o envio.

---
*Gerado durante o planejamento do Milestone v1.3*
