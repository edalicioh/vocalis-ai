import {
  UserProfile,
  JobDescription,
  Utterance,
  ResponseMode,
  ConversationSummary
} from '@conversation-copilot/shared-types';

/**
 * Gerenciador de contexto da conversa (RF-008).
 * 
 * Responsável por:
 * - Manter o perfil profissional e vaga
 * - Gerenciar a janela deslizante de falas recentes
 * - Manter o resumo acumulativo (RF-018)
 * - Montar o prompt com formato JSON estruturado (RF-009)
 * - Aplicar o modo de resposta selecionado (RF-017)
 * 
 * A sumarização é assíncrona e não-bloqueante (RN-010).
 */
export class ContextManager {
  private userProfile: UserProfile = {
    name: 'Candidato',
    role: 'Engenheiro de Software',
    seniority: 'Senior',
    skills: [],
    experiences: [],
    projects: [],
    strengths: [],
    weaknesses: [],
    preferredStyle: 'short',
    summary: ''
  };

  private jobDescription: JobDescription = {
    title: '',
    description: '',
    requirements: [],
    niceToHave: [],
    company: '',
    technologies: [],
    notes: ''
  };

  private utterances: Utterance[] = [];
  private summary: ConversationSummary = {
    topics: [],
    previousQuestions: [],
    technologies: [],
    summaryText: '',
    lastUpdated: 0
  };

  private readonly MAX_WINDOW_SIZE = 10;
  private readonly SUMMARY_TRIGGER_COUNT = 5;
  private finalUtterancesSinceLastSummary = 0;

  // ========= Atualização de perfil/vaga =========

  public updateProfile(profile: Partial<UserProfile>) {
    this.userProfile = { ...this.userProfile, ...profile };
  }

  public updateJobDescription(job: Partial<JobDescription>) {
    this.jobDescription = { ...this.jobDescription, ...job };
  }

  // ========= Gerenciamento de falas =========

  public addUtterance(text: string, speaker: Utterance['speaker'] = 'unknown', isFinal: boolean = true): Utterance {
    const utterance: Utterance = {
      id: Math.random().toString(36).substring(2, 9),
      speaker,
      text,
      timestamp: Date.now(),
      isFinal
    };

    this.utterances.push(utterance);
    if (this.utterances.length > this.MAX_WINDOW_SIZE * 2) {
      this.utterances = this.utterances.slice(-this.MAX_WINDOW_SIZE);
    }

    if (isFinal) {
      this.finalUtterancesSinceLastSummary++;
    }

    return utterance;
  }

  public getRecentUtterances(): Utterance[] {
    return this.utterances.slice(-this.MAX_WINDOW_SIZE);
  }

  // ========= Sumarização (RF-018) =========

  /**
   * Verifica se é hora de atualizar o resumo.
   * Triggers: a cada 5 falas finais, após resposta concluída, durante silêncio.
   * NÃO bloqueia a chamada principal da IA (RN-010).
   */
  public shouldUpdateSummary(): boolean {
    return this.finalUtterancesSinceLastSummary >= this.SUMMARY_TRIGGER_COUNT;
  }

  /**
   * Gera o prompt de sumarização para ser processado em background.
   * O resultado deve ser alimentado via updateSummary().
   */
  public buildSummaryPrompt(): string {
    const recentDialogue = this.utterances
      .filter(u => u.isFinal)
      .map(u => `[${u.speaker.toUpperCase()}]: ${u.text}`)
      .join('\n');

    return `
Resuma a conversa a seguir de forma concisa. Extraia:
1. Temas discutidos
2. Perguntas feitas
3. Tecnologias mencionadas
4. Contexto relevante para a próxima pergunta

Conversa:
${recentDialogue}

${this.summary.summaryText ? `Resumo anterior: ${this.summary.summaryText}` : ''}

Retorne em formato JSON:
{
  "topics": ["..."],
  "previousQuestions": ["..."],
  "technologies": ["..."],
  "summaryText": "..."
}
`.trim();
  }

  public updateSummary(summary: Partial<ConversationSummary>) {
    this.summary = {
      ...this.summary,
      ...summary,
      lastUpdated: Date.now()
    };
    this.finalUtterancesSinceLastSummary = 0;
  }

  public getSummary(): ConversationSummary {
    return this.summary;
  }

  // ========= Montagem do prompt (RF-009) =========

