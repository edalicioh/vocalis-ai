---
status: approved
slug: chrome-extension-ui
created: 2026-07-27
shadcn_initialized: false
preset: none
---

# UI Design Contract — Chrome Extension (Painel Flutuante)

> Contrato visual e de interação para a interface da extensão Chrome. Gera o painel flutuante sobre páginas de reunião, o popup de configurações e os controles de TTS.

---

## Design System

| Propriedade | Valor |
|-------------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none |
| Icon library | emojis (inline) + SVGs inline quando necessário |
| Font | `system-ui, -apple-system, -apple-system-font, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif` |
| CSS approach | `React.CSSProperties` inline (content-script) + `<style>` injetada no Shadow DOM para pseudo-selectores e media queries |
| Rationale | Shadow DOM + bundle IIFE do content-script impõem: (1) impossibilidade de imports CSS separados em runtime, (2) necessidade de isolamento total do CSS da host-page, (3) budget mínimo do bundle. shadcn, Tailwind e qualquer CSS-in-JS baseado em runtime não são aplicáveis neste contexto. |

---

## Escopo da Extensão

A extensão possui **3 superfícies de UI**:

| Superfície | Arquivo | Montagem |
|------------|---------|----------|
| Popup (toolbar) | `popup.tsx` + `popup.html` | Aberta pelo `action.default_popup` do manifest. Contém controle de ativação da página atual. |
| Painel flutuante | `overlay.tsx` | Montado via `content-script.ts` dentro de Shadow DOM sobre a host-page |
| Settings (compartilhado) | `settings-form.tsx` | Renderizado dentro do popup E do painel |

**Regras de Exibição & Ativação de Página**:
- **Auto-exibição em reuniões**: O script monta o painel automaticamente nos domínios `meet.google.com`, `zoom.us`, `teams.microsoft.com`, `teams.live.com`, `webex.com`, `whereby.com`.
- **Navegação comum (oculto por padrão)**: Em qualquer outro domínio, a bolinha flutuante fica **desativada por padrão** para evitar poluição visual.
- **Ativação Sob Demanda**: O usuário pode clicar em *"Ativar Copiloto nesta página"* no popup da extensão para exibir a bolinha/painel em qualquer site arbitrário.

**Painel flutuante** — Largura ajustável (padrão 380px, min 280px, max 700px), altura ajustável (padrão auto, min 200px, max 90vh), `position: fixed`, `z-index: 999999`. Três estados visuais: botão colapsado (círculo 52px), painel expandido arrastrável/redimensionável, e minificação rápida via duplo clique ou atalho `Alt+C`.

---

## Spacing Scale

Escala de 4px (múltiplos de 4 exclusivamente). Valores prescritos para o contexto de um painel flutuante redimensionável:

| Token | Valor | Uso no painel |
|-------|-------|---------------|
| 2xs | 2px | Exceção: gap entre badges de keyword |
| xs | 4px | Gap entre botões da action bar; padding interno mínimo |
| sm | 8px | Padding de cards (transcrição, streaming, sugestão); gap entre seções no scroll area |
| md | 12px | Padding lateral do painel (toolbar, action bar, status bar); padding de campos do settings |
| lg | 16px | Padding externo do painel (container); gap entre grupo de campos no settings |
| xl | 20px | Gap entre blocos maiores (seção transcrição → seção sugestão) |
| 2xl | 24px | Reserva para futuros layouts internos |

**Exceções:** Nenhuma. Todos os valores devem ser múltiplos de 4 (exceto 2px para badges, justificado pela natureza compacta dos badges de keyword). Valores como 3px, 6px, 7px, 9px, 10px, 11px, 13px, 14px existentes no código atual devem ser migrados para o múltiplo de 4 mais próximo.

**Dimensões e limites do painel:**

| Dimensão | Valor | Status |
|----------|-------|--------|
| Largura padrão | 380px | Ajustável (persistido em `copilotDimensions`) |
| Largura Mínima / Máxima | 280px / 700px | Limite de segurança |
| Altura Mínima / Máxima | 200px / 90vh | Limite de segurança |
| Tamanho do botão colapsado | 52px (círculo) | Travar |
| Opacidade ajustável | 50% a 100% (padrão 95%) | Persistido em `copilotOpacity` |
| Max-height do scroll area | `calc(100% - 120px)` | Derivado da altura atual |
| Max-height do settings scroll | 320px | Travar |
| Transcrição: máx. itens visíveis | 16 (últimos) | Travar |
| Sugestões: máx. cards visíveis | 3 (completas) + 1 (streaming) | Travar |

---

## Typography

