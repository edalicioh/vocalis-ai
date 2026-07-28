# Context: Phase 6 — Arquitetura Modular de 4 Widgets HUD (UX/UI)

> Fase voltada para a reestruturação da interface da extensão Chrome em um sistema de HUD com 4 widgets flutuantes e independentes sobre as páginas de reunião.

---

## Requisitos Escopados

- **UI-01**: Decompor o overlay monolítico em 4 widgets flutuantes independentes (Barra de Funções, Painel de Resposta, Painel de Transcrição, Indicador de Status).
- **UI-02**: Implementar controle de arraste (`drag-to-move`), minimização/ocultação e persistência de posições e estados de cada widget em `localStorage`.
- **UI-03**: Aplicar o Design System `MASTER.md` (dark mode OLED, backdrop blur, fonte Inter, substituição de emojis por ícones Lucide SVG).
- **UI-04**: Implementar destaque visual de sentença lida por TTS e modos de layout rápido (Padrão, Compacto, Leitura, Palavras-chave).

---

## Decisões de Arquitetura Visual e Técnica

1. **Estado Inicial dos Widgets**:
   - Ao iniciar a sessão, o Indicador de Status e a Barra de Funções ficam visíveis por padrão.
   - Os painéis de Resposta e Transcrição expandem/aparecem automaticamente quando uma pergunta ou áudio é detectado.

2. **Posicionamento Padrão Inicial (HUD Layout)**:
   - Resposta: Centro-direita
   - Barra de Funções: Logo abaixo do Painel de Resposta
   - Transcrição: Canto inferior direito
   - Status: Topo (discreto)

3. **Comportamento do Autoscroll na Transcrição**:
   - Autoscroll inteligente: Rola para o final a cada nova fala, mas pausa automaticamente se o usuário fizer scroll manual para cima para consultar o histórico.

4. **Shadow DOM + Inline CSS**:
   - Mantida a injeção em Shadow DOM (`open`) para garantir isolamento contra o CSS da página de reunião (Google Meet, Zoom, Teams).
   - Estilização com `React.CSSProperties` inline + `<style>` injetada no Shadow DOM para animações, scrollbars e pseudo-classes (`:hover`, `:active`).

5. **Componentização dos 4 Widgets**:
   - `FunctionBarWidget.tsx`: Player horizontal compacto com botões de áudio, visualização, atalhos e menu popover `⋯`.
   - `ResponsePanelWidget.tsx`: Widget de resposta com hierarquia Nível 1 (Frase de abertura 18–22px), Nível 2 (Texto legível) e Nível 3 (Chips de palavras-chave).
   - `TranscriptionWidget.tsx`: Widget secundário de transcrição com as últimas 2–3 falas recentes.
   - `StatusIndicatorWidget.tsx`: Pill minimalista (`● Ouvindo`, `✦ Preparando resposta`, etc.) com popover de métricas de conexão.

6. **Substituição de Emojis por Lucide SVGs**:
   - Utilização da biblioteca `lucide-react` já instalada no pacote `apps/chrome-extension`.

7. **Gerenciador de Estado e Persistência de Posições**:
   - Salvamento automático em `localStorage` sob a chave `copilotWidgetPositions` e `copilotWidgetStates`.


---

## Referências Principais

- Documento de Especificação UX/UI: [UI-UX-PARA-DESIGNER.md](file:///d:/dev/projetos/Edalicio/conversation-copilot/UI-UX-PARA-DESIGNER.md)
- Design System Master: [MASTER.md](file:///d:/dev/projetos/Edalicio/conversation-copilot/design-system/copiloto-de-conversas/MASTER.md)
- Contrato Visual: [UI-SPEC.md](file:///d:/dev/projetos/Edalicio/conversation-copilot/UI-SPEC.md)
