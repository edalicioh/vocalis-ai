# Plano da Fase 3 — Painel Flutuante e Interface do Usuário

## 🎯 Objetivo
Construir a interface visual do copiloto injetada diretamente na aba da reunião (ex: Google Meet, Teams) via Content Script dentro de um **Shadow DOM** isolado, exibindo a transcrição ao vivo, status dos serviços e área de sugestões.

---

## 📋 Escopo da Fase

1. Isolamento com Shadow DOM:
   - Injeção de container `#conversation-copilot-host` na página host via Content Script.
   - Encapsulamento total do CSS em Shadow DOM para evitar interferência nos estilos da reunião.
2. Componentes Visuais (React + Glassmorphism):
   - Header com indicadores de estado (Whisper, API de IA, Áudio).
   - Feed de transcrição em tempo real (últimas falas da reunião).
   - Card de sugestões da IA e botão de disparo manual (`Alt+S`).
3. Controles do Painel:
   - Botão para minimizar.
   - Botão para mover (drag).
   - Botão para redimensionar.
   - Botão para fechar/encerrar sessão.
4. Modos Visuais (RF-012):
   - **Compacto** — apenas indicadores de estado e palavras-chave.
   - **Normal** — transcrição, pergunta, resposta e palavras-chave.
   - **Somente palavras-chave** — exibe apenas os `keyPoints` da resposta.
   - **Somente transcrição** — exibe apenas o feed de transcrição ao vivo.
   - **Oculto** — painel completamente escondido, acessível por atalho.
5. Popup da Extensão (`src/popup/popup.tsx`):
   - Configuração da chave da API, perfil profissional e dados da vaga.

---

## 🏁 Critérios de Aceite
- [ ] O painel flutuante renderiza sobre o Google Meet/Teams sem quebrar o layout original.
- [ ] Transcrições e atualizações de status aparecem instantaneamente na tela.
- [ ] O usuário pode controlar a captura e atalhos pelo painel.
- [ ] Os 5 modos visuais são alternáveis pelo painel ou atalho.
- [ ] O painel pode ser movido e redimensionado pelo usuário.

---

## 📎 Requisitos Rastreados
- **RF-005** — Mostrar transcrição em tempo real
- **RF-012** — Exibir painel flutuante (modos visuais, mover, redimensionar, fechar)
