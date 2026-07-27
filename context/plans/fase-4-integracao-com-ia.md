# Plano da Fase 4 — Detecção de Perguntas e Integração com IA

## 🎯 Objetivo
Implementar a inteligência do orquestrador para identificar quando uma pergunta foi feita pelo entrevistador, construir o prompt com o contexto relevante e solicitar uma sugestão objetiva a uma API de modelo de linguagem, com provedor substituível.

---

## 📋 Escopo da Fase

1. Detecção Heurística de Perguntas (`QuestionDetector`):
   - Avaliação de padrões interrogativos em Português e Inglês (ex: "como você", "qual é", "por que", "pode explicar", "me explique", "conte uma situação").
   - Detecção de pausas com limiares progressivos (RF-006):
     - Pausa curta: **400 ms** — início de monitoramento.
     - Pausa provável: **700 ms** — pré-carregamento possível.
     - Final confirmado: **1.000 a 1.300 ms** — disparo da geração.
   - Possibilidade de envio antecipado à IA quando a confiança da pergunta for alta, antes do final confirmado.
   - Atribuição de pontuação com `isQuestion`, `score` e `reason`.
   - A transcrição parcial não deverá ser usada como pergunta final sem nível mínimo de confiança (RN-009).
2. Gerenciador de Contexto (`ContextManager`):
   - Injeção das informações do perfil profissional do usuário e requisitos da vaga.
   - Manutenção de uma janela deslizante das últimas falas recentes.
   - Informações do currículo utilizadas apenas quando relacionadas à pergunta (RN-006).
3. Interface Abstrata de IA (`AnswerProvider`):
   - Interface `AnswerProvider` substituível (RNF-006):
     ```typescript
     interface AnswerProvider {
       generate(input: AnswerInput): AsyncIterable<AnswerEvent>;
       cancel(requestId: string): Promise<void>;
     }
     ```
   - Implementação padrão: `GeminiProvider` com `@google/generative-ai` e modelo `gemini-1.5-flash`.
   - A arquitetura deverá permitir trocar para OpenAI, Anthropic ou outro provedor sem alterar o orquestrador.
4. Formato Estruturado da Resposta (RF-009):
   - O prompt deverá instruir o modelo a retornar JSON com os campos:
     ```json
     {
       "questionSummary": "...",
       "opening": "...",
       "answer": "...",
       "keyPoints": ["...", "..."],
       "clarifyingQuestion": "...",
       "audioHint": "..."
     }
     ```
   - O `response-parser` deverá validar e extrair os campos.
5. Modos de Resposta (RF-017):
   - **Palavras-chave** — retorna apenas tópicos (`keyPoints`).
   - **Curto** (padrão) — resposta de 30 a 60 palavras.
   - **Completo** — resposta de 80 a 150 palavras.
   - **Estruturado** — formato: Abertura → Decisão → Justificativa → Trade-offs → Exemplo.
   - O modo selecionado deverá influenciar o prompt enviado à API.

---

## 🏁 Critérios de Aceite
- [ ] Perguntas do entrevistador são identificadas automaticamente com limiares progressivos ou disparadas via atalho `Alt+S`.
- [ ] O prompt é montado combinando perfil, vaga e transcrição recente.
- [ ] A API retorna a sugestão no formato JSON estruturado.
- [ ] O provedor de IA é substituível via interface `AnswerProvider`.
- [ ] Os 4 modos de resposta funcionam corretamente.
- [ ] O modelo não inventa experiências profissionais do usuário (RN-004).

---

## 📎 Requisitos Rastreados
- **RF-006** — Detectar silêncio e final de fala
- **RF-007** — Detectar perguntas
- **RF-008** — Montar contexto
- **RF-009** — Gerar resposta com IA (formato estruturado)
- **RF-017** — Modos de resposta
- **RNF-006** — Manutenibilidade (interface `AnswerProvider`)
- **RN-001** — Não gerar resposta para toda frase transcrita
- **RN-003** — Respostas curtas por padrão
- **RN-004** — Não inventar experiências
- **RN-005** — Sugerir esclarecimento quando faltar contexto
- **RN-006** — Currículo usado apenas quando relevante
- **RN-009** — Transcrição parcial com confiança mínima
