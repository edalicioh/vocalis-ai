import { describe, it, expect, vi } from 'vitest';
import { AnswerProviderManager } from '../provider-manager.js';
import { GeminiProvider } from '../gemini.js';
import { OpenAIProvider } from '../openai.js';
import { AnthropicProvider } from '../anthropic.js';
import { OllamaProvider } from '../ollama.js';
import { CustomProxyProvider } from '../custom-proxy.js';

describe('Listagem Dinâmica de Modelos por Provedor', () => {
  it('GeminiProvider: deve listar modelos de fallback e filtrar resposta da API', async () => {
    const gemini = new GeminiProvider();
    const fallback = await gemini.listModels();
    expect(fallback).toContain('gemini-2.5-flash');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          { name: 'models/gemini-1.5-flash' },
          { name: 'models/gemini-1.5-pro' },
          { name: 'models/embedding-001' }
        ]
      })
    }));

    const apiModels = await gemini.listModels('key-test');
    vi.unstubAllGlobals();

    expect(apiModels).toEqual(['gemini-1.5-flash', 'gemini-1.5-pro']);
  });

  it('OpenAIProvider: deve consultar endpoint /v1/models', async () => {
    const openai = new OpenAIProvider();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }, { id: 'whisper-1' }]
      })
    }));

    const models = await openai.listModels('sk-test');
    vi.unstubAllGlobals();

    expect(models).toEqual(['gpt-4o', 'gpt-4o-mini']);
  });

  it('OllamaProvider: deve consultar endpoint /api/tags local', async () => {
    const ollama = new OllamaProvider();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [{ name: 'llama3:latest' }, { name: 'codestral:latest' }]
      })
    }));

    const models = await ollama.listModels(undefined, 'http://localhost:11434');
    vi.unstubAllGlobals();

    expect(models).toEqual(['llama3:latest', 'codestral:latest']);
  });

  it('AnswerProviderManager: deve invocar fetchAvailableModels para qualquer provedor', async () => {
    const manager = new AnswerProviderManager();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'deepseek-chat' }, { id: 'deepseek-coder' }]
      })
    }));

    const models = await manager.fetchAvailableModels('custom_proxy', 'sk-test', 'https://api.deepseek.com');
    vi.unstubAllGlobals();

    expect(models).toEqual(['deepseek-chat', 'deepseek-coder']);
  });
});