| Papel | Size | Weight | Line Height | Uso |
|-------|------|--------|-------------|-----|
| Display | 15px | 700 | 1.3 | Título do popup (`Copiloto de Conversas`) |
| Heading | 12px | 600 | 1.4 | Label da toolbar (`Copiloto`); títulos de seção |
| Body | 12px | 400 | 1.5 | Texto de transcrição; corpo de sugestões; texto de settings |
| Caption | 10px | 400 | 1.3 | Status bar; badges de keyword; dicas; suffix de modo |
| Micro | 9px | 400 | 1.2 | Confidence percentage; badges muito pequenos |

**Font:** `system-ui, -apple-system, -apple-system-font, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif` — declarada explicitamente em todos os containers do painel. Inter NÃO será incluído (não está bundled; Shadow DOM não carrega webfonts externas sem strategy adicional).

**Convenções:**
- Seções de transcrição: `textTransform: uppercase`, `letterSpacing: '0.05em'`, `fontSize: 10px`, `fontWeight: 600`
- Botões de ação: `fontSize: 13px`, `fontWeight: 600`
- Parágrafos de settings hint: `fontSize: 10px`, `color: #6b7280`, `lineHeight: 1.4`
- Labels de settings: `fontSize: 11px`, `fontWeight: 500`, `color: #9ca3af`
- Inputs de settings: `fontSize: 12px`, `fontWeight: 400`, `color: #f9fafb`

---

## Color

Paleta auto-extraída do código atual (espelha escala Tailwind `slate` + `blue`). Contrato formaliza os valores:

### Camadas de superfície (60% dominante)

| Camada | Valor | Uso |
|--------|-------|-----|
| bg-base | `#111827` | Fundo do painel, fundo do popup |
| bg-elevated | `rgba(17, 24, 39, 0.95)` | Container principal do painel (com blur de backdrop) |
| bg-surface | `rgba(31, 41, 55, 0.8)` | Cards de sugestão completos |
| bg-overlay | `rgba(17, 24, 39, 0.92)` | Botão colapsado |
| bg-input | `#1f2937` | Campos de input no settings |
| bg-transcription | `rgba(0, 0, 0, 0.3)` | Fundo da lista de transcrição |

### Texto (30% secundário)

| Token | Valor | Uso |
|-------|-------|-----|
| text-primary | `#f9fafb` | Texto principal do painel; corpo de respostas |
| text-secondary | `#e5e7eb` | Texto em cards; corpo de settings |
| text-muted | `#9ca3af` | Labels; texto secundário; modo suffix |
| text-dim | `#6b7280` | Hints; confidence; texto muito secundário |
| text-confidence | `#4b5563` | Percentual de confidence na transcrição |

### Bordas e divisões (10%)

| Token | Valor | Uso |
|-------|-------|-----|
| border-panel | `1px solid rgba(255, 255, 255, 0.12)` | Borda do painel |
| border-button | `1px solid rgba(255, 255, 255, 0.15)` | Borda do botão colapsado |
| border-card | `1px solid rgba(255, 255, 255, 0.08)` | Bordas de cards |
| border-input | `1px solid #374151` | Bordas de campos settings |
| border-divider-toolbar | `1px solid rgba(255, 255, 255, 0.08)` | Divisor toolbar |
| border-divider-action | `1px solid rgba(255, 255, 255, 0.06)` | Divisor action bar |
| border-divider-status | `1px solid rgba(255, 255, 255, 0.04)` | Divisor status bar |
| border-settings-tab | `1px solid #374151` | Divisor da barra de abas |

### Cor de destaque (accent)

| Token | Valor | Uso reservado (EXCLUSIVO) |
|-------|-------|---------------------------|
| accent | `#2563eb` | Botão primário "Iniciar Captura" / "Parar"; botão "Salvar Configurações"; borda do card streaming |
| accent-hover | `#3b82f6` | Hover do botão primário |
| accent-light | `#60a5fa` | Tabs ativos; sliders; labels de speaker; título do popup |
| accent-lighter | `#93c5fd` | Título da pergunta streaming; badges de keyword (texto) |
| accent-bg | `rgba(30, 58, 138, 0.4)` | Fundo do card de streaming |

### Cores semânticas de status

| Token | Valor | Uso |
|-------|-------|-----|
| status-success | `#10b981` | Indicador Whisper conectado; glow do indicador |
| status-success-glow | `0 0 8px #10b981` | Glow do indicador ativo |
| status-warning | `#fbbf24` | Banner de pergunta detectada; labels de pergunta |
| status-warning-bg | `rgba(251, 191, 36, 0.15)` | Fundo do banner de pergunta |
| status-warning-border | `1px solid rgba(251, 191, 36, 0.3)` | Borda do banner de pergunta |
| status-error | `#ef4444` | Borda de card de erro; label de erro; stripe de cancelled; indicador offline |
| status-error-bg | `rgba(127, 29, 29, 0.35)` | Fundo do card de erro |
| status-info | `#fbbf24` | Indicador IA não configurado (amarelo) |

