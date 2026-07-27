import { QuestionDetectionResult } from '@conversation-copilot/shared-types';

/**
 * Detector de perguntas com limiares progressivos (RF-006 / RF-007).
 * 
 * Avalia padrões interrogativos em Português e Inglês,
 * duração da pausa e outros sinais para produzir uma
 * pontuação de confiança com razões detalhadas.
 * 
 * Não utiliza LLM local para evitar aumento de latência (seção 14).
 */
export class QuestionDetector {
  // ========= Limiares de pausa progressivos (RF-006) =========
  static readonly PAUSE_SHORT_MS = 400;        // início de monitoramento
  static readonly PAUSE_PROBABLE_MS = 700;     // pré-carregamento possível
  static readonly PAUSE_CONFIRMED_MS = 1000;   // final confirmado (mín.)
  static readonly PAUSE_MAX_CONFIRMED_MS = 1300; // final confirmado (máx.)

  // ========= Padrões interrogativos =========
  private static readonly PT_PATTERNS: Array<{ pattern: RegExp; weight: number; label: string }> = [
    { pattern: /\?/, weight: 0.35, label: 'pontuação interrogativa' },
    { pattern: /\b(como|o que|qual|quais|porque|por que|por quê|onde|quando|quem|quanto|quanta|quantos|quantas)\b/i, weight: 0.30, label: 'expressão interrogativa' },
    { pattern: /\b(pode|poderia|consegue|saberia)\s+(explicar|descrever|falar|dar um exemplo|mostrar|contar|detalhar)\b/i, weight: 0.25, label: 'pedido de explicação' },
    { pattern: /\b(me fale|conte-me|conte uma situação|descreva|explique|exemplifique|me explique|me conte)\b/i, weight: 0.25, label: 'pedido de narrativa' },
    { pattern: /\b(como você faria|como resolveria|como lidaria|como abordaria|já trabalhou com)\b/i, weight: 0.30, label: 'cenário hipotético' },
    { pattern: /\b(qual a diferença|pode dar um exemplo|pode explicar)\b/i, weight: 0.25, label: 'pedido de comparação/exemplo' }
  ];

  private static readonly EN_PATTERNS: Array<{ pattern: RegExp; weight: number; label: string }> = [
    { pattern: /\?/, weight: 0.35, label: 'question mark' },
    { pattern: /\b(what|how|why|where|when|who|which)\b/i, weight: 0.30, label: 'interrogative expression' },
    { pattern: /\b(can you|could you|would you|tell me|explain|describe|walk me through)\b/i, weight: 0.25, label: 'request for explanation' },
    { pattern: /\b(have you ever|did you|do you|are you)\b/i, weight: 0.20, label: 'experience question' }
  ];

  /**
   * Avalia se o texto transcrito é uma pergunta e retorna o resultado detalhado.
   * 
   * @param text - Texto da transcrição final
   * @param pauseDurationMs - Duração da pausa após a fala (ms)
   * @param isFinal - Se a transcrição é final (não parcial)
   * @returns Resultado da detecção com score e razões
   */
  public static detect(
    text: string,
    pauseDurationMs: number = 0,
    isFinal: boolean = true
  ): QuestionDetectionResult {
    if (!text || text.trim().length < 5) {
      return { isQuestion: false, score: 0, reasons: [], questionText: '' };
    }

    const cleanText = text.trim();
    let score = 0;
    const reasons: string[] = [];

    // 1. Avalia padrões interrogativos (PT + EN)
    const allPatterns = [...this.PT_PATTERNS, ...this.EN_PATTERNS];
    for (const { pattern, weight, label } of allPatterns) {
      if (pattern.test(cleanText)) {
        score += weight;
        reasons.push(label);
      }
    }

    // 2. Avalia duração da pausa (RF-006)
    if (pauseDurationMs >= this.PAUSE_CONFIRMED_MS) {
      score += 0.15;
      reasons.push('pausa longa confirmada');
    } else if (pauseDurationMs >= this.PAUSE_PROBABLE_MS) {
      score += 0.08;
      reasons.push('pausa provável');
    }

    // 3. Avalia comprimento do texto (frases mais longas com padrões interrogativos são mais prováveis)
    if (cleanText.length > 30 && score > 0.2) {
      score += 0.05;
      reasons.push('frase substancial');
    }

    // 4. Penaliza transcrição parcial (RN-009)
    if (!isFinal) {
      score *= 0.6; // reduz confiança significativamente
      reasons.push('transcrição parcial (confiança reduzida)');
    }

    // Normaliza o score entre 0 e 1
    score = Math.min(1.0, Math.max(0, score));

    // Threshold para classificar como pergunta
    const isQuestion = score >= 0.35;

    return {
      isQuestion,
      score: Math.round(score * 100) / 100,
      reasons,
      questionText: cleanText
    };
  }

  /**
   * Método simplificado de compatibilidade (retorna boolean).
   * Usado para check rápido sem detalhes.
   */
  public static isQuestion(text: string): boolean {
    return this.detect(text).isQuestion;
  }

  /**
   * Verifica se a pausa está no estágio de pré-carregamento
   * (pode iniciar preparação, mas não disparar geração final).
   */
  public static isPrefetchReady(pauseDurationMs: number, score: number): boolean {
    return pauseDurationMs >= this.PAUSE_PROBABLE_MS && score >= 0.5;
  }

  /**
   * Verifica se a pausa confirma o final da fala
   * e deve disparar a geração de resposta.
   */
  public static isConfirmed(pauseDurationMs: number, score: number): boolean {
    // Alta confiança pode disparar mais cedo
    if (score >= 0.7 && pauseDurationMs >= this.PAUSE_PROBABLE_MS) {
      return true;
    }
    // Confiança normal requer pausa confirmada
    return pauseDurationMs >= this.PAUSE_CONFIRMED_MS && score >= 0.35;
  }
}
