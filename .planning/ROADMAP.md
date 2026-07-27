# Project Roadmap — conversation-copilot

> Roadmap de execução em fases para o desenvolvimento do Copiloto de Conversas.

---

## Vision & Milestones

### Milestone 1 — Usabilidade & Orquestração Avançada (Fase Atual)

| Phase | Title | Goal | Requirements | Success Criteria |
|:---|:---|:---|:---|:---|
| **Phase 1** | Refinamento de Usabilidade da Extensão | Implementar redimensionamento livre, opacidade ajustável, atalho de minimização e toast de cópia no Shadow DOM. | `UI-01`, `UI-02`, `UI-03`, `UI-04`, `UI-05` | 4 critérios |
| **Phase 2** | Aprimoramento da Orquestração & IA | Injetar perfil/vaga no contexto do Gemini e garantir cancelamento instantâneo de streaming. | `AI-01`, `AI-02`, `AI-03` | 2 critérios |

---

## Phase Details

### Phase 1: Refinamento de Usabilidade da Extensão
**Goal**: Melhorar substancialmente a experiência visual do painel flutuante sobre chamadas de vídeo.
**Requirements**: `UI-01`, `UI-02`, `UI-03`, `UI-04`, `UI-05`
**UI Hint**: yes
**Success Criteria**:
1. O painel flutuante suporta redimensionamento livre (drag-to-resize) dentro dos limites 280-700px (largura) e 200px-90vh (altura), salvando a preferência no `localStorage`.
2. O usuário pode ajustar a transparência do painel via slider de opacidade com persistência.
3. O painel recolhe rapidamente para o modo compacto ao dar duplo clique na barra de título.
4. É exibido um toast de confirmação ("Copiado! ✓") ao clicar no botão de cópia de sugestão.

### Phase 2: Aprimoramento da Orquestração & IA
**Goal**: Garantir que as sugestões de resposta considerem a vaga/perfil do usuário e tenham cancelamento rápido.
**Requirements**: `AI-01`, `AI-02`, `AI-03`
**UI Hint**: no
**Success Criteria**:
1. O prompt enviado ao Gemini injeta automaticamente as variáveis de perfil do candidato e descrição da vaga configurados.
2. O orquestrador envia um sinal de cancelamento (`answer.cancelled`) e aborta a requisição ativa ao detectar uma nova pergunta do entrevistador.