### Ações destrutivas

| Token | Valor | Uso |
|-------|-------|-----|
| destructive | `#dc2626` | Botão "Parar Captura" (fundo vermelho) |
| destructive-hover | `#ef4444` | Hover do botão destrutivo |

### Outros

| Token | Valor | Uso |
|-------|-------|-----|
| opening-line | `#34d399` | Linha de abertura (✨) em sugestões completas |
| keyword-bg | `rgba(59, 130, 246, 0.2)` | Fundo de badges de keyword |
| keyword-border | `1px solid rgba(59, 130, 246, 0.3)` | Borda de badges de keyword |
| action-surface | `rgba(255, 255, 255, 0.06)` | Fundo de botões de ação na toolbar |
| action-surface-border | `1px solid rgba(255, 255, 255, 0.1)` | Borda de botões de ação |
| action-bar-tint | `rgba(255, 255, 255, 0.03)` | Fundo da action bar |

### Contraste (obrigatório verificar)

| Par | Razão | Status |
|-----|-------|--------|
| `#f9fafb` on `#111827` | ~18:1 | PASS (AAA) |
| `#e5e7eb` on `rgba(31,41,55,0.8)` | ~12:1 | PASS (AAA) |
| `#9ca3af` on `#111827` | ~6.3:1 | PASS (AA) |
| `#6b7280` on `#111827` | ~4.0:1 | FAIL para texto <12px (Caption/Micro) — usar `#9ca3af` em vez de `#6b7280` para texto de 10px e abaixo |
| `#fbbf24` on `rgba(251,191,36,0.15)` bg | ~3.5:1 | FAIL — usar `#f59e0b` (amber-500) ou fundo mais escuro para badges de 12px |
| `#34d399` on `rgba(31,41,55,0.8)` | ~5.2:1 | PASS (AA) |

---

## Radii

| Token | Valor | Uso |
|-------|-------|-----|
| radius-sm | 4px | Botão "Ler" (TTS); badges muito pequenos |
| radius-md | 6px | Botões primários/destrutivos; inputs do settings |
| radius-lg | 8px | Cards (transcrição, streaming, sugestão, pergunta); botão Salvar |
| radius-xl | 12px | Badges de keyword |
| radius-2xl | 16px | Container principal do painel |
| radius-full | 50% | Botão colapsado |

---

## Shadows

| Token | Valor | Uso |
|-------|-------|-----|
| shadow-button | `0 4px 12px rgba(0, 0, 0, 0.3)` | Botão colapsado |
| shadow-panel | `0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3)` | Painel expandido |
| shadow-glow-success | `0 0 8px #10b981` | Indicador de status ativo |

Cards internos (transcrição, streaming, sugestão) NÃO possuem shadow — apenas bordas.

---

## Motion

| Animação | Valor | Onde | Respeita reduced-motion? |
|----------|-------|------|--------------------------|
| Botão colapsado | `transform 0.15s ease, box-shadow 0.15s ease` | hover/press do botão 🤖 | Sim: se `prefers-reduced-motion: reduce`, usar `0s` |
| Aba de settings | `color 0.2s` | Transição de cor da aba ativa | Sim: `0s` |
| Auto-scroll transcrição | `behavior: 'smooth'` | scrollIntoView | Sim: se `prefers-reduced-motion: reduce`, usar `behavior: 'instant'` |
| **NOVO: Fade-in do banner pergunta** | `opacity 0.2s ease-in` | Entrada do banner "Pergunta detectada" | Sim |
| **NOVO: Fade-in do card streaming** | `opacity 0.15s ease-in` | Entrada do card de streaming | Sim |
| **NOVO: Cursor de streaming** | Blink opacity 1→0 em 0.8s, `animation-iteration-count: infinite` | Indicador de "digitando" (NOVO — ver Streaming UX) | Sim |
| **NOVO: Fade-out card cancelled** | `opacity 0.3s ease-out` | Card cancelado→arquivado | Sim |

**regra `prefers-reduced-motion`:** Deve ser implementada via `<style>` injetada no Shadow DOM (não expressível via `React.CSSProperties`). Se `prefers-reduced-motion: reduce`, todas as animações usam `duration: 0s` exceto o auto-scroll (que usa `behavior: 'instant'`).

---

## Component Anatomy

### 1. Floating Button (botão colapsado)

```
┌──────────────────┐
│   🤖 (emoji)     │  52px circle
│  "Abrir Copiloto"│  title attribute
└──────────────────┘
```

