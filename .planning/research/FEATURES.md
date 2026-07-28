# Research: Features — Milestone v1.3

## Tabela de Funcionalidades do Marco v1.3

| Categoria | Funcionalidade | Descrição | Complexidade | Diferencial vs Essencial |
|:---|:---|:---|:---|:---|
| **Chrome Built-in AI** | Provedor Native Gemini Nano | Provedor `ChromeBuiltInAIProvider` acoplado ao `AnswerProviderManager` para inferência offline e sem API Key | Média | Diferencial (Zero latency & Privacidade total) |
| **Chrome Built-in AI** | Fallback Inteligente | Fallback automático para Gemini Cloud / OpenAI / Ollama se Gemini Nano não estiver pronto ou disponível no Chrome | Baixa | Essencial |
| **Modos de Reunião** | Modos de Prompt Adaptativos | Seletor no HUD (Entrevista Técnica, System Design, Code Review, Alinhamento) que ajusta instrução do sistema do LLM | Baixa | Essencial |
| **Modos de Reunião** | Contexto Customizado por Modo | Injeção de notas/documentos adicionais específicos para o modo escolhido | Média | Diferencial |
| **Áudio & VAD** | Silero VAD no Transcriptor | Ativação do filtro Silero VAD no `faster-whisper` no serviço Python para desconsiderar ruídos de fundo e pausas | Média | Essencial |
| **Áudio & VAD** | Gatekeeper de Silêncio PCM | Filtro de energia RMS no Offscreen Worklet para não transmitir quadros de áudio quando o usuário estiver em silêncio | Baixa | Essencial |

---
*Gerado durante o planejamento do Milestone v1.3*
