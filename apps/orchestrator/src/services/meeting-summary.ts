import { ContextManager } from './context-manager.js';
import { GeminiProvider } from './gemini.js';
import { AnswerProvider, AnswerInput } from './answer-provider.js';
import { ConversationSummary } from '@conversation-copilot/shared-types';

export interface MeetingSummaryResult {
  executiveSummary: string;
  decisions: string[];
  actionItems: string[];
  formattedMarkdown: string;
}

interface JsonObject {
  [key: string]: unknown;
}

export class MeetingSummaryService {
  /**
   * Gera o snapshot estruturado da conversa (RF-018) consumindo o provedor
   * internamente, sem publicar eventos de resposta para a interface.
   * Usado pela sumarização contínua exibida no painel.
   */
  public static async generateStructuredSummary(
    cm: ContextManager,
    provider: AnswerProvider | null | undefined,
    signal?: AbortSignal
  ): Promise<ConversationSummary | null> {
    try {
      if (!provider?.isConfigured()) {
        return null;
      }
    } catch {
      return null;
    }

    if (signal?.aborted) {
      return null;
    }

    const input: AnswerInput = {
      requestId: `resumo-continuo-${Date.now()}`,
      question: 'resumo da conversa',
      prompt: cm.buildSummaryPrompt(),
      responseMode: 'short',
      purpose: 'summary',
      signal
    };

    try {
      const responseText = await this.collectDeltas(provider, input, signal);
      if (!responseText) {
        return null;
      }
      const parsed = this.parseConversationSummary(responseText);
      return parsed ? { ...parsed, lastUpdated: Date.now() } : null;
    } catch {
      return null;
    }
  }

  /**
   * Gera a ata completa em Markdown estruturado ao final da reunião.
   */
  public static async generateSummary(
    cm: ContextManager,
    geminiProvider: GeminiProvider
  ): Promise<string> {
    const recentUtterances = cm.getRecentUtterances();
    if (recentUtterances.length === 0) {
      return this.buildFallbackSummary(cm);
    }

    const fullDialogue = recentUtterances
      .map(u => `[${u.speaker === 'interviewer' ? 'ENTREVISTADOR/REUNIÃO' : u.speaker === 'candidate' ? 'VOCÊ' : 'FALA'}]: ${u.text}`)
      .join('\n');

    const prompt = `
Você é um secretário técnico altamente qualificado.
Analise a transcrição da reunião/entrevista abaixo e gere uma ata estruturada em Português do Brasil (pt-BR).

=== REGRAS DE FORMATO ===
Gere EXATAMENTE o documento Markdown com as seguintes seções:

## 📌 Resumo Executivo
(Uma síntese objetiva de 2 a 4 parágrafos sobre o tema principal e discussões)

## 🤝 Decisões Tomadas
(Lista de decisões alinhadas durante a conversa, em marcadores "- ")

## ✅ Action Items (Tarefas & Próximos Passos)
(Lista de tarefas identificadas ou compromissos assumidos, em marcadores "- [ ] ")

=== TRANSCRIÇÃO DA REUNIÃO ===
${fullDialogue}
`.trim();

    try {
      if (!geminiProvider.isConfigured()) {
        return this.buildFallbackSummary(cm);
      }

      let generatedMarkdown = '';
      const stream = geminiProvider.generate({
        requestId: `summary-${Date.now()}`,
        question: 'resumo da reunião',
        prompt,
        responseMode: 'full',
        purpose: 'summary',
        userProfile: cm.getUserProfile(),
        jobDescription: cm.getJobDescription()
      });

      for await (const event of stream) {
        if (event.type === 'answer.delta') {
          generatedMarkdown += event.data.chunk;
        }
      }

      if (!generatedMarkdown.trim()) {
        return this.buildFallbackSummary(cm);
      }

      const liveSummary = cm.getSummary();
      const liveSummarySection = liveSummary.summaryText
        ? `\n\n---\n\n## 📝 Pontos-Chave da Conversa (Resumo Contínuo)\n\n${liveSummary.summaryText}\n${
          liveSummary.decisions.length > 0 ? `\n**Decisões:**\n${liveSummary.decisions.map(d => `- ${d}`).join('\n')}\n` : ''
        }${
          liveSummary.actionItems.length > 0 ? `\n**Ações:**\n${liveSummary.actionItems.map(a => `- [ ] ${a}`).join('\n')}\n` : ''
        }`
        : '';

      return `${generatedMarkdown.trim()}${liveSummarySection}\n\n---\n\n## 💬 Transcrição Completa\n\n${fullDialogue}`;
    } catch {
      return this.buildFallbackSummary(cm);
    }
  }

