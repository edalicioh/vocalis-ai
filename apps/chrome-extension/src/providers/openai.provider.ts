// ============================================================
// Provedor OpenAI / OpenRouter / Custom Proxy (Chrome Extension)
// ============================================================

import { LlmProvider, GenerationRequest, GenerationEvent } from './provider.interface.js';

export class OpenAiProvider implements LlmProvider {
  readonly providerId: string;
  private apiKey: string;
  private endpoint: string;
  private modelName: string;

  constructor(
    providerId: string = 'openai',
    apiKey: string = '',
    endpoint: string = 'https://api.openai.com/v1/chat/completions',
    modelName: string = 'gpt-4o-mini'
  ) {
    this.providerId = providerId;
    this.apiKey = apiKey;
    this.endpoint = endpoint;
    this.modelName = modelName;
  }

  public updateConfig(apiKey: string, endpoint?: string, modelName?: string) {
    this.apiKey = apiKey;
    if (endpoint) this.endpoint = endpoint;
    if (modelName) this.modelName = modelName;
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0 && this.endpoint);
  }

  async *generate(
    request: GenerationRequest,
    signal?: AbortSignal
  ): AsyncIterable<GenerationEvent> {
    if (!this.apiKey && !this.endpoint.includes('localhost')) {
      yield {
        id: request.id,
        kind: 'failed',
        error: `Chave de API não configurada para o provedor ${this.providerId}.`
      };
      return;
    }

    yield { id: request.id, kind: 'started' };

    try {
      const messages: Array<{ role: string; content: string }> = [];

      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt });
      }

      if (request.historyContext) {
        messages.push({
          role: 'system',
          content: `[HISTÓRICO RECENTE DA REUNIÃO]\n${request.historyContext}`
        });
      }

      messages.push({ role: 'user', content: request.prompt });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.modelName,
          messages,
          stream: true,
          temperature: 0.7
        }),
        signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        yield {
          id: request.id,
          kind: 'failed',
          error: `Erro na API ${this.providerId} (${response.status}): ${errorText}`
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
          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6);
            if (jsonStr === '[DONE]') continue;
            try {
              const data = JSON.parse(jsonStr);
              const textChunk = data.choices?.[0]?.delta?.content || '';
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
              // Ignorar erros parciais de JSON no stream
            }
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
