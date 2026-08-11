export type WidgetId = 'functionBar' | 'response' | 'transcription' | 'status';

export interface WidgetPosition {
  x: number;
  y: number;
}

export interface WidgetDimensions {
  width: number;
  height: number;
}

export interface WidgetState {
  visible: boolean;
  minimized: boolean;
}

export type WidgetPositionsMap = Record<WidgetId, WidgetPosition>;
export type WidgetDimensionsMap = Record<WidgetId, WidgetDimensions>;
export type WidgetStatesMap = Record<WidgetId, WidgetState>;
export type HUDLayoutMode = 'default' | 'compact' | 'reading' | 'keywords';

const POSITIONS_KEY = 'copilotWidgetPositions';
const DIMENSIONS_KEY = 'copilotWidgetDimensions';
const STATES_KEY = 'copilotWidgetStates';
const LAYOUT_MODE_KEY = 'copilotHUDLayoutMode';
const OPACITY_KEY = 'copilotOpacity';

export function getDefaultPositions(): WidgetPositionsMap {
  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

  return {
    functionBar: {
      x: Math.max(16, Math.floor(screenWidth / 2 - 160)),
      y: Math.max(16, screenHeight - 70)
    },
    response: {
      x: Math.max(16, Math.floor(screenWidth / 2 - 210)),
      y: Math.max(16, screenHeight - 480)
    },
    transcription: {
      x: Math.max(16, screenWidth - 380),
      y: Math.max(100, screenHeight - 260)
    },
    status: {
      x: Math.max(16, Math.floor(screenWidth / 2 - 80)),
      y: 16
    }
  };
}

export function getDefaultDimensions(): WidgetDimensionsMap {
  return {
    functionBar: { width: 360, height: 44 },
    response: { width: 420, height: 420 },
    transcription: { width: 350, height: 240 },
    status: { width: 210, height: 110 }
  };
}

export function getDefaultStates(): WidgetStatesMap {
  return {
    functionBar: { visible: true, minimized: false },
    status: { visible: false, minimized: false },
    response: { visible: false, minimized: false },
    transcription: { visible: false, minimized: false }
  };
}

export function loadWidgetPositions(): WidgetPositionsMap {
  try {
    const raw = localStorage.getItem(POSITIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const defaults = getDefaultPositions();
      return {
        status: parsed.status || defaults.status,
        response: parsed.response || defaults.response,
        functionBar: parsed.functionBar || defaults.functionBar,
        transcription: parsed.transcription || defaults.transcription
      };
    }
  } catch {
    /* fallback */
  }
  return getDefaultPositions();
}

export function saveWidgetPositions(positions: WidgetPositionsMap): void {
  try {
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
  } catch {
    /* ignore */
  }
}

export function loadWidgetDimensions(): WidgetDimensionsMap {
  const defaults = getDefaultDimensions();

  try {
    const raw = localStorage.getItem(DIMENSIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const clamp = (value: WidgetDimensions | undefined, fallback: WidgetDimensions): WidgetDimensions => ({
        width: Math.min(700, Math.max(280, Number(value?.width) || fallback.width)),
        height: Math.min(window.innerHeight * 0.9, Math.max(200, Number(value?.height) || fallback.height))
      });

      return {
        functionBar: parsed.functionBar || defaults.functionBar,
        response: clamp(parsed.response, defaults.response),
        transcription: clamp(parsed.transcription, defaults.transcription),
        status: parsed.status || defaults.status
      };
    }
  } catch {
    /* fallback */
  }

  return defaults;
}

export function saveWidgetDimensions(dimensions: WidgetDimensionsMap): void {
  try {
    localStorage.setItem(DIMENSIONS_KEY, JSON.stringify(dimensions));
  } catch {
    /* ignore */
  }
}

export function loadWidgetStates(): WidgetStatesMap {
  try {
    const raw = localStorage.getItem(STATES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const defaults = getDefaultStates();
      return {
        status: { ...defaults.status, ...parsed.status, visible: false },
        response: { ...defaults.response, ...parsed.response, visible: false },
        functionBar: { ...defaults.functionBar, ...parsed.functionBar, visible: true },
        transcription: { ...defaults.transcription, ...parsed.transcription, visible: false }
      };
    }
  } catch {
    /* fallback */
  }
  return getDefaultStates();
}

export function saveWidgetStates(states: WidgetStatesMap): void {
  try {
    localStorage.setItem(STATES_KEY, JSON.stringify(states));
  } catch {
    /* ignore */
  }
}

export function loadHUDLayoutMode(): HUDLayoutMode {
  try {
    const raw = localStorage.getItem(LAYOUT_MODE_KEY);
    if (raw === 'compact' || raw === 'reading' || raw === 'keywords') return raw;
  } catch {
    /* ignore */
  }
  return 'default';
}

export function saveHUDLayoutMode(mode: HUDLayoutMode): void {
  try {
    localStorage.setItem(LAYOUT_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function loadOpacity(): number {
  try {
    const value = Number(localStorage.getItem(OPACITY_KEY));
    if (Number.isFinite(value) && value >= 0.3 && value <= 1) return value;
  } catch {
    /* fallback */
  }
  return 0.95;
}

export function saveOpacity(opacity: number): void {
  try {
    localStorage.setItem(OPACITY_KEY, String(opacity));
  } catch {
    /* ignore */
  }
}
