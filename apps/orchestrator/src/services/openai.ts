import { AnswerProvider, AnswerInput, AnswerEvent } from './answer-provider.js';

export class OpenAIProvider implements AnswerProvider {
  private apiKey: string = '';
  private model: string = 'gpt-4o-mini';

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
        data: { id: requestId, error: 'Chave da API OpenAI não configurada' }
      };
      return;
    }

    yield {
      type: 'answer.started',
      data: { id: requestId, question, responseMode: input.responseMode }
    };

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: 'Você é um assistente técnico em entrevistas de emprego. Responda em Português do Brasil.' },
            { role: 'user', content: prompt }
          ],
          stream: true
        }),
        signal
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Falha ao obter leitor do fluxo da OpenAI');
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
            if (dataStr === '[DONE]') break;
            try {
              const json = JSON.parse(dataStr);
              const deltaContent = json.choices?.[0]?.delta?.content || '';
              if (deltaContent) {
                yield { type: 'answer.delta', data: { id: requestId, chunk: deltaContent } };
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
        yield { type: 'answer.failed', data: { id: requestId, error: err.message || 'Erro OpenAI' } };
      }
    }
  }

  public async cancel(requestId: string): Promise<void> {}
}
