import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChromeBuiltInAIProcessor } from '../chrome-ai-processor';

describe('ChromeBuiltInAIProcessor', () => {
  let processor: ChromeBuiltInAIProcessor;

  beforeEach(() => {
    // Limpa window.ai global se existir
    if (typeof globalThis !== 'undefined') {
      delete (globalThis as any).ai;
    }
  });

  afterEach(() => {
    if (processor) {
      processor.destroy();
    }
    if (typeof globalThis !== 'undefined') {
      delete (globalThis as any).ai;
    }
  });

  it('deve identificar status indisponível/unsupported quando window.ai não existe (Bypass Mode)', async () => {
    processor = new ChromeBuiltInAIProcessor();
    const status = await processor.initCapabilities();

    expect(status.available).toBe(false);
    expect(status.status).toBe('unsupported');
  });

  it('deve retornar o texto original inalterado no modo bypass sem disparar exceções', async () => {
    processor = new ChromeBuiltInAIProcessor();
    await processor.initCapabilities();

    const rawText = 'Como você faria o deploy no Larabel?';
    const result = await processor.correctUtterance(rawText);

    expect(result.text).toBe(rawText);
    expect(result.corrected).toBe(false);
  });

  it('deve processar a transcrição e indicar isBypass=true quando window.ai não estiver disponível', async () => {
    processor = new ChromeBuiltInAIProcessor();
    await processor.initCapabilities();

    const rawText = 'Explique a arquitetura do Redis cluster.';
    const payload = await processor.processTranscript(rawText);

    expect(payload.originalText).toBe(rawText);
    expect(payload.correctedText).toBe(rawText);
    expect(payload.isBypass).toBe(true);
  });

  it('deve usar a Prompt API quando window.ai.languageModel estiver pronta (Readily)', async () => {
    const mockPromptSession = {
      prompt: vi.fn().mockResolvedValue('Como você faria o deploy no Laravel?'),
      destroy: vi.fn()
    };

    (globalThis as any).ai = {
      languageModel: {
        capabilities: vi.fn().mockResolvedValue({ available: 'readily' }),
        create: vi.fn().mockResolvedValue(mockPromptSession)
      }
    };

    processor = new ChromeBuiltInAIProcessor();
    const status = await processor.initCapabilities();

    expect(status.available).toBe(true);
    expect(status.status).toBe('readily');

    const result = await processor.correctUtterance('Como você faria o deploy no Larabel?');

    expect(mockPromptSession.prompt).toHaveBeenCalled();
    expect(result.text).toBe('Como você faria o deploy no Laravel?');
    expect(result.corrected).toBe(true);
  });
});