- Renderiza quando `panelOpen === false`
- Fundo: `rgba(17, 24, 39, 0.92)`, borda `rgba(255,255,255,0.15)`
- Shadow: `shadow-button`
- Hover: scale 1.05 (via `transform: scale(1.05)`) + shadow-glow-success
- **NOVO:** `aria-label="Abrir Copiloto"`, `role="button"`, `tabIndex={0}`
- **NOVO:** Suporte a Enter/Space para reabrir
- **Pergunta aberta:** O 🤖 deve ser substituído por uma marca visual do produto (ícone SVG customizado)?

### 2. Panel Container

```
┌──────────────────────────────┐
│ ⋮⋮  drag handle              │  height: ~20px
├──────────────────────────────┤
│ 🟢 Copiloto · normal  ⚙️ ✖️  │  toolbar
├──────────────────────────────┤
│ ▶ Iniciar  ⚡ 🔊  ⏸  🔁  👁 │  action bar
├──────────────────────────────┤
│ Whisper 🟢 · IA 🟢           │  status bar
├──────────────────────────────┤
│                              │
│  [scroll area]               │
│                              │
└──────────────────────────────┘
```

- Largura: 380px, maxHeight: 85vh
- Fundo: `rgba(17, 24, 39, 0.95)` com `backdrop-filter: blur(12px)`
- Borda: `border-panel`, `borderRadius: 16px`
- Shadow: `shadow-panel`
- Drag handle: `<div>` com `⋮⋮`, padding 4px 0, cursor `grab`/`grabbing`, `touchAction: 'none'`
- **NOVO:** `role="dialog"`, `aria-label="Painel Copiloto de Conversas"`, `aria-modal="false"` (não bloqueia a host-page)

### 3. Toolbar

- Padding: `6px 12px 8px 12px` (ajustado para 4px múltiplos: `4px 12px 8px 12px`)
- Status dot: 8px circle, `status-success` ou `status-error` conforme `whisperConnected && llmConfigured`
- Label: `Copiloto`, `fontSize: 12px`, `fontWeight: 600`, `color: text-primary`
- Mode suffix: `fontSize: 10px`, `color: text-muted`
- **CORREÇÃO:** `"· keywords"` → `"· palavras-chave"` (pt-BR)
- Botões da toolbar: `action-surface` bg, `action-surface-border`, `radius-md`, `padding: 6px`, `fontSize: 14px`
- Botão ⚙️: `aria-label="Ajustes"`
- Botão ✖️: `aria-label="Ocultar painel"`

### 4. Action Bar

- Padding: `6px 12px` → `4px 12px`
- Gap: `4px` (manter)
- Botão principal (Iniciar/Parar): `accent` ou `destructive`, `padding: 4px 10px`, `radius-md`, `fontSize: 11px`, `fontWeight: 600`, `color: white`
- Botões secundários: `action-surface`, `action-surface-border`, `radius-md`, `padding: 6px`, `fontSize: 13px`
- **CORREÇÃO labels:** `"▶ Iniciar"` → manter; `"⬛ Parar"` → manter
- **NOVO:** `aria-label` em cada botão (já existem `title` — adicionar `aria-label` idêntico)

### 5. Status Bar

- Padding: `4px 12px` → manter
- `fontSize: 10px`, `color: text-muted`
- Status dot (8px): `status-success` glow quando ativo, `status-error` quando inativo
- **NOVO:** Adicionar `aria-live="off"` (informacional, não precisa de anúncio)

### 6. Transcription Block ("Transcrição ao Vivo")

