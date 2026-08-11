import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getDefaultDimensions,
  getDefaultStates,
  loadOpacity,
  loadWidgetDimensions,
  loadWidgetStates,
  saveOpacity,
  saveWidgetDimensions
} from '../widget-state';

describe('estado visual dos widgets', () => {
  const values = new Map<string, string>();

  beforeEach(() => {
    values.clear();
    vi.stubGlobal('window', { innerWidth: 1280, innerHeight: 1000 });
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    });
  });

  it('limita as dimensões restauradas aos valores permitidos', () => {
    values.set('copilotWidgetDimensions', JSON.stringify({
      response: { width: 900, height: 1200 },
      transcription: { width: 100, height: 80 }
    }));

    const dimensions = loadWidgetDimensions();

    expect(dimensions.response).toEqual({ width: 700, height: 900 });
    expect(dimensions.transcription).toEqual({ width: 280, height: 200 });
  });

  it('persiste as dimensões dos widgets', () => {
    const dimensions = getDefaultDimensions();
    dimensions.response = { width: 560, height: 480 };

    saveWidgetDimensions(dimensions);

    expect(JSON.parse(values.get('copilotWidgetDimensions') || '{}').response).toEqual({
      width: 560,
      height: 480
    });
  });

  it('restaura e persiste a opacidade', () => {
    saveOpacity(0.65);

    expect(values.get('copilotOpacity')).toBe('0.65');
    expect(loadOpacity()).toBe(0.65);
  });

  it('usa a opacidade padrão quando o valor armazenado é inválido', () => {
    values.set('copilotOpacity', '0.1');

    expect(loadOpacity()).toBe(0.95);
  });

  it('inicializa apenas a barra de funções visível', () => {
    expect(getDefaultStates()).toEqual({
      functionBar: { visible: true, minimized: false },
      status: { visible: false, minimized: false },
      response: { visible: false, minimized: false },
      transcription: { visible: false, minimized: false }
    });
  });

  it('ignora painéis visíveis persistidos de uma sessão anterior', () => {
    values.set('copilotWidgetStates', JSON.stringify({
      functionBar: { visible: false, minimized: true },
      status: { visible: true, minimized: true },
      response: { visible: true, minimized: true },
      transcription: { visible: true, minimized: true }
    }));

    expect(loadWidgetStates()).toEqual({
      functionBar: { visible: true, minimized: true },
      status: { visible: false, minimized: true },
      response: { visible: false, minimized: true },
      transcription: { visible: false, minimized: true }
    });
  });
});
