# Planos de Desenvolvimento por Fase — Copiloto de Conversas

Este diretório contém os planos detalhados para cada uma das 8 fases de desenvolvimento do **Copiloto de Conversas e Entrevistas Técnicas**, elaborados a partir do [Levantamento de Requisitos.md](file:///d:/dev/projetos/Edalicio/conversation-copilot/Levantamento%20de%20Requisitos.md).

---

## 📐 Convenções

| Item | Padrão |
| :--- | :--- |
| Eventos WebSocket | `dot.notation` (ex: `answer.delta`, `transcript.final`, `session.start`) |
| Diretório Whisper | `services/whisper/` |
| Provedor de IA | Substituível via interface `AnswerProvider` (padrão: Gemini) |
| Limiares de pausa | Progressivos: 400ms / 700ms / 1000-1300ms |
| Rastreabilidade | Cada fase inclui seção **📎 Requisitos Rastreados** com IDs (RF, RNF, RN) |

---

## 🗺️ Índice das Fases

| Fase | Arquivo do Plano | Descrição Principal |
| :--- | :--- | :--- |
| **Fase 1** | [fase-1-prova-de-conceito-de-audio.md](file:///d:/dev/projetos/Edalicio/conversation-copilot/context/plans/fase-1-prova-de-conceito-de-audio.md) | Captura de áudio, streaming via WebSocket, encerramento de sessão e bind localhost. |
| **Fase 2** | [fase-2-whisper-local.md](file:///d:/dev/projetos/Edalicio/conversation-copilot/context/plans/fase-2-whisper-local.md) | Serviço de transcrição local em `services/whisper/` com `faster-whisper` e eventos `transcript.*`. |
| **Fase 3** | [fase-3-painel-flutuante.md](file:///d:/dev/projetos/Edalicio/conversation-copilot/context/plans/fase-3-painel-flutuante.md) | Painel flutuante com Shadow DOM, 5 modos visuais, mover e redimensionar. |
| **Fase 4** | [fase-4-integracao-com-ia.md](file:///d:/dev/projetos/Edalicio/conversation-copilot/context/plans/fase-4-integracao-com-ia.md) | Detecção de perguntas (limiares progressivos), resposta JSON estruturada, 4 modos de resposta, `AnswerProvider`. |
| **Fase 5** | [fase-5-streaming-e-cancelamento.md](file:///d:/dev/projetos/Edalicio/conversation-copilot/context/plans/fase-5-streaming-e-cancelamento.md) | Streaming token-a-token com eventos `answer.*`, cancelamento ativo e marcação visual. |
| **Fase 6** | [fase-6-tts.md](file:///d:/dev/projetos/Edalicio/conversation-copilot/context/plans/fase-6-tts.md) | TTS com 5 modos, velocidade/volume ajustáveis, destaque sincronizado, `SpeechProvider`. |
| **Fase 7** | [fase-7-perfil-vaga-e-contexto.md](file:///d:/dev/projetos/Edalicio/conversation-copilot/context/plans/fase-7-perfil-vaga-e-contexto.md) | Perfil e vaga detalhados, sumarização assíncrona com triggers definidos. |
| **Fase 8** | [fase-8-metricas-e-estabilizacao.md](file:///d:/dev/projetos/Edalicio/conversation-copilot/context/plans/fase-8-metricas-e-estabilizacao.md) | Métricas detalhadas, segurança (token, rate limit), privacidade, salvar sessão, estabilidade 1h+. |
