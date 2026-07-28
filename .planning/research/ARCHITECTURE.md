# Research: Architecture — Milestone v1.3

## Arquitetura Híbrida: Chrome Built-in AI como Pré-Processador Inteligente

```
+-----------------------------------------------------------------------------------------+
| Pipeline de Transcrição & Processamento Local                                            |
|                                                                                         |
|  [Áudio Reunião] ──> [Whisper Local (VAD)] ──> Transcrição Bruta                        |
|                                                     │                                   |
|                                                     ▼                                   |
|                                          [Chrome Built-in AI / Gemini Nano]             |
|                                          (Prompt API & Writer API local)                |
|                                          ├─ Corrigir nomes técnicos (ex: Larabel -> Laravel)|
|                                          ├─ Resumo incremental da conversa              |
|                                          ├─ Classificar intenção & categoria            |
|                                          └─ Extrair palavras-chave & termos             |
|                                                     │                                   |
|                                                     ▼                                   |
|                                           [Detector de Perguntas]                       |
|                                                     │                                   |
|                                                     ▼ (Se Pergunta Técnica Detectada)   |
|                                           [Contexto Compactado]                         |
|                                           (Resumo + Perfil + Pergunta Refinada)         |
|                                                     │                                   |
|                                                     ▼                                   |
|                                           [Cloud LLM / AnswerProvider]                  |
|                                           (Gemini Flash / OpenAI / Claude / Ollama)     |
|                                                     │                                   |
|                                                     ▼                                   |
|                                           [Resposta Técnica Precisa em 4 Widgets HUD]   |
+-----------------------------------------------------------------------------------------+
```

### Papéis Claros na Arquitetura

1. **Chrome Built-in AI / Gemini Nano (Local / On-device)**:
   - **Função**: Pré-processamento e NLP local de alta velocidade.
   - **Tarefas**: Correção ortográfica de termos técnicos na transcrição Whisper, sumarização incremental da conversa (compressão de tokens), classificação da categoria da pergunta e extração de palavras-chave.
   - **Vantagem**: Reduz até 80% do volume de tokens enviados à nuvem, diminui custos e latência de pré-processamento.

2. **Cloud/Local Answer Providers (Gemini Flash, GPT-4o, Claude 3.5, Ollama)**:
   - **Função**: Raciocínio técnico e precisão factual.
   - **Tarefas**: Resposta detalhada e exata a perguntas de arquitetura, código, algoritmos e system design.


---
*Gerado durante o planejamento do Milestone v1.3*
