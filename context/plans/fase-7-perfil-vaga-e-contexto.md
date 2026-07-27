# Plano da Fase 7 — Perfil, Vaga e Gestão Avançada de Contexto

## 🎯 Objetivo
Personalizar profundamente as sugestões de resposta integrando dados do perfil profissional do usuário, descrição da vaga e sumarização acumulativa da reunião sem inflar a janela de contexto.

---

## 📋 Escopo da Fase

1. Persistência de Perfil Profissional (RF-015):
   - Interface de armazenamento na extensão Chrome (`chrome.storage.local`).
   - Campos do perfil:
     - Nome (opcional).
     - Cargo.
     - Senioridade.
     - Principais tecnologias.
     - Experiências relevantes.
     - Exemplos de projetos.
     - Pontos fortes.
     - Assuntos que não domina.
     - Estilo preferido de resposta.
   - O sistema deverá gerar uma versão resumida do perfil para o prompt.
2. Persistência da Vaga (RF-016):
   - Campos da vaga:
     - Título da vaga.
     - Descrição.
     - Requisitos obrigatórios.
     - Diferenciais.
     - Empresa.
     - Tecnologias.
     - Observações.
   - O sistema deverá gerar uma versão resumida para o prompt.
   - A descrição da vaga deverá influenciar os exemplos e tecnologias mencionados nas respostas (RN-007).
3. Atualização Dinâmica:
   - Envio ao orquestrador via evento `settings.update`.
4. Sumarização Acumulativa da Conversa (RF-018):
   - Conteúdo do resumo:
     - Temas discutidos.
     - Perguntas anteriores.
     - Respostas já apresentadas.
     - Informações citadas pelo usuário.
     - Tecnologias mencionadas.
     - Contexto necessário para a próxima pergunta.
   - Triggers de atualização:
     - A cada 5 falas finais confirmadas.
     - Após uma resposta concluída.
     - Durante períodos de silêncio.
     - Após a pergunta principal, sem bloquear a resposta.
   - A sumarização deverá ser **assíncrona e não-bloqueante** (RN-010) — nunca deverá atrasar a chamada principal da IA.
   - Processamentos de resumo deverão ocorrer em paralelo ou durante silêncio (RN-011).

---

## 🏁 Critérios de Aceite
- [ ] O usuário pode cadastrar e atualizar perfil e vaga via Popup da extensão.
- [ ] As respostas da IA citam apenas habilidades reais do candidato e tecnologias exigidas na vaga.
- [ ] O resumo da conversa é atualizado automaticamente nos triggers definidos.
- [ ] A sumarização não bloqueia a geração de respostas.
- [ ] Os campos do perfil e vaga são enviados ao orquestrador e incorporados ao prompt.

---

## 📎 Requisitos Rastreados
- **RF-015** — Configurar perfil profissional
- **RF-016** — Configurar vaga
- **RF-018** — Resumo de conversa (triggers, conteúdo, assíncrono)
- **RN-006** — Currículo usado apenas quando relevante
- **RN-007** — Vaga influencia exemplos e tecnologias
- **RN-010** — Resumo não bloqueia chamada da IA
- **RN-011** — Processamentos secundários em paralelo
