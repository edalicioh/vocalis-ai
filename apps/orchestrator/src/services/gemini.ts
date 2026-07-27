import { GoogleGenerativeAI, GenerateContentStreamResult } from '@google/generative-ai';
import { StructuredAnswer, ResponseMode } from '@conversation-copilot/shared-types';
import { AnswerProvider, AnswerInput, AnswerEvent } from './answer-provider.js';

/**
 * Implementação do AnswerProvider para Google Gemini.
 * 
 * Provedor padrão substituível por OpenAI, Anthropic, etc (RNF-006).
 */
export class GeminiProvider implements AnswerProvider {
  private genAI: GoogleGenerativeAI | null = null;
  private modelName: string = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  private activeRequests = new Map<string, AbortController>();

  constructor(apiKey?: string) {
    if (apiKey || process.env.GEMINI_API_KEY) {
      const key = apiKey || process.env.GEMINI_API_KEY!;
      this.genAI = new GoogleGenerativeAI(key);
    }
  }

  public setApiKey(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  public isConfigured(): boolean {
    return this.genAI !== null;
  }

  public async *generate(input: AnswerInput): AsyncIterable<AnswerEvent> {
    if (!this.genAI) {
      yield {
        type: 'answer.failed',
        data: { id: input.requestId, error: 'Chave de API do Gemini não configurada.' }
      };
      return;
    }

    const controller = new AbortController();
    this.activeRequests.set(input.requestId, controller);

    // Emit answer.started
    yield {
      type: 'answer.started',
      data: {
        id: input.requestId,
        question: input.question,
        responseMode: input.responseMode
      }
    };

    try {
      const model = this.genAI.getGenerativeModel({ model: this.modelName });
      const result = await model.generateContentStream(input.prompt);

      let fullText = '';

      for await (const chunk of result.stream) {
        // Check if cancelled
        if (controller.signal.aborted) {
          yield {
            type: 'answer.cancelled',
            data: { id: input.requestId, reason: 'Nova pergunta detectada' }
          };
          return;
        }

        const chunkText = chunk.text();
        if (chunkText) {
          fullText += chunkText;
          yield {
            type: 'answer.delta',
            data: { id: input.requestId, chunk: chunkText }
          };
        }
      }

      // Parse the structured answer
      const structured = this.parseStructuredAnswer(fullText, input.responseMode);

      yield {
        type: 'answer.completed',
        data: { id: input.requestId, structured }
      };
    } catch (err: any) {
      if (controller.signal.aborted) {
        yield {
          type: 'answer.cancelled',
          data: { id: input.requestId, reason: 'Requisição cancelada' }
        };
      } else {
        yield {
          type: 'answer.failed',
          data: { id: input.requestId, error: `Falha no Gemini: ${err.message || err}` }
        };
      }
    } finally {
      this.activeRequests.delete(input.requestId);
    }
  }

  public async cancel(requestId: string): Promise<void> {
    const controller = this.activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(requestId);
    }
  }

  /** Cancel all active requests (used when a new question is detected — RN-002) */
  public async cancelAll(): Promise<void> {
    for (const [id, controller] of this.activeRequests) {
      controller.abort();
    }
    this.activeRequests.clear();
  }

  /**
   * Tenta parsear o JSON estruturado da resposta.
   * Se não for JSON válido, cria a estrutura a partir do texto raw.
   */
  private parseStructuredAnswer(text: string, mode: ResponseMode): StructuredAnswer {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          questionSummary: parsed.questionSummary || '',
          opening: parsed.opening || '',
          answer: parsed.answer || '',
          keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
          clarifyingQuestion: parsed.clarifyingQuestion || undefined,
          audioHint: parsed.audioHint || undefined
        };
      } catch {
        // fallthrough to raw text fallback
      }
    }

    // Fallback: create structure from raw text
    return {
      questionSummary: '',
      opening: '',
      answer: text.trim(),
      keyPoints: this.extractKeyPoints(text),
      clarifyingQuestion: undefined,
      audioHint: text.substring(0, 120).trim()
    };
  }

  /** Extrai palavras-chave simples do texto como fallback */
  private extractKeyPoints(text: string): string[] {
    const words = text
      .split(/[\s,.;:]+/)
      .filter(w => w.length > 4)
      .map(w => w.trim());

    const uniqueWords = [...new Set(words)];
    return uniqueWords.slice(0, 5);
  }
}
