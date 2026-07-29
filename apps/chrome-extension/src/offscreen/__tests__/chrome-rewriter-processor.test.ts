import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChromeRewriterProcessor } from '../chrome-rewriter-processor';

describe('ChromeRewriterProcessor', () => {
  let processor: ChromeRewriterProcessor;

  beforeEach(() => {
    processor = new ChromeRewriterProcessor();
    delete (globalThis as any).window;
  });

  afterEach(() => {
    delete (globalThis as any).window;
    delete (globalThis as any).ai;
  });

  it('deve retornar texto inalterado se window.ai não estiver disponível', async () => {
    const raw = 'Para escalar o Laravel, podemos usar cache no Redis e filas com Horizon.';
    const res = await processor.rewriteText(raw, 'shorten');
    expect(res.rewrittenText).toBe(raw);
    expect(res.success).toBe(false);
  });

  it('deve usar a Rewriter API quando window.ai.rewriter estiver disponível', async () => {
    const mockRewrite = vi.fn().mockResolvedValue('Escalamos Laravel usando Redis e Horizon.');
    const mockDestroy = vi.fn();

    (globalThis as any).window = {
      ai: {
        rewriter: {
          create: vi.fn().mockResolvedValue({
            rewrite: mockRewrite,
            destroy: mockDestroy
          })
        }
      }
    };

    const raw = 'Para escalar o Laravel, podemos usar cache no Redis e filas com Horizon.';
    const res = await processor.rewriteText(raw, 'shorten');

    expect(res.rewrittenText).toBe('Escalamos Laravel usando Redis e Horizon.');
    expect(res.success).toBe(true);
    expect(mockDestroy).toHaveBeenCalled();
  });

  it('deve fazer fallback para a Prompt API se a Rewriter API falhar', async () => {
    const mockPrompt = vi.fn().mockResolvedValue('Laravel escala com Redis em cache e Horizon em filas.');
    const mockDestroy = vi.fn();

    (globalThis as any).window = {
      ai: {
        rewriter: {
          create: vi.fn().mockRejectedValue(new Error('Rewriter API indisponível'))
        },
        languageModel: {
          capabilities: vi.fn().mockResolvedValue({ available: 'readily' }),
          create: vi.fn().mockResolvedValue({
            prompt: mockPrompt,
            destroy: mockDestroy
          })
        }
      }
    };

    const raw = 'Para escalar o Laravel, podemos usar cache no Redis e filas com Horizon.';
    const res = await processor.rewriteText(raw, 'formal');

    expect(res.rewrittenText).toBe('Laravel escala com Redis em cache e Horizon em filas.');
    expect(res.success).toBe(true);
    expect(mockPrompt).toHaveBeenCalled();
    expect(mockDestroy).toHaveBeenCalled();
  });

  it('deve retornar texto inalterado se Prompt API existir mas modelo não estiver pronto', async () => {
    (globalThis as any).window = {
      ai: {
        rewriter: {
          create: vi.fn().mockRejectedValue(new Error('Rewriter API indisponível'))
        },
        languageModel: {
          capabilities: vi.fn().mockResolvedValue({ available: 'after-download' }),
          create: vi.fn()
        }
      }
    };

    const raw = 'Texto de teste para reescrita.';
    const res = await processor.rewriteText(raw, 'shorten');

    expect(res.rewrittenText).toBe(raw);
    expect(res.success).toBe(false);
    // Não deve tentar criar sessão quando modelo não está pronto
    expect((globalThis as any).window.ai.languageModel.create).not.toHaveBeenCalled();
  });

  it('deve destruir sessão via finally mesmo quando prompt falha', async () => {
    const mockDestroy = vi.fn();

    (globalThis as any).window = {
      ai: {
        languageModel: {
          capabilities: vi.fn().mockResolvedValue({ available: 'readily' }),
          create: vi.fn().mockResolvedValue({
            prompt: vi.fn().mockRejectedValue(new Error('Prompt falhou')),
            destroy: mockDestroy
          })
        }
      }
    };

    const raw = 'Texto que vai falhar no prompt.';
    const res = await processor.rewriteText(raw, 'technical');

    expect(res.rewrittenText).toBe(raw);
    expect(res.success).toBe(false);
    expect(mockDestroy).toHaveBeenCalled();
  });
});
