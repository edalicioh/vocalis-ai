import { describe, expect, it } from 'vitest';
import { createSessionId } from '../session-id.js';

describe('Identificador de sessão da captura', () => {
  it('deve incluir o instante da criação e um sufixo aleatório', () => {
    expect(createSessionId(123456, 0.5)).toMatch(/^session-tab-123456-[a-z0-9]+$/);
  });

  it('deve gerar identificadores diferentes para novas capturas', () => {
    const first = createSessionId(123456, 0.5);
    const second = createSessionId(123457, 0.6);

    expect(second).not.toBe(first);
  });
});