  /**
   * Monta o prompt completo para envio à API de IA.
   * 
   * Inclui:
   * - Perfil profissional resumido (RF-015)
   * - Descrição da vaga resumida (RF-016)
   * - Instruções de resposta
   * - Resumo acumulado (RF-018)
   * - Últimas falas
   * - Pergunta atual
   * - Modo de resposta (RF-017)
   * 
   * O currículo é usado apenas quando relevante (RN-006).
   * A vaga influencia os exemplos e tecnologias (RN-007).
   */
  public buildPromptPayload(currentQuestion: string, responseMode: ResponseMode = 'short'): string {
    const recentDialogue = this.utterances
      .filter(u => u.isFinal)
      .slice(-this.MAX_WINDOW_SIZE)
      .map(u => `[${u.speaker.toUpperCase()}]: ${u.text}`)
      .join('\n');

    const modeInstruction = this.getResponseModeInstruction(responseMode);

    return `
Você é um copiloto para conversas e entrevistas técnicas.

Sua função é ajudar o usuário a estruturar uma resposta curta, natural e tecnicamente correta.

=== REGRAS OBRIGATÓRIAS (RN) ===
- Não invente experiências profissionais do usuário (RN-004).
- Use o perfil fornecido apenas quando relevante à pergunta (RN-006).
- Priorize uma resposta que possa ser falada naturalmente.
- Comece com uma frase direta.
- Apresente no máximo cinco pontos principais.
- Quando houver ambiguidade, sugira uma pergunta de esclarecimento (RN-005).
- Não repita a pergunta inteira.
- Não explique seu processo interno.
- Retorne SOMENTE o formato JSON solicitado.

=== MODO DE RESPOSTA: ${responseMode.toUpperCase()} ===
${modeInstruction}

=== PERFIL DO CANDIDATO ===
Nome: ${this.userProfile.name || 'Não informado'}
Cargo: ${this.userProfile.role}
Senioridade: ${this.userProfile.seniority}
Habilidades: ${this.userProfile.skills.join(', ') || 'Não informadas'}
Experiências: ${this.userProfile.experiences.join('; ') || 'Não informadas'}
Projetos: ${this.userProfile.projects.join('; ') || 'Não informados'}
Pontos Fortes: ${this.userProfile.strengths.join(', ') || 'Não informados'}
Áreas a Desenvolver: ${this.userProfile.weaknesses.join(', ') || 'Não informadas'}

=== CONTEXTO DA VAGA ===
Título: ${this.jobDescription.title || 'Não informado'}
Empresa: ${this.jobDescription.company || 'Não informada'}
Requisitos: ${this.jobDescription.requirements.join(', ') || 'Não informados'}
Diferenciais: ${this.jobDescription.niceToHave.join(', ') || 'Não informados'}
Tecnologias: ${this.jobDescription.technologies.join(', ') || 'Não informadas'}

=== RESUMO DA CONVERSA ===
${this.summary.summaryText || 'Início da conversa.'}
${this.summary.topics.length > 0 ? `Temas: ${this.summary.topics.join(', ')}` : ''}
${this.summary.technologies.length > 0 ? `Tecnologias mencionadas: ${this.summary.technologies.join(', ')}` : ''}

=== HISTÓRICO RECENTE ===
${recentDialogue || 'Início da conversa.'}

=== PERGUNTA ATUAL ===
"${currentQuestion}"

=== FORMATO DE RESPOSTA (JSON) ===
Retorne EXATAMENTE neste formato:
{
  "questionSummary": "Resumo curto da pergunta",
  "opening": "Frase de abertura direta (em primeira pessoa)",
  "answer": "Resposta principal (em primeira pessoa, ${this.getWordLimit(responseMode)})",
  "keyPoints": ["Palavra-chave 1", "Palavra-chave 2", ...max 5],
  "clarifyingQuestion": "Pergunta de esclarecimento se necessário, ou null",
  "audioHint": "Versão ultra-curta da resposta para TTS (máx. 30 palavras)"
}
`.trim();
  }

  // ========= Helpers privados =========

  private getResponseModeInstruction(mode: ResponseMode): string {
    switch (mode) {
      case 'keywords':
        return 'Retorne APENAS os keyPoints. Os campos opening, answer e audioHint devem ficar vazios.';
      case 'short':
        return 'Resposta curta: 30 a 60 palavras no campo answer. Este é o modo padrão para entrevistas ao vivo.';
      case 'full':
        return 'Resposta completa: 80 a 150 palavras no campo answer. Inclua mais detalhes e exemplos.';
      case 'structured':
        return 'Resposta estruturada. O campo answer deve conter: Abertura → Decisão → Justificativa → Trade-offs → Exemplo. Use quebras de linha.';
      default:
        return 'Resposta curta: 30 a 60 palavras.';
    }
  }

  private getWordLimit(mode: ResponseMode): string {
    switch (mode) {
      case 'keywords': return 'vazio';
      case 'short': return '30 a 60 palavras';
      case 'full': return '80 a 150 palavras';
      case 'structured': return 'formato estruturado com 5 seções';
      default: return '30 a 60 palavras';
    }
  }
}
