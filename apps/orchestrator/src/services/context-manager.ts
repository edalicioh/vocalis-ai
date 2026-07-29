import {
  UserProfile,
  JobDescription,
  Utterance,
  ResponseMode,
  ConversationSummary,
  ConversationTone,
  ToneUpdatePayload,
  MeetingMode,
  ConversationAnalysisMode
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
 * - Gerenciar buffer de transcrições parciais
 * - Rastrear duração de pausas entre falas
 * - Armazenar o tom atual da conversa
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

  private meetingMode: MeetingMode = 'technical_interview';
  private conversationAnalysisMode: ConversationAnalysisMode = 'local';
  private modeNotes: Partial<Record<MeetingMode, string>> = {};

  private readonly SYSTEM_PROMPTS: Record<MeetingMode, string> = {
    technical_interview:
      'MODO: ENTREVISTA TÉCNICA.\n' +
      'Foco em respostas objetivas, diretas e faladas naturalmente em até 30s. Destaque conceitos chave e experiências do perfil.',
    system_design:
      'MODO: SYSTEM DESIGN & ARQUITETURA.\n' +
      'Foco em requisitos funcionais/não-funcionais, trade-offs de arquitetura, escalabilidade, bancos de dados, gargalos e diagramas Mermaid se aplicável.',
    code_review:
      'MODO: CODE REVIEW & REFATORAÇÃO.\n' +
      'Foco em qualidade de código, padrões de projeto (Clean Code/SOLID), complexidade de tempo/espaço (O(N)), potenciais bugs e segurança.',
    general:
      'MODO: REUNIÃO GERAL & ALINHAMENTO.\n' +
      'Foco em síntese de discussões, decisões principais tomadas, direcionamentos e lista clara de Action Items (próximos passos).'
  };

  public setMeetingMode(mode: MeetingMode, notes?: Partial<Record<MeetingMode, string>> | string) {
    this.meetingMode = mode;
    if (typeof notes === 'string') {
      this.modeNotes[mode] = notes;
    } else if (notes) {
      this.modeNotes = { ...this.modeNotes, ...notes };
    }
  }

  public getMeetingMode(): MeetingMode {
    return this.meetingMode;
  }

  public setConversationAnalysisMode(mode: ConversationAnalysisMode) {
    this.conversationAnalysisMode = mode;
  }

  public getConversationAnalysisMode(): ConversationAnalysisMode {
    return this.conversationAnalysisMode;
  }

  public getModeNotes(mode?: MeetingMode): string {
    const targetMode = mode || this.meetingMode;
    return this.modeNotes[targetMode] || '';
  }

  private readonly MAX_WINDOW_SIZE = 10;
  private readonly SUMMARY_TRIGGER_COUNT = 5;
  private finalUtterancesSinceLastSummary = 0;

  // ========= Buffer de transcrições parciais =========

  /** Texto acumulado de transcrições parciais recentes */
  private partialBuffer: string[] = [];
  private readonly MAX_PARTIAL_BUFFER = 5;

  // ========= Rastreamento de pausa =========

  /** Timestamp (ms) da última fala finalizada */
  private lastFinalUtteranceTimestamp: number = 0;

  // ========= Tom da conversa =========

  private currentTone: ConversationTone = 'neutro';
  private toneConfidence: number = 0.5;
  private toneSummary: string = '';
  private toneHistory: Array<{ tone: ConversationTone; at: number }> = [];
  private readonly TONE_REFINEMENT_TRIGGER_COUNT = 8;
  private finalUtterancesSinceLastToneRefinement = 0;

  // ========= Atualização de perfil/vaga =========

  public updateProfile(profile: Partial<UserProfile>) {
    this.userProfile = { ...this.userProfile, ...profile };
  }

  public getUserProfile(): UserProfile {
    return this.userProfile;
  }

  public updateJobDescription(job: Partial<JobDescription>) {
    this.jobDescription = { ...this.jobDescription, ...job };
  }

  public getJobDescription(): JobDescription {
    return this.jobDescription;
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

    if (isFinal) {
      this.utterances.push(utterance);
      if (this.utterances.length > this.MAX_WINDOW_SIZE * 2) {
        this.utterances = this.utterances.slice(-this.MAX_WINDOW_SIZE);
      }
      this.finalUtterancesSinceLastSummary++;
      this.finalUtterancesSinceLastToneRefinement++;
      this.lastFinalUtteranceTimestamp = utterance.timestamp;
      this.partialBuffer = [];
    } else {
      const accumulated = this.getAccumulatedPartials();
      const normalizedAccumulated = accumulated.toLocaleLowerCase('pt-BR');
      const normalizedText = text.trim().toLocaleLowerCase('pt-BR');

      if (normalizedText.startsWith(normalizedAccumulated) && accumulated) {
        this.partialBuffer = [text.trim()];
      } else if (!normalizedAccumulated.includes(normalizedText)) {
        this.partialBuffer.push(text.trim());
      }
      if (this.partialBuffer.length > this.MAX_PARTIAL_BUFFER) {
        this.partialBuffer.shift();
      }
    }

    return utterance;
  }

  public getRecentUtterances(): Utterance[] {
    return this.utterances.slice(-this.MAX_WINDOW_SIZE);
  }

  // ========= Buffer de parciais =========

  /**
   * Retorna o texto acumulado das transcrições parciais anteriores.
   * Usado pelo QuestionDetector para montar perguntas fragmentadas.
   */
  public getAccumulatedPartials(): string {
    return this.partialBuffer.join(' ').trim();
  }

  // ========= Rastreamento de pausa =========

  /**
   * Calcula a duração da pausa desde a última fala finalizada.
   * Retorna 0 se não houver fala anterior.
   */
  public getPauseSinceLastUtterance(): number {
    if (this.lastFinalUtteranceTimestamp === 0) return 0;
    return Date.now() - this.lastFinalUtteranceTimestamp;
  }

  // ========= Tom da conversa =========

  /**
   * Verifica se é hora de refinar externamente o tom da conversa.
   * Trigger: a cada 8 falas finais.
   */
  public shouldRefineTone(): boolean {
    return this.finalUtterancesSinceLastToneRefinement >= this.TONE_REFINEMENT_TRIGGER_COUNT;
  }

  /** Reinicia a janela depois que uma tentativa de refinamento é iniciada. */
  public markToneRefinementStarted(): void {
    this.finalUtterancesSinceLastToneRefinement = 0;
  }

  /**
   * Atualiza o tom da conversa detectado.
   */
  public updateTone(tone: ConversationTone, confidence: number, summary: string) {
    const previousTone = this.currentTone;
    this.currentTone = tone;
    this.toneConfidence = confidence;
    this.toneSummary = summary;

    if (previousTone !== tone) {
      this.toneHistory.push({ tone, at: Date.now() });
      if (this.toneHistory.length > 10) {
        this.toneHistory = this.toneHistory.slice(-10);
      }
    }
  }

  /**
   * Retorna o payload do tom atual para envio à extensão.
   */
  public getTonePayload(): ToneUpdatePayload {
    return {
      tone: this.currentTone,
      confidence: this.toneConfidence,
      summary: this.toneSummary,
      trends: this.toneHistory.length > 0 ? [...this.toneHistory] : undefined
    };
  }

  public getCurrentTone(): ConversationTone {
    return this.currentTone;
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
    const meetingModePrompt = this.SYSTEM_PROMPTS[this.meetingMode] || this.SYSTEM_PROMPTS['technical_interview'];
    const activeModeNotes = this.modeNotes[this.meetingMode] ? `\n\n=== NOTAS DO USUÁRIO PARA ESTE MODO ===\n${this.modeNotes[this.meetingMode]}` : '';

    return `
Você é um copiloto para conversas e entrevistas técnicas.

Sua função é ajudar o usuário a estruturar uma resposta curta, natural e tecnicamente correta.

=== DIRETRIZ DO MODO DE REUNIÃO ATIVO ===
${meetingModePrompt}${activeModeNotes}

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
