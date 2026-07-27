# Plano da Fase 6 — Text-to-Speech (TTS) Assistido

## 🎯 Objetivo
Integrar o leitor de voz do navegador (Web Speech Synthesis API) para sintetizar em áudio as respostas geradas pela IA, com destaque visual sincronizado da frase sendo lida, múltiplos modos de leitura e controles completos.

---

## 📋 Escopo da Fase

1. Módulo de Leitura por Voz (`SpeechManager`):
   - Encapsulamento da Web Speech Synthesis API (`window.speechSynthesis`).
   - Interface abstrata `SpeechProvider` (RNF-006) para futura troca por Piper ou serviço externo:
     ```typescript
     interface SpeechProvider {
       speak(text: string): Promise<void>;
       cancel(): void;
     }
     ```
   - Seleção da voz em Português (`pt-BR`).
2. Modos de TTS (RF-013):
   - **Desligado** — sem leitura por voz.
   - **Ler resposta completa** — lê todo o conteúdo do campo `answer`.
   - **Ler somente resumo** — lê apenas o campo `audioHint`.
   - **Ler somente palavras-chave** — lê os `keyPoints` separados por vírgula.
   - **Manual** — TTS inicia apenas quando o usuário pressionar um atalho.
3. Controles de Áudio:
   - **Velocidade** ajustável (padrão: 1.25x).
   - **Volume** ajustável (padrão: 40%).
   - **Pausar** a leitura em andamento.
   - **Repetir** a frase ou trecho atual.
   - Limite por trecho: aproximadamente 5 segundos.
4. Destaque Visual Sincronizado (RF-014):
   - A frase atualmente sendo lida deverá receber destaque visual (cor de fundo ou sublinhado).
   - Após a leitura de uma frase, o destaque deverá avançar para a próxima automaticamente.
   - O scroll do painel deverá acompanhar a frase em destaque.
5. Cancelamento Automático (RN-008):
   - O TTS deverá ser interrompido quando:
     - Houver nova pergunta detectada.
     - O usuário pressionar o botão de mute/parar.
     - O painel for ocultado.
     - A sessão terminar.
     - O texto ficar desatualizado (nova resposta gerada).
6. Integração com o Painel:
   - Botão manual "🗣️ Ler" em cada card de sugestão.
   - Indicador visual do estado do TTS no header.

---

## 🏁 Critérios de Aceite
- [ ] O TTS realiza leitura fluida em português com velocidade e volume ajustáveis.
- [ ] Os 5 modos de TTS funcionam corretamente.
- [ ] A frase sendo lida recebe destaque visual sincronizado no painel.
- [ ] O botão Mute, nova pergunta, painel oculto ou sessão encerrada cancelam imediatamente o TTS.
- [ ] O usuário pode pausar e repetir a frase atual.

---

## 📎 Requisitos Rastreados
- **RF-013** — TTS para auxiliar leitura (modos, velocidade, volume, pausar, repetir)
- **RF-014** — Destacar trecho lido (sincronização visual)
- **RNF-006** — Manutenibilidade (interface `SpeechProvider`)
- **RN-008** — Regras de interrupção do TTS
