---
phase: 07
slug: chrome-built-in-ai-pre-processor
status: approved
shadcn_initialized: false
preset: dark-oled-glassmorphism
created: 2026-07-28
---

# Phase 07 — UI Design Contract (Gemini Nano Status Badge & Options)

> Contrato de design visual e interação para os indicadores de status do pré-processador local Gemini Nano na página de Opções e HUD da extensão Chrome.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (React Inline CSS + Shadow DOM) |
| Preset | Dark OLED Glassmorphism (`MASTER.md`) |
| Component library | Custom React + Inline CSS |
| Icon library | Lucide React SVG (`Sparkles`, `Cpu`, `CheckCircle2`, `AlertCircle`) |
| Font | Inter, system-ui, sans-serif |

---

## Spacing Scale

Declared values (multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Gaps de ícone inline e padding de badges |
| sm | 8px | Espacejamento interno de cards e botões |
| md | 16px | Padding padrão de seções de configurações |
| lg | 24px | Margens entre blocos da página de Opções |
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
| Dominant (60%) | `#09090b` | Fundo principal OLED, superfícies da extensão |
| Secondary (30%) | `#18181b` | Cards de configuração, bordas `#27272a` |
| Accent (10%) | `#10b981` (Emerald) | Status Gemini Nano Ativo (On-device) |
| Warning / Bypass | `#f59e0b` (Amber) | Status Gemini Nano Indisponível (Bypass Ativo) |
| Destructive | `#ef4444` | Ações de remoção ou erro crítico |

Accent reserved for: Badge de status "Gemini Nano: Ativo (On-device)" e indicadores de IA ativa.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Status Ativo | `Gemini Nano: Ativo (On-device)` |
| Status Bypass | `Gemini Nano: Indisponível (Bypass Ativo)` |
| Tooltip de Ajuda | `O pré-processamento local corrige termos técnicos e comprime o histórico sem enviar dados extras à nuvem.` |
| Descrição de Bypass | `A Prompt API não foi detectada no navegador. A transcrição será enviada diretamente ao Orquestrador.` |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| Lucide React | Icons: Sparkles, Cpu, CheckCircle2, AlertCircle | Pass (SVG inline) |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** Approved 2026-07-28
