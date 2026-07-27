# Plano da Fase 8 — Métricas, Segurança e Estabilização para Produção

## 🎯 Objetivo
Medir métricas de latência end-to-end, implementar segurança e privacidade, tratar exceções, salvar sessões e garantir estabilidade durante reuniões de longa duração.

---

## 📋 Escopo da Fase

1. Observabilidade Detalhada (RNF-007):
   - Métricas registradas por pergunta:
     - Tempo até transcrição parcial.
     - Tempo até transcrição final.
     - Tempo de detecção de pergunta.
     - Tempo até primeiro token da resposta.
     - Tempo total da resposta.
     - Quantidade de cancelamentos.
     - Erros de conexão.
     - Uso estimado de tokens.
     - Custo estimado por sessão.
   - Meta principal: primeiro token útil exibido em até **3 segundos** (RNF-001).
   - Logs estruturados via Pino.
2. Segurança (RNF-005):
   - Token temporário gerado no handshake entre extensão e backend.
   - Validação de todas as mensagens recebidas via WebSocket.
   - Limitação de tamanho de áudio por mensagem.
   - Rate limiting de requisições.
   - Proteção da chave da API (nunca exposta na extensão).
   - Impedimento de execução de comandos arbitrários.
3. Privacidade (RNF-004):
   - Áudio permanece local (nunca enviado a serviços externos).
   - Apenas texto é enviado ao provedor de IA.
   - Gravação de áudio desabilitada por padrão.
   - Chaves de API armazenadas no backend.
   - Logs não registram textos sensíveis sem configuração explícita.
   - O sistema não deverá enviar áudio para a API de LLM (RN-012).
4. Tolerância a Falhas e Reconexão (RNF-003):
   - Reconexão automática em caso de queda do WebSocket do Whisper ou do Orquestrador.
   - Se a API de IA falhar: transcrição continua, painel mostra erro, palavras-chave simples por regras.
   - Se o Whisper falhar: backend tenta reconectar, extensão mostra "Transcrição indisponível".
   - Tratamento gracioso de limite de taxa (rate limit) da API.
5. Validação de Desempenho Local (RNF-002):
   - Validar funcionamento em RTX 3050 6 GB com 16 GB RAM.
   - Whisper deverá utilizar GPU.
   - Orquestrador deverá consumir poucos recursos.
6. Salvar Sessão (RF-019):
   - Opcionalmente salvar: transcrição, perguntas, respostas sugeridas, resumo, métricas de latência.
   - Gravação de áudio desabilitada por padrão; ativação explícita pelo usuário.
7. Guia de Execução e Instalação:
   - Scripts de inicialização e documentação para ambiente local.
   - Sessão estável por pelo menos 1 hora.

---

## 🏁 Critérios de Aceite
- [ ] O tempo total até a primeira resposta útil permanece abaixo de 3 segundos na maioria das interações.
- [ ] As métricas detalhadas por pergunta são registradas e acessíveis.
- [ ] O sistema se recupera de desconexões de rede sem derrubar o painel na extensão.
- [ ] O token temporário é gerado no handshake e validado em todas as mensagens.
- [ ] A chave da API nunca é exposta na extensão.
- [ ] O áudio permanece local e não é enviado à API de IA.
- [ ] O sistema funciona de forma estável em RTX 3050 6 GB por pelo menos 1 hora.
- [ ] O usuário pode salvar a sessão (transcrição, perguntas, respostas, métricas).

---

## 📎 Requisitos Rastreados
- **RF-019** — Salvar sessão
- **RNF-001** — Latência (< 3 segundos)
- **RNF-002** — Desempenho local (RTX 3050 6 GB)
- **RNF-003** — Disponibilidade (reconexão, fallback)
- **RNF-004** — Privacidade (áudio local, chaves no backend)
- **RNF-005** — Segurança (token, validação, rate limit, proteção API key)
- **RNF-007** — Observabilidade (métricas detalhadas por pergunta)
- **RN-012** — Não enviar áudio para API de LLM
