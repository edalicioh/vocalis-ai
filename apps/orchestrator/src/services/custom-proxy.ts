import { AnswerProvider, AnswerInput, AnswerEvent } from './answer-provider.js';

/**
 * Provedor LLM Proxy Agnóstico / API Customizada.
 * Suporta qualquer gateway ou servidor de IA compatível com a especificação
 * de API Chat Completions da OpenAI (ex: DeepSeek, Groq, OpenRouter, Mistral, LM Studio, vLLM).
 */
export class CustomProxyProvider implements AnswerProvider {
  private endpoint: string = 'https://api.deepseek.com/v1/chat/completions';
  private apiKey: string = '';
  private model: string = 'deepseek-chat';

  public setEndpoint(endpoint: string) {
    let trimmed = endpoint.trim();
    if (trimmed && !trimmed.endsWith('/chat/completions')) {
      trimmed = trimmed.replace(/\/+$/, '') + '/v1/chat/completions';
      // Ajusta se já tiver /v1
      trimmed = trimmed.replace(/\/v1\/v1\//, '/v1/');
    }
    this.endpoint = trimmed || 'https://api.deepseek.com/v1/chat/completions';
  }

  public setApiKey(apiKey: string) {
    this.apiKey = apiKey.trim();
  }

  public setModel(model: string) {
    this.model = model.trim() || 'deepseek-chat';
  }

  public getEndpoint(): string {
    return this.endpoint;
  }

  public getModel(): string {
    return this.model;
  }

  public isConfigured(): boolean {
    return Boolean(this.endpoint && this.endpoint.trim().length > 0);
  }

  public async listModels(apiKey?: string, endpoint?: string): Promise<string[]> {
    const key = apiKey || this.apiKey;
    let base = (endpoint || this.endpoint).trim();
    if (base.endsWith('/chat/completions')) {
      base = base.replace(/\/chat\/completions$/, '/models');
    } else if (!base.endsWith('/models')) {
      base = base.replace(/\/+$/, '') + '/v1/models';
    }

    try {
      const headers: Record<string, string> = {};
      if (key) headers['Authorization'] = `Bearer ${key}`;

      const res = await fetch(base, { headers });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const json = await res.json();
      const models: string[] = (json.data || json.models || []).map((m: any) => m.id || m.name).filter(Boolean);
      return models.length > 0 ? models : ['deepseek-chat', 'llama-3.3-70b-versatile'];
    } catch {
      return ['deepseek-chat', 'llama-3.3-70b-versatile'];
    }
  }

  public async *generate(input: AnswerInput): AsyncIterable<AnswerEvent> {
    const { requestId, question, prompt, signal } = input;

    if (!this.isConfigured()) {
      yield {
        type: 'answer.failed',
        data: { id: requestId, error: 'Endpoint do Proxy LLM Customizado não configurado' }
      };
      return;
    }

    yield {
      type: 'answer.started',
      data: { id: requestId, question, responseMode: input.responseMode }
    };

    try {
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
        throw new Error(`Proxy LLM Error (${response.status}): ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Falha ao obter leitor do fluxo de dados do Proxy LLM');
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
              const deltaContent = json.choices?.[0]?.delta?.content || json.choices?.[0]?.text || '';
              if (deltaContent) {
                yield { type: 'answer.delta', data: { id: requestId, chunk: deltaContent } };
              }
            } catch {
              // Ignorar linhas de fragmento JSON parcial
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
        yield { type: 'answer.failed', data: { id: requestId, error: err.message || 'Erro no Proxy LLM Customizado' } };
      }
    }
  }

  public async cancel(_requestId: string): Promise<void> {}
}
