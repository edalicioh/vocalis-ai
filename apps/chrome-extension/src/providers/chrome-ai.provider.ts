// ============================================================
// Provedor Chrome Built-in AI / Gemini Nano (Chrome Extension)
// ============================================================

import { LlmProvider, GenerationRequest, GenerationEvent } from './provider.interface.js';

export class ChromeAiProvider implements LlmProvider {
  readonly providerId = 'chrome_ai';

  async isAvailable(): Promise<boolean> {
    const aiObj = (globalThis as unknown as { ai?: { languageModel?: { capabilities: () => Promise<{ available: string }> } } }).ai;
    if (!aiObj?.languageModel) return false;
    try {
      const caps = await aiObj.languageModel.capabilities();
      return caps.available === 'readily' || caps.available === 'after-download';
    } catch {
      return false;
    }
  }

  async *generate(
    request: GenerationRequest,
    signal?: AbortSignal
  ): AsyncIterable<GenerationEvent> {
    yield { id: request.id, kind: 'started' };

    try {
      const aiObj = (globalThis as unknown as {
        ai?: {
          languageModel?: {
            create: (opts?: { systemPrompt?: string }) => Promise<{
              promptStreaming: (p: string) => AsyncIterable<string>;
              destroy: () => void;
            }>;
          };
        };
      }).ai;

      if (!aiObj?.languageModel) {
        yield {
          id: request.id,
          kind: 'failed',
          error: 'Chrome Built-in AI (window.ai.languageModel) não suportado neste navegador.'
        };
        return;
      }

      const session = await aiObj.languageModel.create({
        systemPrompt: request.systemPrompt || 'Você é um assistente técnico prestativo e conciso.'
      });

      let prompt = request.prompt;
      if (request.historyContext) {
        prompt = `[HISTÓRICO DA CONVERSA]\n${request.historyContext}\n\n${prompt}`;
      }

      let accumulatedText = '';
      const stream = session.promptStreaming(prompt);

      for await (const chunk of stream) {
        if (signal?.aborted) {
          session.destroy();
          yield { id: request.id, kind: 'cancelled', reason: 'Cancelado pelo usuário' };
          return;
        }

        // A API Prompt Streaming do Chrome por padrão retorna o texto completo até o momento
        const delta = chunk.startsWith(accumulatedText)
          ? chunk.slice(accumulatedText.length)
          : chunk;
        accumulatedText = chunk;

        if (delta) {
          yield {
            id: request.id,
            kind: 'delta',
            textDelta: delta,
            fullText: accumulatedText
          };
        }
      }

      session.destroy();
      yield {
        id: request.id,
        kind: 'completed',
        fullText: accumulatedText
      };
    } catch (err: unknown) {
      if (signal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
        yield { id: request.id, kind: 'cancelled', reason: 'Requisição abortada.' };
      } else {
        const message = err instanceof Error ? err.message : String(err);
        yield { id: request.id, kind: 'failed', error: message };
      }
    }
  }
}
