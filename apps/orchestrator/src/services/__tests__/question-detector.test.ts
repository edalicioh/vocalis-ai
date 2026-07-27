import { describe, it, expect } from 'vitest';
import { QuestionDetector } from '../question-detector.js';

describe('QuestionDetector', () => {
  it('deve identificar frases com pontuação interrogativa (?)', () => {
    const result = QuestionDetector.detect('Como funciona a arquitetura de microserviços?');
    expect(result.isQuestion).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.35);
    expect(result.reasons).toContain('pontuação interrogativa');
  });

  it('deve identificar frases com termos interrogativos em Português sem ponto', () => {
    const result = QuestionDetector.detect('como você resolveria um problema de memory leak em Nodejs');
    expect(result.isQuestion).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.35);
    expect(result.reasons).toContain('expressão interrogativa');
  });

  it('deve identificar pedidos de explicação ou narrativa', () => {
    const result = QuestionDetector.detect('me explique como funciona a arquitetura de microserviços?');
    expect(result.isQuestion).toBe(true);
    expect(result.reasons).toContain('pedido de narrativa');
  });

  it('deve identificar perguntas em Inglês', () => {
    const result = QuestionDetector.detect('Can you explain how React virtual DOM works under the hood?');
    expect(result.isQuestion).toBe(true);
    expect(result.reasons).toContain('question mark');
  });

  it('não deve classificar afirmações simples como perguntas', () => {
    const result = QuestionDetector.detect('Eu trabalhei três anos utilizando Node.js e Docker em ambiente AWS.');
    expect(result.isQuestion).toBe(false);
    expect(result.score).toBeLessThan(0.35);
  });

  it('deve retornar falso para textos muito curtos', () => {
    const result = QuestionDetector.detect('Sim');
    expect(result.isQuestion).toBe(false);
    expect(result.score).toBe(0);
  });

  it('deve reduzir a confiança de transcrições parciais (não finais)', () => {
    const finalResult = QuestionDetector.detect('Qual a diferença entre Threads e Processos?', 1000, true);
    const partialResult = QuestionDetector.detect('Qual a diferença entre Threads e Processos?', 1000, false);

    expect(partialResult.score).toBeLessThan(finalResult.score);
    expect(partialResult.reasons).toContain('transcrição parcial (confiança reduzida)');
  });
});