- Título: `"TRANSCRIÇÃO AO VIVO"` (uppercase), `fontSize: 10px`, `fontWeight: 600`, `color: text-muted`
- Container: `bg-transcription`, `radius-lg`, `padding: 8px`, `maxHeight: 100px`, `overflowY: auto`
- Item de transcrição: `fontSize: 12px`, `lineHeight: 1.5`
- Speaker label (Entrevistador/Fala): `color: accent-light`, `fontWeight: 600`
- Texto parcial: `fontStyle: italic`, `color: text-muted` (#9ca3af)
- Texto final: `fontStyle: normal`, `color: text-secondary` (#e5e7eb)
- Confidence: `fontSize: 9px`, `color: text-confidence`
- **NOVO:** `aria-live="polite"` no container (anuncia novas transcrições a screen readers)
- **NOVO:** `role="log"` no container

### 7. Question Banner ("Pergunta detectada")

- Padding: `8px 10px` → `8px` (múltiplo de 4)
- Fundo: `status-warning-bg`
- Borda: `status-warning-border`
- `radius-lg`
- `fontSize: 12px`, `color: status-warning`
- Texto: `"❓ Pergunta detectada: {texto}"`
- **NOVO:** `role="status"`, `aria-live="assertive"` (pergunta é evento crítico)
- **NOVO:** Fade-in 0.2s
- **NOVO:** Mostrar `score` e `reasons` do `QuestionDetectionResult` quando disponível (atualmente dropados)

### 8. Streaming Card (answer.started / answer.delta)

- Fundo: `accent-bg` (`rgba(30, 58, 138, 0.4)`)
- Borda: `1px solid #3b82f6`
- `radius-lg`, `padding: 10px`
- Pergunta: `fontSize: 12px`, `color: accent-lighter` (#93c5fd), `fontWeight: 600`
- Corpo: `fontSize: 12px`, `lineHeight: 1.5`, `color: text-primary`, `whiteSpace: 'pre-wrap'`
- Placeholder sem delta: `"Gerando sugestão..."`
- **NOVO:** Cursor de streaming (pipe `│` pulsante) ao final do texto durante `answer.delta`. Implementado via `<span>` com `animation: blink 0.8s infinite`. Removido quando `answer.completed` ou `answer.failed`.
- **NOVO:** `aria-live="polite"` (anuncia delta a screen readers — usar `aria-atomic="false"` para não reanunciar o texto inteiro)
- **NOVO:** Indicador "stalled": se nenhum `answer.delta` chegar em 5000ms após `answer.started`, mostrar `"(sem resposta...)"` em `text-dim`
- **NOVO:** Fade-in 0.15s na entrada
- **NOVO:** Retry button em caso de `answer.failed` (ícone 🔁, `aria-label="Tentar novamente"`)

### 9. Completed Suggestion Card

- Fundo: `bg-surface` (`rgba(31, 41, 55, 0.8)`)
- Borda: `border-card`
- `radius-lg`, `padding: 10px`, `maxHeight: 220px`, `overflowY: auto`
- Pergunta: `fontSize: 12px`, `color: status-warning`, `fontWeight: 600`
- Linha de abertura: `fontSize: 12px`, `color: opening-line` (#34d399)
- Corpo: `fontSize: 12px`, `lineHeight: 1.5`, `color: text-secondary`
- Badges de keyword: `keyword-bg`, `keyword-border`, `keyword-lighter` (texto), `fontSize: 10px`, `padding: 2px 8px`, `radius-xl` (12px)
- Botão "🗣️ Ler": `radius-sm` (4px), `fontSize: 11px`, `padding: 2px 6px`, `color: text-muted` — hidden quando status é `cancelled` ou `error`
- **CORREÇÃO:** `"keywords"` badge label → badge mostra a keyword em si (ok), mas o text do badge não precisa traduzir
- **NOVO:** Mostrar `answer.cancelled.reason` quando disponível (atualmente dropado)
- **NOVO:** `role="article"`, `aria-label="Sugestão para: {pergunta}"`

### 10. Settings Form

- Compartilhado entre popup e painel (mesmo componente `SettingsForm`)
- Container: `radius-lg`, padding `16px` (ou `lg` no novo scale), `bg-base`
- Tabs: `fontSize: 11px`, gap `8px`, divisor `border-settings-tab`
- Tab ativa: `color: accent-light`, `borderBottom: 2px solid accent-light`
- Labels: `fontSize: 11px`, `color: text-muted`, `fontWeight: 500`
- Inputs: `fontSize: 12px`, `bg-input`, `border-input`, `radius-md` (6px), `padding: 8px` (de 7px arredondado)
- Select: mesmo estilo do input
- Range slider: `accentColor: accent-light`, track `#374151`
- Botão Salvar: `bg: accent`, `color: white`, `radius-md` (8px → manter), `padding: 10px` → `8px` (múltiplo de 4), `fontSize: 13px`, `fontWeight: 600`
- **NOVO:** Todos os `<label>` devem usar `htmlFor` ↔ `id` no input correspondente
- **NOVO:** `role="group"` em cada seção de campo com `aria-labelledby` apontando para o label
- **CORREÇÃO:** Remover `(RF-017)`, `(RF-013)` dos labels visíveis (IDs de requisito não são copytext do usuário)

### 11. Popup

- Largura: 360px (definida no `<style>` inline de `popup.html`)
- Fundo: `#111827`
- Padding: `12px` → `16px` (lg)
- Título: `"🎙️ Copiloto de Conversas"`, `fontSize: 15px`, `fontWeight: 700`, `color: accent-light`
- Botão toggle: `fontSize: 11px`, `padding: 8px 16px`, `radius-md`
- **NOVO:** O popup deve mostrar status da sessão (capturando/parado) — atualmente só reflete estado local
- **Pergunta aberta:** O popup deve virar apenas um launcher (abrir o painel) ou manter "Iniciar Captura" aqui?

---

## Copywriting Contract

**Idioma:** pt-BR. Tom: formal, impessoal, conciso. Nunca "você" ou "tu" — usar voz passiva ou imperativo indireto.

### Correções de English leaks

| Atual | Corrigido | Arquivo |
|-------|-----------|---------|
| `· keywords` | `· palavras-chave` | overlay.tsx:412 |
| `Pausar/Retomar TTS` | `Pausar/Retomar Leitura` | overlay.tsx:449 |
| `Repetir TTS` | `Repetir Leitura` | overlay.tsx:452 |
| `Modo TTS (RF-013)` | `Modo de Leitura` | settings-form.tsx:214 |
| `Velocidade TTS: {x}x` | `Velocidade da Leitura: {x}x` | settings-form.tsx:224 |
| `Volume TTS: {n}%` | `Volume da Leitura: {n}%` | settings-form.tsx:230 |
| `🔇 Desligado` | `🔇 Desligado` (manter — ok) | settings-form.tsx:216 |

### Labels padronizados

| Elemento | Copy |
|----------|------|
| Botão iniciar captura (popup) | `"▶ Iniciar Captura"` |
| Botão parar captura (painel) | `"⬛ Parar"` |
| Botão forçar sugestão | `"⚡ Forçar"` |
| Botão ler em voz alta | `"🔊"` (com `aria-label="Ler em voz alta"`) |
| Botão silenciar | `"🔇"` (com `aria-label="Silenciar leitura"`) |
| Botão pausar/retomar | `"⏸"` (com `aria-label="Pausar leitura"`) / `"▶"` (com `aria-label="Retomar leitura"`) |
| Botão repetir | `"🔁"` (com `aria-label="Repetir leitura"`) |
| Botão alternar modo | `"👁"` (com `aria-label="Alternar modo visual"`) |

### Empty states

| Contexto | Heading | Body |
|----------|---------|------|
| Transcrição vazia | `"TRANSCRIÇÃO AO VIVO"` | `"Aguardando áudio..."` |
| Sem sugestões | `"SUGESTÃO CONTEXTUAL"` | `"Nenhuma sugestão ainda. Pressione Alt+S para sugerir agora."` |
| Settings sem API key | — | `"Chave de API do Gemini"` + hint: `"A chave é enviada ao orquestrador local e nunca armazenada externamente."` |

### Error states

| Erro | Copy |
|------|------|
| answer.failed | `"❌ Erro: {error.message}"` — corpo do card mostra o erro; **NOVO:** botão 🔁 "Tentar novamente" |
| Whisper offline | `"Whisper 🔴"` na status bar |
| IA não configurada | `"IA 🟡"` na status bar |
| Conexão WebSocket perdida | **NOVO:** `"⚠️ Desconectado — reconectando..."` na status bar com dot amarelo |

### Destructive actions

| Ação | Confirmação |
|------|-------------|
| Parar captura | Sem confirmação (reversível — pode recapturar) |
| Limpar configurações | **NOVO (futuro):** `"Tem certeza? As configurações atuais serão perdidas."` com botão "Sim, limpar" / "Cancelar" |

---

## Interaction Contracts

### Arrastar (drag)
- Via PointerEvent no drag handle (mantido)
- Cursor: `grab` → `grabbing` durante drag
- `touchAction: 'none'` no drag handle
- Clamp ao viewport: `Math.max(0, Math.min(window.innerWidth - 380, x))` e `Math.max(0, Math.min(window.innerHeight - 600, y))` — **NOVO:** usar `window.innerHeight - panelActualHeight` em vez de fixo 600px
- Persistir posição via `localStorage` (manter — não migrar para `chrome.storage.local` por enquanto)
- **Pergunta aberta:** Suporte a reposicionamento via teclado (setas) para acessibilidade?

### Colapsar / Expandir
- ✖️ no toolbar: `panelOpen = false` → renderiza botão colapsado
- Botão colapsado: `panelOpen = true` → renderiza painel expandido
- **NOVO:** `Esc` dentro do painel → colapsar (quando foco está dentro do painel)
- **CORREÇÃO:** `panelMode === 'hidden'` está broken (renderiza container vazio). **Solução:** remover `'hidden'` dos modos do `cyclePanelMode`. Se `hidden` for desejado no futuro, deve acionar `setPanelOpen(false)`.

### Modos do painel
- Modos disponíveis: `'normal'`, `'compact'`, `'transcription-only'`, `'keywords'`
- Botão de cycle itera por esses 4 modos (removido `'hidden'`)
- **Pergunta aberta:** Substituir botão cycle por dropdown/menu para melhor discoverability?

### Streaming answer.delta
- Texto cresce token-a-token com `whiteSpace: 'pre-wrap'`
- **NOVO:** Cursor `│` pulsante (CSS `animation: blink 0.8s infinite`) ao final do texto durante streaming
- **NOVO:** Remoção do cursor quando `answer.completed`, `answer.failed`, ou `answer.cancelled`
- Auto-scroll suave: `scrollIntoView({ behavior: 'smooth' })` — **NOVO:** verificar `prefers-reduced-motion`

### answer.section.completed (NOVO)
- Atualmente não tratado (8 eventos sem handler)
- **Decisão:** NÃO implementar progressive rendering por enquanto. Aguardar `answer.completed` para renderizar todo o conteúdo. Justificativa: simplifica a UX e evita reflows durante streaming. `answer.section.completed` permanece não-tratado. (Revisar se o backend enviar structured incrementally.)

### answer.cancelled
- Card move para `completedSuggestions` com `status: 'cancelled'`
- Visual: `opacity: 0.6`, `borderLeft: '3px solid status-error'`
- Botão "Ler" hidden
- **NOVO:** Mostrar `reason` do payload quando disponível (ex: `"Cancelado: {reason}"`)
- **NOVO:** Fade-out 0.3s antes de arquivar

### answer.failed
- Card fica como `activeSuggestion` (não arquivado)
- Visual: `status-error-bg`, `border: status-error`
- Corpo: mostra `error.message`
- **NOVO:** Botão 🔁 `"Tentar novamente"` que emite `answer.force`
- **NOVO:** Após 30s sem ação do usuário, mover card para `completedSuggestions` automaticamente

### Persistência de estado
| Estado | Atual | Contrato |
|--------|-------|----------|
| Posição (x,y) | `localStorage` | Manter (adequado para per-origin) |
| panelMode | Reseta a `'normal'` a cada page load | **NOVO:** persistir em `localStorage` |
| panelOpen | Reseta a `false` a cada page load | Manter (abrir fechado por padrão é correto para não obstruir a host-page) |
| isMuted | Reseta a `false` | **NOVO:** persistir em `localStorage` |

---

## Accessibility Contract

### ARIA roles e live regions

| Região | role | aria-live | aria-label / aria-labelledby |
|--------|------|-----------|------------------------------|
| Painel expandido | `dialog` | — | `aria-label="Painel Copiloto de Conversas"` |
| Botão colapsado | `button` | — | `aria-label="Abrir Copiloto"` |
| Lista de transcrição | `log` | `polite` | `aria-label="Transcrição ao Vivo"` |
| Banner de pergunta | `status` | `assertive` | `aria-label="Pergunta detectada"` |
| Card streaming | `region` | `polite` (com `aria-atomic="false"`) | `aria-label="Sugestão em andamento"` |
| Card sugestão completa | `article` | — | `aria-label="Sugestão para: {pergunta}"` |
| Status bar | — | `off` | — |
| Formulário settings | `group` | — | `aria-labelledby` apontando para label do campo |

### Focus management

1. **Abrir painel:** foco move para o primeiro botão interativo do toolbar (⚙️)
2. **Fechar painel (✖️ ou Esc):** foco retorna para o botão colapsado 🤖
3. **Tab order dentro do painel:** drag handle → ⚙️ → ✖️ → botões da action bar (Iniciar → ⚡ → 🔊/🔇 → ⏸ → 🔁 → 👁) → (settings form quando aberto) → (cards de sugestão — focáveis mas não tab-stop por padrão)
4. **Focus ring:** `outline: 2px solid #60a5fa`, `outline-offset: 2px` — implementado via `<style>` injetada no Shadow DOM usando `:focus-visible`

### Keyboard shortcuts (planejados)

| Atalho | Ação | Status |
|--------|------|--------|
| `Alt+S` | Forçar sugestão | **BROKEN** — manifest encaminha mas content-script não ouve. Correção necessária: adicionar `chrome.runtime.onMessage` listener no content-script.ts |
| `Esc` | Colapsar painel | **NOVO** — adicionar `onKeyDown` handler no container do painel |
| `Tab` | Navegar entre elementos | Nativo — funciona com `tabIndex={0}` nos botões |
| `Enter/Space` | Ativar botão | Nativo para `<button>` |

### Form labelling

- Todos os `<label>` devem usar `htmlFor={id}` com `id` correspondente no `<input>`/`<select>`/`<textarea>`
- Nenhum label pode ser apenas sibling sem associação

### Contraste (verificação obrigatória)

- `#6b7280` NÃO pode ser usado para texto <12px — substituir por `#9ca3af`
- `#fbbf24` em fundo amber claro: usar fundo mais escuro ou `#f59e0b` para badges de 12px
- Todos os pares cor/fundo devem passar WCAG AA (4.5:1 para texto normal, 3:1 para texto grande ≥18px bold ou ≥24px)

### Reduced motion

- `<style>` injetada no Shadow DOM deve conter:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  .copilot-scroll-area { scroll-behavior: auto !important; }
}
```

---

## Streaming UX Contract

### answer.delta rendering

1. Texto acumula com `whiteSpace: 'pre-wrap'`
2. **NOVO:** Cursor `│` (U+2502) pulsante no final do texto durante streaming
3. **NOVO:** Quando `answer.completed` → cursor remove, texto fica final
4. **NOVO:** Se `answer.failed` → cursor remove, card muda para estilo erro
5. Budget: max 20 tokens/sec sustained; re-render por delta deve custar <50ms (atualmente cumpre — React batch update simples)
6. Max buffer: 1 card streaming + 3 completas (manter)

### stalled detection

- Se `answer.started` recebido mas nenhum `answer.delta` em 5000ms → mostrar `"(sem resposta...)"` em `text-dim` dentro do card streaming
- Se `answer.delta` chegar depois, limpar a mensagem stalled e continuar

### Progressive sections (answer.section.completed)

- **DECISÃO:** NÃO implementar progressive rendering. O card streaming mostra apenas `rawText` acumulado dos deltas. Seções estruturadas (opening, keyPoints, clarifyingQuestion) só aparecem quando `answer.completed` chega com o `structured` completo.
- Justificativa: simplifica UX, evita reflows, mantém budget de 50ms.

---

## Registry Safety

| Registry | Blocos usados | Safety Gate |
|----------|---------------|-------------|
| shadcn official | — | not applicable (sem design system) |
| Third-party | — | not applicable |

Nenhuma dependência de design system de terceiros é utilizada. A extensão usa apenas React, React-DOM, e código próprio. `lucide-react` está no `package.json` mas NÃO é importado na extensão — emojis e SVGs inline são usados em vez disso.

---

## Constraints

| # | Constraint | Impacto no Design |
|---|-----------|-------------------|
| 1 | Content-script é IIFE — sem ES modules em runtime | Toda estilização deve ser inline JS ou `<style>` injetada; sem CSS imports |
| 2 | Shadow DOM (mode: 'open') para isolamento | CSS da host-page não alcança o painel; webfonts externas não carregam |
| 3 | Bundle IIFE deve ser enxuto | Sem bibliotecas de ícones/animação pesadas; React + ~30KB app code é o budget |
| 4 | Host-page DOM é arbitrário (Meet, Zoom, Teams) | Todas as primitivas visuais devem ser auto-especificadas (font, color, box model) |
| 5 | Orchestrator local (ws://localhost:3001/ws) | UI não deve assumir deploy remoto; reconexão com 3s backoff |
| 6 | `prefers-reduced-motion` e `prefers-color-scheme` | Requerem `<style>` injetada (não expressível em `React.CSSProperties`) |
| 7 | popup.html referenciado de `src/`, não `dist/` | Pipeline do popup é atípico; UI-SPEC não assume build normal |
| 8 | Alt+S está broken | Design assume que será corrigido; não desenhar alternativa |
| 9 | Protocolo WebSocket: 22 eventos, 8 sem handler | UI-SPEC define quais tratamos; os outros permanecem ignorados |
| 10 | Nenhum `aria-*` existe hoje | Este contract é greenfield para acessibilidade — implementação deve adicionar tudo |

---

## Decisões Aprovadas

1. **Ícones & Estilização:** Emojis e SVGs inline minimalistas (bundle leve, sem dependências externas).
2. **Nome do Produto:** Copiloto de Conversas (pt-BR).
3. **Papel do Popup:** Atuar primariamente como Launcher/Atalho para abrir o painel flutuante e acessar configurações.
4. **Modo 'hidden':** Removido do ciclo do botão 👁️ (usar o botão ✖️ explicitamente para ocultar/fechar).
5. **Copywriting:** Removidas todas as siglas de requisitos (ex: `(RF-017)`, `(RF-013)`) dos labels da UI.
6. **Streaming stalled:** Timeout fixado em 5000ms com indicador `(sem resposta...)`.
7. **Persistência:** Mantida em `localStorage` para isolamento per-origin.
8. **Tema:** Exclusivamente Dark Mode (otimizado para overlay de reuniões).
9. **Acessibilidade:** WCAG AA (corrigido contraste do texto e badges).

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASSED
- [x] Dimension 2 Visuals: PASSED
- [x] Dimension 3 Color: PASSED
- [x] Dimension 4 Typography: PASSED
- [x] Dimension 5 Spacing: PASSED
- [x] Dimension 6 Registry Safety: PASSED

**Approval:** approved

