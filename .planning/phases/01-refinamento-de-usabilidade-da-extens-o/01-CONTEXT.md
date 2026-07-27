# Phase 1: Refinamento de Usabilidade da Extensão - Context

**Gathered:** 2026-07-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Esta fase compreende o aprimoramento da usabilidade e interatividade do painel flutuante injetado pelo `content-script.ts` da extensão Chrome (`apps/chrome-extension`). O escopo inclui redimensionamento livre por arrasto (drag-to-resize), slider de controle de opacidade, minimização rápida por duplo clique no header, toast visual de confirmação ao copiar e manutenção estrita do isolamento em Shadow DOM.
</domain>

<decisions>
## Implementation Decisions

### Redimensionamento do Painel (Drag-to-Resize)
- **D-01:** Incluir handle visual de arrasto no canto inferior direito (↘) do container em `overlay.tsx`.
- **D-02:** Respeitar os limites operacionais: Largura Mínima = 280px, Largura Máxima = 700px | Altura Mínima = 200px, Altura Máxima = 90vh.
- **D-03:** Persistir as dimensões ajustadas no `localStorage` sob a chave `copilotDimensions` (`{ width: number, height: number }`).

### Controle de Opacidade
- **D-04:** Adicionar slider de opacidade (`input type="range"`) no menu de ajustes (⚙️) (`SettingsForm`).
- **D-05:** Faixa de transparência permitida entre 30% (`0.3`) e 100% (`1.0`).
- **D-06:** Persistir o valor preferido no `localStorage` sob a chave `copilotOpacity`.

### Minimização Rápida
- **D-07:** Implementar suporte a duplo clique (`onDoubleClick`) no header/toolbar do painel para alternar rapidamente entre o estado expandido e o modo pílula/compacto.
- **D-08:** Suportar atalho de teclado `Alt+C` como alternativa de acessibilidade.

### Feedback de Cópia
- **D-09:** Exibir toast flutuante com a mensagem "Copiado! ✓" posicionado no rodapé do painel com duração de 2 segundos após a ação de cópia.

### Estilização & Shadow DOM
- **D-10:** Manter isolamento total do CSS injetando estilos inline (`React.CSSProperties`) e elementos `<style>` internos no Shadow DOM de `apps/chrome-extension/src/content/content-script.ts`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `UI-SPEC.md` — Contrato de design e UI da extensão Chrome
- `AGENTS.md` § Diretrizes de UI & Usabilidade — Regras de estilo em Shadow DOM e limites do painel
- `apps/chrome-extension/src/content/overlay.tsx` — Componente principal da UI do painel flutuante
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CopilotOverlay` em `apps/chrome-extension/src/content/overlay.tsx`: Já possui lógica básica de drag para reposicionamento (posição X/Y).
- `SettingsForm` em `apps/chrome-extension/src/shared/settings-form.tsx`: Componente de configurações onde o slider de opacidade será adicionado.

### Integration Points
- `localStorage`: Utilizado para persistência de `copilotPosition`, `copilotPanelMode` e agora `copilotDimensions` e `copilotOpacity`.
</code_context>

<specifics>
## Specific Ideas

- O handle de redimensionamento deve ter indicador visual discreto (ex: listras/ícone no canto inferior direito) sem poluir a interface.
- O toast de cópia deve ter transição suave de fade-in e fade-out.
</specifics>

<deferred>
## Deferred Ideas

- Presets de layout por tipo de reunião (ex: tela dividida 50/50).
- Suporte a múltiplos temas de cor customizados.
</deferred>

---
*Phase: 01-refinamento-de-usabilidade-da-extens-o*
*Context gathered: 2026-07-27*
