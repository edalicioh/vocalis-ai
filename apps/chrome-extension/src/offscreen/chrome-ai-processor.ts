import { ProcessedTranscriptPayload } from '@conversation-copilot/shared-types';

export interface ChromeAISessionCapabilities {
  available: 'readily' | 'after-download' | 'no';
}

export interface ChromeAIProcessorStatus {
  available: boolean;
  status: 'readily' | 'after-download' | 'no' | 'unsupported';
}

export class ChromeBuiltInAIProcessor {
  private session: any = null;
  private isAvailable: boolean = false;
  private status: 'readily' | 'after-download' | 'no' | 'unsupported' = 'unsupported';
  private utteranceCount: number = 0;
  private lastSummaryTimestamp: number = Date.now();
  private currentSummary: string = '';
  private utterancesBuffer: string[] = [];

  constructor() {
    this.initCapabilities();
  }

  /**
   * Inicializa e verifica as capacidades da Prompt API (`window.ai.languageModel`)
   */
  public async initCapabilities(): Promise<ChromeAIProcessorStatus> {
    try {
      const win = typeof globalThis !== 'undefined' ? (globalThis as any) : (typeof window !== 'undefined' ? (window as any) : null);
      if (win && win.ai && win.ai.languageModel) {
        const capabilities: ChromeAISessionCapabilities = await win.ai.languageModel.capabilities();
        this.status = capabilities.available;
        this.isAvailable = capabilities.available === 'readily' || capabilities.available === 'after-download';
      } else {
        this.status = 'unsupported';
        this.isAvailable = false;
      }
    } catch (err) {
      console.warn('[ChromeBuiltInAIProcessor] Falha ao verificar capacidades do window.ai:', err);
      this.status = 'unsupported';
      this.isAvailable = false;
    }

    return {
      available: this.isAvailable,
      status: this.status
    };
  }

  public getStatus(): ChromeAIProcessorStatus {
    return {
      available: this.isAvailable,
      status: this.status
    };
  }

  /**
   * Correção ortográfica passiva e silenciosa de termos e jargões técnicos na transcrição Whisper
   */
  public async correctUtterance(rawText: string): Promise<{ text: string; corrected: boolean }> {
    if (!rawText || !rawText.trim()) {
      return { text: rawText, corrected: false };
    }

    if (!this.isAvailable) {
      return { text: rawText, corrected: false };
    }

    try {
      const win = typeof globalThis !== 'undefined' ? (globalThis as any) : (window as any);
      if (!this.session && win.ai?.languageModel) {
        this.session = await win.ai.languageModel.create({
          systemPrompt:
            'Você é um corretor ortográfico silencioso de jargões técnicos de TI em Português do Brasil. ' +
            'Sua única função é corrigir termos técnicos truncados ou mal transcritos (ex: Larabel -> Laravel, Dockerizar -> Dockerize, Vites -> Vitest, Fast-ify -> Fastify, Postgresql -> PostgreSQL, Kubernetes -> Kubernetes, Redis cluster -> Redis Cluster). ' +
            'Mantenha todo o restante da frase inalterado. Retorne APENAS o texto corrigido sem explicações.'
        });
      }

      if (this.session) {
        const prompt = `Corrija apenas os termos técnicos da transcrição: "${rawText}"`;
        const correctedText = await this.session.prompt(prompt);
        const result = correctedText ? correctedText.trim() : rawText;
        return {
          text: result,
          corrected: result !== rawText
        };
      }
    } catch (err) {
      console.warn('[ChromeBuiltInAIProcessor] Erro na correção de termo via Gemini Nano, usando bypass:', err);
      // Reseta sessão morta para que a próxima chamada tente recriar
      this.session = null;
    }

    return { text: rawText, corrected: false };
  }

  /**
   * Sumarização incremental contínua do histórico de fala (gatilho híbrido: 5 frases ou 60s)
   */
  public async processTranscript(rawText: string): Promise<ProcessedTranscriptPayload> {
    const correction = await this.correctUtterance(rawText);
    const textToUse = correction.text;

    this.utterancesBuffer.push(textToUse);
    this.utteranceCount++;

    const now = Date.now();
    const timeElapsed = now - this.lastSummaryTimestamp;
    const shouldSummarize = this.utteranceCount >= 5 || timeElapsed >= 60000;

    let category: string | undefined = undefined;

    if (shouldSummarize && this.isAvailable && this.utterancesBuffer.length > 0) {
      let summarySession: any = null;
      try {
        const win = typeof globalThis !== 'undefined' ? (globalThis as any) : (window as any);
        if (win.ai?.languageModel) {
          summarySession = await win.ai.languageModel.create({
            systemPrompt:
              'Você é um sintetizador de conversas de entrevistas técnicas. ' +
              'Resuma os tópicos técnicos discutidos em até 2 linhas e identifique a categoria principal (ex: DevOps, Backend, Frontend, System Design, General).'
          });

          const conversationText = this.utterancesBuffer.slice(-10).join('\n');
          const summaryResponse = await summarySession.prompt(
            `Resuma o contexto técnico e identifique a categoria destas frases:\n${conversationText}`
          );

          if (summaryResponse) {
            this.currentSummary = summaryResponse.trim();
            this.lastSummaryTimestamp = now;
            this.utteranceCount = 0;
          }
        }
      } catch (err) {
        console.warn('[ChromeBuiltInAIProcessor] Erro na sumarização via Gemini Nano:', err);
      } finally {
        // Garante destruição da sessão temporária mesmo em caso de erro
        if (summarySession && typeof summarySession.destroy === 'function') {
          try {
            summarySession.destroy();
          } catch {
            // Ignora erro no destroy
          }
        }
      }
    }

    return {
      originalText: rawText,
      correctedText: textToUse,
      incrementalSummary: this.currentSummary || undefined,
      category: category,
      isBypass: !this.isAvailable
    };
  }

  public destroy(): void {
    if (this.session && typeof this.session.destroy === 'function') {
      try {
        this.session.destroy();
      } catch (e) {
        // Ignora erro no destroy
      }
    }
    this.session = null;
  }
}