  private static async collectDeltas(
    provider: AnswerProvider,
    input: AnswerInput,
    signal?: AbortSignal
  ): Promise<string | null> {
    let responseText = '';

    for await (const event of provider.generate(input)) {
      if (signal?.aborted) {
        return null;
      }

      if (event.type === 'answer.delta') {
        responseText += event.data.chunk;
      }
    }

    return signal?.aborted || !responseText.trim() ? null : responseText;
  }

  private static parseConversationSummary(responseText: string): ConversationSummary | null {
    const parsed = this.parseJsonObject(responseText);
    if (!parsed) {
      return null;
    }

    const summary: ConversationSummary = {
      topics: this.toStringArray(parsed.topics),
      previousQuestions: this.toStringArray(parsed.previousQuestions),
      technologies: this.toStringArray(parsed.technologies),
      decisions: this.toStringArray(parsed.decisions),
      actionItems: this.toStringArray(parsed.actionItems),
      summaryText: typeof parsed.summaryText === 'string' ? parsed.summaryText.trim() : '',
      lastUpdated: 0
    };

    if (!summary.summaryText && summary.topics.length === 0) {
      return null;
    }

    return summary;
  }

  private static toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .filter((item): item is string => typeof item === 'string')
      .map(item => item.trim())
      .filter(Boolean);
  }

  private static parseJsonObject(responseText: string): JsonObject | null {
    const normalized = responseText.replace(/^\uFEFF/, '').trim();
    const fencedMatch = normalized.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    const candidates = [normalized];
    if (fencedMatch) {
      candidates.push(fencedMatch[1].trim());
    }

    const extracted = this.extractFirstJsonObject(normalized);
    if (extracted) {
      candidates.push(extracted);
    }

    for (const candidate of candidates) {
      try {
        const parsed: unknown = JSON.parse(candidate);
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as JsonObject;
        }
      } catch {
        // Tenta o próximo formato possível.
      }
    }

    return null;
  }

  private static extractFirstJsonObject(text: string): string | null {
    const start = text.indexOf('{');
    if (start < 0) {
      return null;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < text.length; index++) {
      const character = text[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (character === '\\') {
          escaped = true;
        } else if (character === '"') {
          inString = false;
        }
        continue;
      }

      if (character === '"') {
        inString = true;
      } else if (character === '{') {
        depth++;
      } else if (character === '}') {
        depth--;
        if (depth === 0) {
          return text.slice(start, index + 1);
        }
      }
    }

    return null;
  }

  private static buildFallbackSummary(cm: ContextManager): string {
    const recentUtterances = cm.getRecentUtterances();
    const fullDialogue = recentUtterances.length > 0
      ? recentUtterances
        .map(u => `[${u.speaker === 'interviewer' ? 'ENTREVISTADOR/REUNIÃO' : u.speaker === 'candidate' ? 'VOCÊ' : 'FALA'}]: ${u.text}`)
        .join('\n')
      : 'Nenhuma fala registrada.';

    const liveSummary = cm.getSummary();
    const liveSummarySection = liveSummary.summaryText
      ? `\n## 📝 Pontos-Chave da Conversa (Resumo Contínuo)\n\n${liveSummary.summaryText}\n${
          liveSummary.decisions.length > 0 ? `\n**Decisões:**\n${liveSummary.decisions.map(d => `- ${d}`).join('\n')}\n` : ''
        }${
          liveSummary.actionItems.length > 0 ? `\n**Ações:**\n${liveSummary.actionItems.map(a => `- [ ] ${a}`).join('\n')}\n` : ''
        }`
      : '';

    return `
# Ata de Reunião — Copiloto de Conversas

## 📌 Resumo Executivo
Sessão encerrada. O acompanhamento em tempo real capturou o diálogo da reunião.

## 🤝 Decisões Tomadas
- Sessão de áudio finalizada pelo usuário.

## ✅ Action Items (Tarefas & Próximos Passos)
- [ ] Revisar transcrição e sugestões contextuais no painel.
${liveSummarySection}
---

## 💬 Transcrição Completa

${fullDialogue}
`.trim();
  }
}
