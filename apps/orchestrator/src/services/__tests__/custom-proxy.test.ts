import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CustomProxyProvider } from '../custom-proxy.js';

describe('CustomProxyProvider (Proxy LLM Agnóstico)', () => {
  let provider: CustomProxyProvider;

  beforeEach(() => {
    provider = new CustomProxyProvider();
  });

  it('deve inicializar com valores padrão válidos e estado configurado', () => {
    expect(provider.isConfigured()).toBe(true);
    expect(provider.getEndpoint()).toContain('chat/completions');
    expect(provider.getModel()).toBe('deepseek-chat');
  });

  it('deve normalizar endpoints atribuídos adicionando /v1/chat/completions se necessário', () => {
    provider.setEndpoint('https://api.groq.com/openai');
    expect(provider.getEndpoint()).toBe('https://api.groq.com/openai/v1/chat/completions');

    provider.setEndpoint('https://openrouter.ai/api/v1');
    expect(provider.getEndpoint()).toBe('https://openrouter.ai/api/v1/chat/completions');
  });

  it('deve emitir falha caso o endpoint esteja vazio', async () => {
    provider.setEndpoint('');
    // Força endpoint string vazia
    (provider as any).endpoint = '';

    expect(provider.isConfigured()).toBe(false);

    const events = [];
    for await (const event of provider.generate({
      requestId: 'req-1',
      question: 'Teste?',
      prompt: 'Prompt',
      responseMode: 'short'
    })) {
      events.push(event);
    }

    expect(events.length).toBe(1);
    expect(events[0].type).toBe('answer.failed');
  });

  it('deve processar o fluxo SSE de respostas parciais (answer.delta)', async () => {
    provider.setEndpoint('https://mock-proxy.ai/v1/chat/completions');
    provider.setApiKey('sk-custom-test-key');
    provider.setModel('llama-3.3-70b');

    // Mock do fetch global do Node/Vitest
    const mockSseStream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Resposta "}}]}\n\n'));
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"do Proxy Agnóstico."}}]}\n\n'));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: mockSseStream
    }));

    const events = [];
    for await (const event of provider.generate({
      requestId: 'req-2',
      question: 'Como funciona o proxy?',
      prompt: 'Explique o proxy.',
      responseMode: 'short'
    })) {
      events.push(event);
    }

    vi.unstubAllGlobals();

    expect(events.some(e => e.type === 'answer.started')).toBe(true);
    expect(events.some(e => e.type === 'answer.delta' && e.data.chunk === 'Resposta ')).toBe(true);
    expect(events.some(e => e.type === 'answer.delta' && e.data.chunk === 'do Proxy Agnóstico.')).toBe(true);
    expect(events.some(e => e.type === 'answer.completed')).toBe(true);
  });
});
