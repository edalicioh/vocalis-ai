import { describe, it, expect } from 'vitest';

/**
 * Utilitário de cálculo RMS em buffers Float32/Int16 (espelho da lógica do pcm-worklet.js)
 */
function calculateRms(samples: Float32Array): number {
  if (!samples || samples.length === 0) return 0;
  let sumSquare = 0;
  for (let i = 0; i < samples.length; i++) {
    sumSquare += samples[i] * samples[i];
  }
  return Math.sqrt(sumSquare / samples.length);
}

function evaluateVadState(rms: number, threshold: number): boolean {
  if (threshold === 0.0) return true;
  return rms >= threshold;
}

describe('VAD RMS Energy Gate & Threshold Evaluation', () => {
  it('deve calcular RMS igual a 0 para buffer contendo apenas silêncio', () => {
    const silenceBuffer = new Float32Array(4096).fill(0);
    const rms = calculateRms(silenceBuffer);
    expect(rms).toBe(0);
    expect(evaluateVadState(rms, 0.01)).toBe(false);
  });

  it('deve identificar fala ativa quando RMS excede o limiar configurado', () => {
    // Simula sinal de áudio senoidal com amplitude 0.05
    const audioBuffer = new Float32Array(4096);
    for (let i = 0; i < audioBuffer.length; i++) {
      audioBuffer[i] = 0.05 * Math.sin(i * 0.1);
    }

    const rms = calculateRms(audioBuffer);
    expect(rms).toBeGreaterThan(0.01);
    expect(evaluateVadState(rms, 0.01)).toBe(true);
  });

  it('deve descartar ruído fraco abaixo do limiar (ex: ruído com RMS 0.003 e limiar 0.01)', () => {
    const noiseBuffer = new Float32Array(4096);
    for (let i = 0; i < noiseBuffer.length; i++) {
      noiseBuffer[i] = (Math.random() - 0.5) * 0.005;
    }

    const rms = calculateRms(noiseBuffer);
    expect(rms).toBeLessThan(0.01);
    expect(evaluateVadState(rms, 0.01)).toBe(false);
  });

  it('deve transmitir 100% dos pacotes quando a sensibilidade estiver Desativada (rmsThreshold = 0.0)', () => {
    const silenceBuffer = new Float32Array(4096).fill(0);
    const rms = calculateRms(silenceBuffer);
    expect(evaluateVadState(rms, 0.0)).toBe(true);
  });
});
