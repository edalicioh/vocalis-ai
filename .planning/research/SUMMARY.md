# Research Summary — Milestone v1.3

> Síntese das pesquisas para o Marco v1.3: Chrome Built-in AI como Pré-processador Inteligente, Modos de Reunião & Otimizações de Áudio.

---

## 1. Stack & Arquitetura Refinada
- **Chrome Built-in AI APIs (`window.ai.languageModel` / `window.ai.writer`)**: Atua como **Pré-processador Local Inteligente** on-device (NLP local) para:
  1. Correção ortográfica de jargões técnicos na transcrição Whisper (ex: "Larabel" -> "Laravel").
  2. Sumarização incremental contínua para compressão de tokens da conversa.
  3. Classificação de intenção/categoria da pergunta e extração de palavras-chave.
- **Modelos de Inferência Factual (Gemini Flash / OpenAI / Claude / Ollama)**: Atuam como o **Cérebro de Raciocínio**, recebendo apenas o contexto sintetizado/compactado para respostas técnicas de altíssima precisão.
- **Silero VAD & RMS Energy Gate**: Filtragem dupla de áudio e silêncio.

## 2. Ganhos da Arquitetura
- **Redução massiva de tokens e custos**: O envio contínuo da transcrição bruta de 20min de reunião é substituído pelo envio de um resumo compacto pré-processado localmente.
- **Precisão Factual Preservada**: Respostas técnicas não são delegadas ao Gemini Nano (evitando limitações de NLP), mantendo a autoridade no Gemini Flash / GPT-4o / Claude.

---
*Commit efetuado com sucesso.*

