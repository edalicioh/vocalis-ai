---
phase: 09
slug: pipeline-de-audio-e-vad
status: approved
shadcn_initialized: false
preset: dark-oled-glassmorphism
created: 2026-07-28
---

# Phase 09 — UI Design Contract (VAD Active Voice Meter & Sensitivity)

> Contrato de design visual e animações para o indicador de voz ativa no HUD e o seletor de sensibilidade no painel de configurações.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (React Inline CSS + Shadow DOM) |
| Preset | Dark OLED Glassmorphism (`MASTER.md`) |
| Component library | Custom React + Inline CSS |
| Icon library | Lucide React SVG (`Mic`, `Volume2`, `Activity`, `Sliders`) |
| Font | Inter, system-ui, sans-serif |

---

## Spacing Scale

Declared values (multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Gaps de ícone e padding interno de badges |
| sm | 8px | Espacejamento do selector de sensibilidade |
| md | 16px | Padding do card no SettingsForm |
| lg | 24px | Espaçamento de seções |

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px | 400 (Regular) | 1.5 |
| Label | 12px | 500 (Medium) | 1.2 |
| Heading | 16px | 600 (SemiBold) | 1.3 |

---

## Color & VAD States

| State | Background | Text Color | Animation / Glow |
|-------|------------|------------|------------------|
| Active Speech (`isAudioActive = true`) | `rgba(34, 197, 94, 0.25)` | `#22c55e` (Emerald) | Keyframe `.copilot-pulse` (0.8s ease-in-out infinite) |
| Silent / Paused (`isAudioActive = false`) | `rgba(99, 102, 241, 0.25)` | `#818cf8` (Indigo) | Estático |
| Disconnected | `rgba(245, 158, 11, 0.25)` | `#f59e0b` (Amber) | Estático |

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Label VAD Ativo | `Ouvindo (Voz Ativa)` |
| Label VAD Silêncio | `Ouvindo (Silêncio)` |
| Label Sensibilidade | `Sensibilidade do Filtro de Ruído/Silêncio (RMS Gate)` |
| Opção Baixa | `Baixa (0.02 - Filtra ruído alto de fundo)` |
| Opção Média | `Média (0.01 - Padrão / Recomendado)` |
| Opção Alta | `Alta (0.005 - Captura sussurros)` |
| Opção Desativado | `Desativado (0.0 - Envia 100% dos pacotes)` |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** Approved 2026-07-28
