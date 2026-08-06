// ============================================================
// Gerenciador de Contexto (Chrome Extension)
// ============================================================

import {
  UserProfile,
  JobDescription,
  Utterance,
  ResponseMode,
  ConversationSummary,
  MeetingMode
} from '@conversation-copilot/shared-types';

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
  private modeNotes: Partial<Record<MeetingMode, string>> = {};

  private readonly SYSTEM_PROMPTS: Record<MeetingMode, string> = {
    technical_interview:
      'MODO: ENTREVISTA TÉCNICA.\n' +
      'Foco em respostas objetivas, diretas e faladas naturalmente em até 30s. Destaque conceitos chave e experiências do perfil.',
    system_design:
      'MODO: SYSTEM DESIGN & ARQUITETURA.\n' +
      'Foco em requisitos funcionais/não-funcionais, trade-offs de arquitetura, escalabilidade, bancos de dados, gargalos e clareza.',
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

  public setUserProfile(profile: Partial<UserProfile>) {
    this.userProfile = { ...this.userProfile, ...profile };
  }

  public getUserProfile(): UserProfile {
    return this.userProfile;
  }

  public setJobDescription(job: Partial<JobDescription>) {
    this.jobDescription = { ...this.jobDescription, ...job };
  }

  public getJobDescription(): JobDescription {
    return this.jobDescription;
  }

  public addUtterance(utterance: Utterance) {
    this.utterances.push(utterance);
    // Manter janela deslizante das últimas 50 falas
    if (this.utterances.length > 50) {
      this.utterances.shift();
    }
  }

  public getRecentUtterances(count: number = 10): Utterance[] {
    return this.utterances.slice(-count);
  }

  public clearHistory() {
    this.utterances = [];
    this.summary = {
      topics: [],
      previousQuestions: [],
      technologies: [],
      summaryText: '',
      lastUpdated: 0
    };
  }

  public buildSystemPrompt(): string {
    const basePrompt = this.SYSTEM_PROMPTS[this.meetingMode] || this.SYSTEM_PROMPTS.technical_interview;
    const note = this.modeNotes[this.meetingMode];

    let fullPrompt = `${basePrompt}\n`;

    if (note && note.trim()) {
      fullPrompt += `\n[NOTAS DE APOIO DO MODO]\n${note.trim()}\n`;
    }

    if (this.userProfile.summary || this.userProfile.skills.length > 0) {
      fullPrompt += `\n[PERFIL DO CANDIDATO]\n`;
      if (this.userProfile.role) fullPrompt += `Cargo: ${this.userProfile.role} (${this.userProfile.seniority})\n`;
      if (this.userProfile.skills.length > 0) fullPrompt += `Habilidades: ${this.userProfile.skills.join(', ')}\n`;
      if (this.userProfile.summary) fullPrompt += `Resumo: ${this.userProfile.summary}\n`;
    }

    if (this.jobDescription.title || this.jobDescription.description) {
      fullPrompt += `\n[VAGA DE INTERESSE]\n`;
      if (this.jobDescription.title) fullPrompt += `Título: ${this.jobDescription.title}\n`;
      if (this.jobDescription.requirements.length > 0) fullPrompt += `Requisitos: ${this.jobDescription.requirements.join(', ')}\n`;
    }

    fullPrompt += `\nINSTRUÇÕES FINAIS: Responda em Português do Brasil de forma natural, profissional e direta.`;
    return fullPrompt;
  }

  public buildHistoryContext(maxUtterances: number = 8): string {
    const recent = this.getRecentUtterances(maxUtterances);
    if (recent.length === 0) return '';

    return recent
      .map(u => {
        const label = u.speaker === 'interviewer' ? 'Entrevistador' : u.speaker === 'candidate' ? 'Candidato' : 'Interlocutor';
        return `${label}: ${u.text}`;
      })
      .join('\n');
  }
}
