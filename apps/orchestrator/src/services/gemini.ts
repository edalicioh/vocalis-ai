import { GoogleGenerativeAI } from '@google/generative-ai';
import { StructuredAnswer, ResponseMode, UserProfile, JobDescription } from '@conversation-copilot/shared-types';
import { AnswerProvider, AnswerInput, AnswerEvent } from './answer-provider.js';

export function buildSystemInstruction(userProfile?: UserProfile, jobDescription?: JobDescription): string {
  const parts: string[] = [];

  parts.push(`Você é um assistente copiloto pessoal especializado em entrevistas e reuniões técnicas.`);
  parts.push(`Sua função é gerar sugestões de respostas diretas, concisas (30-60 palavras) e tecnicamente precisas em Português do Brasil (pt-BR).`);
  parts.push(`Nunca invente experiências falsas do usuário nem alucine fatos não declarados (RNF-004).`);

  if (userProfile) {
    parts.push(`\n[PERFIL DO CANDIDATO]`);
    if (userProfile.name) parts.push(`- Nome: ${userProfile.name}`);
    if (userProfile.role) parts.push(`- Cargo: ${userProfile.role}`);
    if (userProfile.seniority) parts.push(`- Senioridade: ${userProfile.seniority}`);
    if (userProfile.skills?.length) parts.push(`- Habilidades: ${userProfile.skills.join(', ')}`);
    if (userProfile.experiences?.length) parts.push(`- Experiências: ${userProfile.experiences.join('; ')}`);
    if (userProfile.projects?.length) parts.push(`- Projetos: ${userProfile.projects.join('; ')}`);
    if (userProfile.strengths?.length) parts.push(`- Pontos Fortes: ${userProfile.strengths.join(', ')}`);
    if (userProfile.weaknesses?.length) parts.push(`- Áreas a desenvolver: ${userProfile.weaknesses.join(', ')}`);
  }

  if (jobDescription) {
    parts.push(`\n[DETALHES DA VAGA]`);
    if (jobDescription.title) parts.push(`- Título da vaga: ${jobDescription.title}`);
    if (jobDescription.company) parts.push(`- Empresa: ${jobDescription.company}`);
    if (jobDescription.description) parts.push(`- Descrição: ${jobDescription.description}`);
    if (jobDescription.requirements?.length) parts.push(`- Requisitos obrigatórios: ${jobDescription.requirements.join(', ')}`);
    if (jobDescription.niceToHave?.length) parts.push(`- Diferenciais: ${jobDescription.niceToHave.join(', ')}`);
    if (jobDescription.technologies?.length) parts.push(`- Tecnologias: ${jobDescription.technologies.join(', ')}`);
  }

  return parts.join('\n');
}

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

  public setModel(model: string) {
    if (model && model.trim()) {
      this.modelName = model.trim();
    }
  }

  public getModel(): string {
    return this.modelName;
  }

  public isConfigured(): boolean {
    return this.genAI !== null;
  }

  public async listModels(apiKey?: string): Promise<string[]> {
    const key = apiKey || (this.genAI as any)?.apiKey || process.env.GEMINI_API_KEY;
    if (!key) return ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const json = await res.json();
      const models: string[] = (json.models || [])
        .map((m: any) => m.name?.replace(/^models\//, ''))
        .filter((name: string) => name && name.startsWith('gemini'));
      return models.length > 0 ? models : ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    } catch {
      return ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    }
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

    // Se um sinal externo for passado, associa abort handler
    if (input.signal) {
      input.signal.addEventListener('abort', () => {
        controller.abort();
      });
    }

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
      const systemInstruction = buildSystemInstruction(input.userProfile, input.jobDescription);
      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
        systemInstruction
      });
      const result = await model.generateContentStream(input.prompt, {
        signal: controller.signal
      });

      let fullText = '';

      for await (const chunk of result.stream) {
        // Check if cancelled
        if (controller.signal.aborted || input.signal?.aborted) {
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
