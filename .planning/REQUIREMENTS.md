# Requirements — conversation-copilot

> Requisitos do projeto com rastreabilidade para o roadmap de execução.

---

## v1 Requirements (Fase Atual / MVP)

### Interface & Usabilidade (UI)
- [ ] **UI-01**: O painel flutuante deve suportar redimensionamento livre por arrasto (drag-to-resize) com limites de largura (280px min / 700px máx) e altura (200px min / 90vh máx), salvando as dimensões preferidas no `localStorage` (`copilotDimensions`).
- [ ] **UI-02**: O painel flutuante deve conter um controle de opacidade/transparência ajustável pelo usuário e persistido em `localStorage` (`copilotOpacity`).
- [ ] **UI-03**: O painel deve suportar minimização rápida instantânea através de duplo clique no header ou atalho de teclado (`Alt+C`).
- [ ] **UI-04**: O painel deve exibir um feedback visual em toast ao copiar o texto das sugestões ("Copiado! ✓").
- [ ] **UI-05**: Estilização do content script deve ser mantida isolada via Shadow DOM utilizando `React.CSSProperties` e `<style>` injetada no Shadow DOM sem dependência de loaders runtime.

### Inteligência & Orquestração (AI)
- [ ] **AI-01**: O orquestrador deve permitir injeção dinâmica de Perfil Profissional e Descrição da Vaga no contexto enviado ao modelo Gemini.
- [ ] **AI-02**: O servidor de streaming deve cancelar imediatamente respostas anteriores ao detectar que uma nova pergunta foi iniciada pelo entrevistador.
- [ ] **AI-03**: Manutenção da interface abstrata `AnswerProvider` para permitir troca rápida de provedores de IA.

---

## v2 Requirements (Próximos Marcos)

- [ ] **HIST-01**: Armazenamento completo de sessões gravadas para revisão offline posterior.
- [ ] **TOPIC-01**: Destaque automático de palavras-chave técnicas e conceitos chave em badges dedicados no painel.

---

## Out of Scope (Fora do Escopo)

- **Gravação de Vídeo / Webcam**: *Foco exclusivo em áudio e texto para manter performance e baixo uso de recursos.*
- **Execução Automática de Código**: *Evitar riscos de segurança e foco na assistência conceitual.*
- **Busca Automática na Web durante a Chamada**: *Minimizar latência de resposta.*

---

## Rastreabilidade (Traceability)

| REQ-ID | Categoria | Descrição Sucinta | Fase do Roadmap | Status |
|:---|:---|:---|:---|:---|
| **UI-01** | Interface | Redimensionamento livre do painel com limites | Phase 1 | Pending |
| **UI-02** | Interface | Slider de controle de opacidade | Phase 1 | Pending |
| **UI-03** | Interface | Minimização rápida por duplo clique | Phase 1 | Pending |
| **UI-04** | Interface | Toast feedback ao copiar sugestão | Phase 1 | Pending |
| **UI-05** | Interface | Isolamento Shadow DOM com React inline CSS | Phase 1 | Pending |
| **AI-01** | Inteligência | Contexto de perfil profissional e vaga | Phase 2 | Pending |
| **AI-02** | Inteligência | Cancelamento imediato de streaming antigo | Phase 2 | Pending |
| **AI-03** | Inteligência | Abstrações `AnswerProvider` desacopladas | Phase 2 | Pending |
