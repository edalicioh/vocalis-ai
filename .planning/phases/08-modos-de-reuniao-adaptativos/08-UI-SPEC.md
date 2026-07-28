---
phase: 08
slug: modos-de-reuniao-adaptativos
status: approved
shadcn_initialized: false
preset: dark-oled-glassmorphism
created: 2026-07-28
---

# Phase 08 — UI Design Contract (Seletor de Modos de Reunião & Notas)

> Contrato de design visual e interação para o seletor de Modos de Reunião no HUD e a área de Notas por Modo no Popup e Configurações.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (React Inline CSS + Shadow DOM) |
| Preset | Dark OLED Glassmorphism (`MASTER.md`) |
| Component library | Custom React + Inline CSS |
| Icon library | Lucide React SVG (`Target`, `Boxes`, `Code2`, `FileText`, `Sparkles`) |
| Font | Inter, system-ui, sans-serif |

---

## Spacing Scale

Declared values (multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Gaps de ícone inline e padding de pills |
| sm | 8px | Espacejamento interno entre pills de modo |
| md | 16px | Padding padrão dos cards de notas por modo |
| lg | 24px | Margens entre seções de configuração |
| xl | 32px | Separadores de área |

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px | 400 (Regular) | 1.5 |
| Label | 12px | 500 (Medium) | 1.2 |
| Heading | 16px | 600 (SemiBold) | 1.3 |
| Display | 20px | 700 (Bold) | 1.2 |

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#09090b` | Fundo principal OLED, superfícies Shadow DOM |
| Secondary (30%) | `#18181b` | Cards de modo, superfícies de edição, bordas `#27272a` |
| Accent (10%) | `#3b82f6` (Blue) | Pill do Modo Selecionado no HUD/Popup |
| Mode Technical | `#10b981` (Emerald) | Badge/Ícone de Entrevista Técnica |
| Mode SystemDesign | `#8b5cf6` (Purple) | Badge/Ícone de System Design |
| Mode CodeReview | `#ec4899` (Pink) | Badge/Ícone de Code Review |
| Mode General | `#64748b` (Slate) | Badge/Ícone de Reunião Geral |

Accent reserved for: Pill do Modo Ativo e destaque da aba selecionada no HUD e Popup.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Modo Entrevista | `🎯 Entrevista Técnica` |
| Modo System Design | `🏗️ System Design` |
| Modo Code Review | `💻 Code Review` |
| Modo Geral | `📝 Reunião Geral` |
| Label Notas de Apoio | `Notas & Diretrizes do Modo Ativo (Markdown)` |
| Placeholder Notas | `Cole aqui diretrizes da vaga, requisitos de arquitetura ou lembretes específicos para este modo...` |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| Lucide React | Icons: Target, Boxes, Code2, FileText, Sparkles | Pass (SVG inline) |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** Approved 2026-07-28
