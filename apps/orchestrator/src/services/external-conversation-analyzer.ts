import { randomUUID } from 'node:crypto';
import type {
  ConversationTone,
  MeetingMode,
  Utterance
} from '@conversation-copilot/shared-types';
import type { AnswerInput, AnswerProvider } from './answer-provider.js';

const TONS_VALIDOS: readonly ConversationTone[] = [
  'neutro',
  'amigável',
  'tenso',
  'disperso',
  'interessado',
  'confuso',
  'formal'
];

const ROTULOS_MODO: Record<MeetingMode, string> = {
  technical_interview: 'entrevista técnica',
  system_design: 'desenho de sistemas',
  code_review: 'revisão de código',
  general: 'conversa geral'
};

export interface ExternalConversationContext {
  accumulatedSummary: string;
  recentUtterances: readonly Utterance[];
  meetingMode: MeetingMode;
}

export interface ExternalQuestionAnalysisInput extends ExternalConversationContext {
  candidateText: string;
}

export interface ExternalQuestionValidationResult {
  isQuestion: boolean;
  confidence: number;
  questionText: string;
  reason: string;
}

/** Resultado estruturalmente compatível com ToneAnalysisResult. */
export interface ExternalToneAnalysisResult {
  tone: ConversationTone;
  confidence: number;
  summary: string;
}

export interface ExternalConversationAnalyzerOptions {
  timeoutMs?: number;
  utteranceWindowSize?: number;
}

interface JsonObject {
  [key: string]: unknown;
}

/**
 * Usa o provedor externo apenas em análises seletivas e consome seu fluxo
 * internamente, sem publicar eventos de resposta para a interface.
 */
export class ExternalConversationAnalyzer {
  private readonly timeoutMs: number;
  private readonly utteranceWindowSize: number;

  constructor(
    private readonly provider: AnswerProvider | null | undefined,
    options: ExternalConversationAnalyzerOptions = {}
  ) {
    this.timeoutMs = this.normalizeTimeout(options.timeoutMs);
    this.utteranceWindowSize = this.normalizeWindowSize(options.utteranceWindowSize);
  }

  public async validateAmbiguousQuestion(
    input: ExternalQuestionAnalysisInput,
    signal?: AbortSignal
  ): Promise<ExternalQuestionValidationResult | null> {
    const candidateText = this.sanitizeText(input.candidateText, 2_000);
    if (!candidateText) {
      return null;
    }

    const context = this.buildPromptContext(input);
    const prompt = `
Você valida perguntas ambíguas em conversas profissionais.
Analise somente o contexto fornecido e decida se o texto candidato é uma pergunta, inclusive quando for indireta ou estiver sem ponto de interrogação.
O modo da reunião é ${ROTULOS_MODO[input.meetingMode]}.

Responda com EXATAMENTE um objeto JSON válido, sem Markdown, comentários ou texto adicional, neste formato:
{"isQuestion":true,"confidence":0.0,"questionText":"pergunta reconstruída ou texto candidato","reason":"justificativa curta"}

Regras:
- "isQuestion" deve ser booleano.
- "confidence" deve ser um número entre 0 e 1.
- "questionText" e "reason" devem estar em Português do Brasil.
- Não invente informações ausentes.

CONTEXTO:
${JSON.stringify({ ...context, textoCandidato: candidateText })}
`.trim();

    const response = await this.requestJson('pergunta', prompt, signal);
    return response ? this.parseQuestionResult(response) : null;
  }

  public async refineTone(
    input: ExternalConversationContext,
    signal?: AbortSignal
  ): Promise<ExternalToneAnalysisResult | null> {
    const context = this.buildPromptContext(input);
    const prompt = `
Você refina a classificação do tom de conversas profissionais.
Analise somente o resumo acumulado e as falas recentes fornecidas.
O modo da reunião é ${ROTULOS_MODO[input.meetingMode]}.

Responda com EXATAMENTE um objeto JSON válido, sem Markdown, comentários ou texto adicional, neste formato:
{"tone":"neutro","confidence":0.0,"summary":"descrição curta do tom atual"}

Regras:
- "tone" deve ser exatamente uma destas categorias: ${TONS_VALIDOS.join(', ')}.
- "confidence" deve ser um número entre 0 e 1.
- "summary" deve estar em Português do Brasil.
- Não invente informações ausentes.

CONTEXTO:
${JSON.stringify(context)}
`.trim();

    const response = await this.requestJson('tom', prompt, signal);
    return response ? this.parseToneResult(response) : null;
  }

