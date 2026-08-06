// ============================================================
// Provedor Ollama Local (Chrome Extension)
// ============================================================

import { LlmProvider, GenerationRequest, GenerationEvent } from './provider.interface.js';

export class OllamaProvider implements LlmProvider {
  readonly providerId = 'ollama';
  private endpoint: string;
  private modelName: string;

  constructor(
    endpoint: string = 'http://localhost:11434',
    modelName: string = 'llama3'
  ) {
    this.endpoint = endpoint.replace(/\/$/, '');
    this.modelName = modelName;
  }

  public updateConfig(endpoint?: string, modelName?: string) {
    if (endpoint) this.endpoint = endpoint.replace(/\/$/, '');
    if (modelName) this.modelName = modelName;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.endpoint}/api/tags`, { method: 'GET' });
      return response.ok;
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
      let prompt = request.prompt;
      if (request.systemPrompt) {
        prompt = `[INSTRUÇÕES DO SISTEMA]\n${request.systemPrompt}\n\n` + prompt;
      }
      if (request.historyContext) {
        prompt = `[HISTÓRICO RECENTE DA REUNIÃO]\n${request.historyContext}\n\n` + prompt;
      }

      const response = await fetch(`${this.endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          prompt,
          stream: true
        }),
        signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        yield {
          id: request.id,
          kind: 'failed',
          error: `Erro no servidor Ollama Local (${response.status}): ${errorText}`
        };
        return;
      }

      if (!response.body) {
        yield { id: request.id, kind: 'failed', error: 'Corpo da resposta vazio.' };
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';

      while (true) {
        if (signal?.aborted) {
          yield { id: request.id, kind: 'cancelled', reason: 'Cancelado pelo usuário' };
          return;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const data = JSON.parse(trimmed);
            const textChunk = data.response || '';
            if (textChunk) {
              accumulatedText += textChunk;
              yield {
                id: request.id,
                kind: 'delta',
                textDelta: textChunk,
                fullText: accumulatedText
              };
            }
          } catch {
            // Ignorar linhas com erro de parse
          }
        }
      }

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
