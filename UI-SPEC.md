---
status: approved
slug: chrome-extension-ui-hud
created: 2026-07-28
shadcn_initialized: false
preset: none
---

# UI Design Contract — Chrome Extension HUD (Arquitetura Modular de 4 Widgets)

> Contrato visual e de interação para a interface da extensão Chrome (Phase 6). Define a arquitetura em 4 widgets flutuantes e independentes sobre as páginas de reunião, os controles de TTS com highlight por frase, e o alinhamento ao Design System `MASTER.md`.

---

## Design System

| Propriedade | Valor |
|-------------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none (React custom no Shadow DOM) |
| Icon library | **Lucide Icons** (`lucide-react` SVGs) |
| Font | `Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif` |
| CSS approach | `React.CSSProperties` inline (content-script) + `<style>` injetada no Shadow DOM para pseudo-classes (`:hover`, `:active`), scrollbars e keyframe animations |
| Rationale | O Shadow DOM isola totalmente a UI do CSS da host-page (Meet, Zoom, Teams). O isolamento dos 4 widgets em React com inline styles garante zero interferência e carregamento ultra-rápido. |

---

## Escopo da Extensão & Estrutura dos Widgets

A interface flutuante é dividida em **4 widgets independentes** posicionados sobre a host-page:

| Widget | Componente | Função & Hierarquia Visual |
|--------|------------|----------------------------|
| **Widget 1: Barra de Funções** | `FunctionBarWidget.tsx` | Player horizontal compacto de controle de escuta (`Mic`/`Play`), áudio/TTS (`Volume2`/`Pause`), modos visuais (`Eye`/`Layout`) e menu popover (`MoreHorizontal`). |
| **Widget 2: Painel de Resposta** | `ResponsePanelWidget.tsx` | **Prioridade 1**. Exibe: Nível 1 (Frase de abertura 18–22px), Nível 2 (Resposta completa legível) e Nível 3 (Chips de palavras-chave). |
| **Widget 3: Painel de Transcrição** | `TranscriptionWidget.tsx` | Widget secundário com as últimas 2–3 falas transcritas (diferenciando parcial e final). |
| **Widget 4: Indicador de Status** | `StatusIndicatorWidget.tsx` | Pill minimalista com status da sessão (`● Ouvindo`, `✦ Preparando resposta`, etc.) e popover de detalhes ao clicar. |

### Regras de Exibição & Ativação de Página
- **Auto-exibição**: Montado automaticamente em `meet.google.com`, `zoom.us`, `teams.microsoft.com`, `teams.live.com`, `webex.com`, `whereby.com`.
- **Ativação sob demanda**: Usuário pode ativar/desativar qualquer widget pelo Popup da extensão.
- **Posicionamento & Arraste**: Cada widget possui um handle de arraste (`⠿` / `GripVertical`), movimentação livre (`drag-to-move`), clamp aos limites da tela e persistência de coordenadas em `localStorage`.

---

## Dimensões & Spacing Scale (Base 4px)

| Widget | Largura Padrão | Largura Min / Max | Altura Min / Max | Persistência LocalStorage |
|--------|----------------|-------------------|------------------|---------------------------|
| **Barra de Funções** | 320px | 260px / 450px | 44px (fixa) | `copilotFunctionBarPosition` |
| **Painel de Resposta** | 420px | 300px / 700px | 180px / 80vh | `copilotResponsePanelPosition` |
| **Painel de Transcrição**| 340px | 280px / 500px | 120px / 40vh | `copilotTranscriptionPanelPosition` |
| **Indicador de Status** | 140px | 120px / 220px | 32px (fixa) | `copilotStatusIndicatorPosition` |

### Escala de Espaçamento

| Token | Valor | Uso |
|-------|-------|-----|
| xs | 4px | Gap interno de botões e badges |
| sm | 8px | Padding de cards, gap entre chips de palavra-chave |
| md | 12px | Padding interno de widgets e menus popover |
| lg | 16px | Padding externo dos painéis principais; border-radius dos containers |
| xl | 20px | Margem de respiro contra os limites da tela |

---

## Typography & Hierarquia Visual

