// ============================================================
// Provedor Google Gemini (Chrome Extension)
// ============================================================

import { LlmProvider, GenerationRequest, GenerationEvent } from './provider.interface.js';

export class GeminiProvider implements LlmProvider {
  readonly providerId = 'gemini';
  private apiKey: string;
  private modelName: string;

  constructor(apiKey: string = '', modelName: string = 'gemini-2.5-flash') {
    this.apiKey = apiKey;
    this.modelName = modelName;
  }

  public updateConfig(apiKey: string, modelName?: string) {
    this.apiKey = apiKey;
    if (modelName) this.modelName = modelName;
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async *generate(
    request: GenerationRequest,
    signal?: AbortSignal
  ): AsyncIterable<GenerationEvent> {
    if (!this.apiKey) {
      yield {
        id: request.id,
        kind: 'failed',
        error: 'Chave de API do Gemini não configurada nas opções.'
      };
      return;
    }

    yield { id: request.id, kind: 'started' };

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        this.modelName
      )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(this.apiKey)}`;

      const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

      if (request.systemPrompt) {
        contents.push({
          role: 'user',
          parts: [{ text: `[INSTRUÇÕES DO SISTEMA]\n${request.systemPrompt}\n[FIM DAS INSTRUÇÕES]` }]
        });
        contents.push({
          role: 'model',
          parts: [{ text: 'Compreendido. Seguirei estritamente as instruções fornecidas.' }]
        });
      }

      if (request.historyContext) {
        contents.push({
          role: 'user',
          parts: [{ text: `[HISTÓRICO RECENTE]\n${request.historyContext}` }]
        });
        contents.push({
          role: 'model',
          parts: [{ text: 'Histórico assimilado.' }]
        });
      }

      contents.push({
        role: 'user',
        parts: [{ text: request.prompt }]
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ contents }),
        signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        yield {
          id: request.id,
          kind: 'failed',
          error: `Erro na API Gemini (${response.status}): ${errorText}`
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
              const textChunk = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
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
