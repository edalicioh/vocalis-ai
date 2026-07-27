import { AnswerProvider, AnswerInput, AnswerEvent } from './answer-provider.js';

export class OllamaProvider implements AnswerProvider {
  private endpoint: string = 'http://localhost:11434';
  private model: string = 'llama3';

  public setEndpoint(endpoint: string) {
    this.endpoint = endpoint ? endpoint.replace(/\/$/, '') : 'http://localhost:11434';
  }

  public setModel(model: string) {
    this.model = model || 'llama3';
  }

  public isConfigured(): boolean {
    return Boolean(this.endpoint && this.endpoint.trim().length > 0);
  }

  public async *generate(input: AnswerInput): AsyncIterable<AnswerEvent> {
    const { requestId, question, prompt, signal } = input;

    if (!this.isConfigured()) {
      yield {
        type: 'answer.failed',
        data: { id: requestId, error: 'Endpoint do Ollama não configurado' }
      };
      return;
    }

    yield {
      type: 'answer.started',
      data: { id: requestId, question, responseMode: input.responseMode }
    };

    try {
      const url = `${this.endpoint}/api/generate`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: true
        }),
        signal
      });

      if (!response.ok) {
        throw new Error(`Ollama API error (${response.status}): ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Falha ao obter leitor do fluxo do Ollama');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        if (signal?.aborted) {
          yield { type: 'answer.cancelled', data: { id: requestId, reason: 'Abortado pelo usuário' } };
          return;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) {
            try {
              const json = JSON.parse(trimmed);
              if (json.response) {
                yield { type: 'answer.delta', data: { id: requestId, chunk: json.response } };
              }
            } catch {
              // Ignorar linhas parciais
            }
          }
        }
      }

      yield {
        type: 'answer.completed',
        data: {
          id: requestId,
          structured: {
            questionSummary: question,
            opening: '',
            answer: '',
            keyPoints: []
          }
        }
      };
    } catch (err: any) {
      if (signal?.aborted) {
        yield { type: 'answer.cancelled', data: { id: requestId, reason: 'Abortado pelo usuário' } };
      } else {
        yield { type: 'answer.failed', data: { id: requestId, error: err.message || 'Erro Ollama Local' } };
      }
    }
  }

  public async cancel(requestId: string): Promise<void> {}
}