| Papel | Tamanho | Peso | Line Height | Aplicação |
|-------|---------|------|-------------|-----------|
| **Frase de Abertura (Nível 1)** | 18px – 20px | 600 | 1.4 | Destaque principal no Painel de Resposta ("COMO COMEÇAR") |
| **Resposta (Nível 2)** | 15px – 16px | 400 | 1.6 | Corpo da resposta recomendada |
| **Transcrição (Widget 3)** | 13px – 14px | 400 | 1.5 | Falas transcritas da reunião |
| **Labels & Chips (Nível 3)** | 11px – 12px | 600 | 1.2 | Badges de palavras-chave, botões da barra, pills de status (uppercase, `letterSpacing: 0.5px`) |
| **Micro Labels** | 10px | 400 | 1.2 | Detalhes de latência e tooltips |

---

## Palette de Cores & Tokens (Dark Mode OLED)

Conforme definido em `MASTER.md`:

| Token | Valor Hex / RGBA | Aplicação |
|-------|------------------|-----------|
| `--bg-widget` | `rgba(15, 15, 35, 0.88)` | Fundo com `backdrop-filter: blur(12px)` em todos os 4 widgets |
| `--border-widget` | `rgba(99, 102, 241, 0.25)` | Borda sutil de 1px com tom indigo/blue |
| `--text-primary` | `#F8FAFC` | Frase de abertura e textos principais |
| `--text-secondary` | `#94A3B8` | Corpo da resposta e falas secundárias |
| `--accent-indigo` | `#6366F1` | Cor principal de foco, botões ativos e seleção |
| `--starter-highlight` | `#A5B4FC` | Fundo/borda sutil da Frase de Abertura |
| `--status-listening` | `#22C55E` | Verde ativo ("Ouvindo" / "Conectado") |
| `--status-warning` | `#F59E0B` | Amarelo de atenção ("Reconectando" / "Pergunta detectada") |
| `--status-error` | `#EF4444` | Vermelho de erro de áudio ou desconexão |

---

## Mapeamento de Ícones Lucide SVG

Substituição integral dos emojis por componentes `lucide-react`:

| Ação / Elemento | Emoji Antigo | Componente Lucide |
|-----------------|--------------|-------------------|
| Handle de Arraste | `⋮⋮` | `<GripVertical size={16} />` |
| Iniciar / Retomar | `▶` | `<Play size={14} />` |
| Ouvindo (Mic) | `🎙` | `<Mic size={14} />` |
| Áudio / TTS | `🔊` / `🔇` | `<Volume2 size={14} />` / `<VolumeX size={14} />` |
| Modos Visuais | `👁` / `▣` | `<Eye size={14} />` / `<Layout size={14} />` |
| Menu Mais | `⋯` | `<MoreHorizontal size={16} />` |
| Configurações | `⚙️` | `<Settings size={14} />` |
| Minimizar | `—` | `<Minus size={14} />` |
| Fechar | `×` | `<X size={14} />` |
| Indicador IA | `✦` | `<Sparkles size={14} />` |

---

## Destaque Visual de Sentença no TTS

Durante a leitura em voz alta por TTS:
- A frase ativamente falada recebe destaque sutil: `background: rgba(99, 102, 241, 0.18)`, `borderLeft: 3px solid #6366f1`, `paddingLeft: 8px`, `transition: all 200ms ease`.
- O destaque avança de forma sutil frase a frase sem causar reflow ou pulo no scroll.

---

## Modos de Layout Rápidos

1. **Padrão**: Todos os 4 widgets ativos e visíveis em suas posições normais.
2. **Compacto**: Painel de Resposta exibe apenas a Frase de Abertura; Transcrição oculta; Barra compacta.
3. **Leitura**: Painel de Resposta expandido com foco no TTS e highlight de frase; Transcrição oculta.
4. **Palavras-chave**: Apenas os chips de palavras-chave e a barra de funções visíveis.

---

## Acessibilidade (WCAG 2.1 AA)

- **Keyboard Navigation**: Todos os botões da barra e controles de widget possuem `tabIndex={0}` e estado de foco visível (`outline: 2px solid #818cf8`, `outlineOffset: 2px`).
- **Atalhos Globais**:
  - `Alt+C` → Alterna visibilidade dos widgets
  - `Alt+S` → Força geração de sugestão
  - `Esc` → Minimiza widgets em foco
- **ARIA**: `aria-live="polite"` para streaming de resposta; `aria-live="assertive"` para perguntas detectadas; `role="log"` para transcrição.

---

*Contrato de UI aprovado para a Phase 6 — Arquitetura Modular de 4 Widgets HUD.*