  private buildPromptContext(input: ExternalConversationContext): JsonObject {
    return {
      resumoAcumulado: this.sanitizeText(input.accumulatedSummary, 8_000),
      ultimasFalas: input.recentUtterances
        .filter(utterance => utterance.isFinal)
        .slice(-this.utteranceWindowSize)
        .map(utterance => ({
          text: this.sanitizeText(utterance.text, 2_000)
        })),
      modoReuniao: input.meetingMode
    };
  }

  private async requestJson(
    kind: 'pergunta' | 'tom',
    prompt: string,
    externalSignal?: AbortSignal
  ): Promise<JsonObject | null> {
    try {
      if (!this.provider?.isConfigured()) {
        return null;
      }
    } catch {
      return null;
    }

    if (externalSignal?.aborted) {
      return null;
    }

    const controller = new AbortController();
    const abortFromExternalSignal = () => controller.abort();
    externalSignal?.addEventListener('abort', abortFromExternalSignal, { once: true });
    const requestId = `analise-externa-${kind}-${randomUUID()}`;
    const providerInput: AnswerInput = {
      requestId,
      question: kind === 'pergunta'
        ? 'Validação externa de pergunta ambígua'
        : 'Refinamento externo do tom da conversa',
      prompt,
      responseMode: 'short',
      signal: controller.signal
    };

    const generation = this.collectDeltas(providerInput, controller.signal);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>(resolve => {
      timer = setTimeout(() => {
        controller.abort();
        resolve(null);
      }, this.timeoutMs);
    });

    try {
      const responseText = await Promise.race([generation, timeout]);
      return responseText ? this.parseJsonObject(responseText) : null;
    } catch {
      return null;
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      externalSignal?.removeEventListener('abort', abortFromExternalSignal);
    }
  }

  private async collectDeltas(input: AnswerInput, signal: AbortSignal): Promise<string | null> {
    let responseText = '';

    for await (const event of this.provider!.generate(input)) {
      if (signal.aborted) {
        return null;
      }

      if (event.type === 'answer.delta') {
        responseText += event.data.chunk;
      }
    }

    return signal.aborted || !responseText.trim() ? null : responseText;
  }

  private parseQuestionResult(value: JsonObject): ExternalQuestionValidationResult | null {
    if (
      typeof value.isQuestion !== 'boolean'
      || !this.isFiniteNumber(value.confidence)
      || typeof value.questionText !== 'string'
      || typeof value.reason !== 'string'
    ) {
      return null;
    }

    const questionText = this.sanitizeText(value.questionText, 2_000);
    const reason = this.sanitizeText(value.reason, 500);
    if (!reason || (value.isQuestion && !questionText)) {
      return null;
    }

    return {
      isQuestion: value.isQuestion,
      confidence: this.clampConfidence(value.confidence),
      questionText,
      reason
    };
  }

  private parseToneResult(value: JsonObject): ExternalToneAnalysisResult | null {
    if (
      typeof value.tone !== 'string'
      || !TONS_VALIDOS.includes(value.tone as ConversationTone)
      || !this.isFiniteNumber(value.confidence)
      || typeof value.summary !== 'string'
    ) {
      return null;
    }

    const summary = this.sanitizeText(value.summary, 500);
    if (!summary) {
      return null;
    }

    return {
      tone: value.tone as ConversationTone,
      confidence: this.clampConfidence(value.confidence),
      summary
    };
  }

  private parseJsonObject(responseText: string): JsonObject | null {
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

  private extractFirstJsonObject(text: string): string | null {
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

  private sanitizeText(value: string, maxLength: number): string {
    return value
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLength);
  }

  private isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
  }

  private clampConfidence(value: number): number {
    return Math.min(1, Math.max(0, value));
  }

  private normalizeTimeout(value: number | undefined): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
      ? Math.floor(value)
      : 5_000;
  }

  private normalizeWindowSize(value: number | undefined): number {
    const windowSize = typeof value === 'number' && Number.isFinite(value)
      ? Math.floor(value)
      : 10;
    return Math.min(10, Math.max(5, windowSize));
  }
}
