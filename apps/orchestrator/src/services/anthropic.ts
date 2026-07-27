import { AnswerProvider, AnswerInput, AnswerEvent } from './answer-provider.js';

export class AnthropicProvider implements AnswerProvider {
  private apiKey: string = '';
  private model: string = 'claude-3-5-sonnet-20241022';

  public setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  public setModel(model: string) {
    this.model = model;
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  public async *generate(input: AnswerInput): AsyncIterable<AnswerEvent> {
    const { requestId, question, prompt, signal } = input;

    if (!this.isConfigured()) {
      yield {
        type: 'answer.failed',
        data: { id: requestId, error: 'Chave da API Anthropic não configurada' }
      };
      return;
    }

    yield {
      type: 'answer.started',
      data: { id: requestId, question, responseMode: input.responseMode }
    };

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1024,
          messages: [
            { role: 'user', content: prompt }
          ],
          stream: true
        }),
        signal
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Falha ao obter leitor do fluxo da Anthropic');
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
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.substring(6);
            try {
              const json = JSON.parse(dataStr);
              if (json.type === 'content_block_delta' && json.delta?.text) {
                yield { type: 'answer.delta', data: { id: requestId, chunk: json.delta.text } };
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
        yield { type: 'answer.failed', data: { id: requestId, error: err.message || 'Erro Anthropic' } };
      }
    }
  }

  public async cancel(requestId: string): Promise<void> {}
}
