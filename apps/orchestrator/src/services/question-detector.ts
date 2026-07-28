import { QuestionDetectionResult, Utterance } from '@conversation-copilot/shared-types';

/**
 * Contexto opcional para detecção contextual de perguntas.
 * Permite que o detector use o histórico da conversa para
 * aumentar a confiança em perguntas implícitas ou complexas.
 */
export interface DetectionContext {
  /** Últimas falas da conversa (mais recentes por último) */
  recentUtterances: Utterance[];
  /** Texto acumulado de transcrições parciais anteriores */
  accumulatedPartials?: string;
}

/**
 * Detector de perguntas com limiares progressivos (RF-006 / RF-007).
 *
 * Avalia padrões interrogativos em Português e Inglês,
 * duração da pausa, contexto da conversa e outros sinais
 * para produzir uma pontuação de confiança com razões detalhadas.
 *
 * Não utiliza LLM local para evitar aumento de latência (seção 14).
 */
export class QuestionDetector {
  // ========= Limiares de pausa progressivos (RF-006) =========
  static readonly PAUSE_SHORT_MS = 400;        // início de monitoramento
  static readonly PAUSE_PROBABLE_MS = 700;     // pré-carregamento possível
  static readonly PAUSE_CONFIRMED_MS = 1000;   // final confirmado (mín.)
  static readonly PAUSE_MAX_CONFIRMED_MS = 1300; // final confirmado (máx.)

  // ========= Padrões interrogativos (Português) =========
  private static readonly PT_PATTERNS: Array<{ pattern: RegExp; weight: number; label: string }> = [
    // Pontuação e expressões interrogativas diretas
    { pattern: /\?/, weight: 0.35, label: 'pontuação interrogativa' },
    { pattern: /\b(como|o que|qual|quais|porque|por que|por quê|onde|quando|quem|quanto|quanta|quantos|quantas)\b/i, weight: 0.30, label: 'expressão interrogativa' },

    // Pedidos diretos de explicação/narrativa
    { pattern: /\b(pode|poderia|consegue|saberia)\s+(explicar|descrever|falar|dar um exemplo|mostrar|contar|detalhar)\b/i, weight: 0.25, label: 'pedido de explicação' },
    { pattern: /\b(me fale|conte-me|conte uma situação|descreva|explique|exemplifique|me explique|me conte)\b/i, weight: 0.25, label: 'pedido de narrativa' },

    // Cenários hipotéticos e comparações
    { pattern: /\b(como você faria|como resolveria|como lidaria|como abordaria|já trabalhou com)\b/i, weight: 0.30, label: 'cenário hipotético' },
    { pattern: /\b(qual a diferença|pode dar um exemplo|pode explicar)\b/i, weight: 0.25, label: 'pedido de comparação/exemplo' },

    // ===== Novos patterns: perguntas indiretas e implícitas =====
    // Consultas indiretas (curiosidade, desejo de saber)
    { pattern: /\b(gostaria de saber|queria saber|queria entender|gostaria de entender|gostaria de conhecer|queria conhecer)\b/i, weight: 0.25, label: 'consulta indireta' },
    { pattern: /\b(tenho curiosidade|fiquei curioso|me pergunto|penso sobre|gostaria de ouvir)\b/i, weight: 0.20, label: 'expressão de curiosidade' },

    // Falta de entendimento (implica pergunta implícita)
    { pattern: /\b(não?\s?(entendi|peguei|compreendi|fiquei claro)|pode repetir|pode explicar de novo|nao ficou claro|nao entendi)\b/i, weight: 0.30, label: 'falta de entendimento' },

    // Pedidos de opinião/visão
    { pattern: /\b(como você enxerga|qual sua opinião|o que você acha|na sua visão|qual sua visão|o que pensa sobre)\b/i, weight: 0.30, label: 'pedido de opinião' },

    // Pedidos de narrativa suave (mais informais)
    { pattern: /\b(me conta|me diz|pode me falar sobre|queria ouvir sobre|me ajude a entender|me dê um panorama|me fale mais sobre)\b/i, weight: 0.30, label: 'pedido de narrativa suave' },

    // Perguntas retóricas / confirmação de entendimento
    { pattern: /\b(faz sentido|está claro|entendeu|ficou claro|tem dúvida|alguma dúvida)\b/i, weight: 0.20, label: 'check de entendimento' },

    // Solicitações de aprofundamento
    { pattern: /\b(me dê mais detalhes|pode aprofundar|queria mais contexto|pode detalhar melhor|me mostre como)\b/i, weight: 0.25, label: 'pedido de aprofundamento' },

    // Perguntas comportamentais (entrevistas)
    { pattern: /\b(conta uma situação|me de um exemplo|conte sobre um momento|já enfrentou|já passou por)\b/i, weight: 0.25, label: 'pergunta comportamental' }
  ];

  // ========= Padrões interrogativos (Inglês) =========
  private static readonly EN_PATTERNS: Array<{ pattern: RegExp; weight: number; label: string }> = [
    { pattern: /\?/, weight: 0.35, label: 'question mark' },
    { pattern: /\b(what|how|why|where|when|who|which)\b/i, weight: 0.30, label: 'interrogative expression' },
    { pattern: /\b(can you|could you|would you|tell me|explain|describe|walk me through)\b/i, weight: 0.25, label: 'request for explanation' },
    { pattern: /\b(have you ever|did you|do you|are you)\b/i, weight: 0.20, label: 'experience question' },
    // Novos patterns EN
    { pattern: /\b(i'd like to know|i'm curious|i was wondering|would love to hear|i want to understand)\b/i, weight: 0.25, label: 'indirect inquiry' },
    { pattern: /\b(what's your take|what do you think|your opinion on|your thoughts on|how do you see)\b/i, weight: 0.25, label: 'opinion request' },
    { pattern: /\b(i didn't catch that|can you repeat|clarify|elaborate on|go deeper into)\b/i, weight: 0.25, label: 'clarification request' },
    { pattern: /\b(walk me through|talk me through|share an example|tell me about a time)\b/i, weight: 0.25, label: 'behavioral question' }
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
    return this.detectWithContext(text, pauseDurationMs, isFinal);
  }

  /**
   * Detecção de pergunta com contexto da conversa.
   *
   * Usa o histórico de falas para aumentar a confiança em perguntas
   * implícitas ou complexas, identificando padrões como:
   * - Sequência de perguntas do entrevistador
   * - Follow-up imediato após resposta curta do candidato
   * - Mudança de tópico que sugere nova pergunta
   *
   * @param text - Texto da transcrição
   * @param pauseDurationMs - Duração da pausa após a fala (ms)
   * @param isFinal - Se a transcrição é final (não parcial)
   * @param context - Contexto opcional com histórico e parciais acumuladas
   * @returns Resultado da detecção com score e razões
   */
  public static detectWithContext(
    text: string,
    pauseDurationMs: number = 0,
    isFinal: boolean = true,
    context?: DetectionContext
  ): QuestionDetectionResult {
    // Combina texto com parciais acumuladas se disponível
    const fullText = context?.accumulatedPartials
      ? `${context.accumulatedPartials.trim()} ${text}`.trim()
      : text;

    if (!fullText || fullText.trim().length < 5) {
      return { isQuestion: false, score: 0, reasons: [], questionText: fullText.trim() };
    }

    const cleanText = fullText.trim();
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

    // 4. Bônus contextuais (usa histórico da conversa)
    if (context && context.recentUtterances.length > 0) {
      const contextBonus = this.evaluateContextualSignals(context.recentUtterances, score);
      if (contextBonus.bonus > 0) {
        score += contextBonus.bonus;
        reasons.push(...contextBonus.reasons);
      }
    }

    // 5. Penaliza transcrição parcial (RN-009)
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
   * Avalia sinais contextuais do histórico da conversa
   * para aumentar a confiança na detecção de perguntas.
   */
  private static evaluateContextualSignals(
    recentUtterances: Utterance[],
    currentScore: number
  ): { bonus: number; reasons: string[] } {
    let bonus = 0;
    const reasons: string[] = [];

    if (recentUtterances.length < 2) {
      return { bonus, reasons };
    }

    // Pega as últimas 5 falas para análise contextual
    const recent = recentUtterances.slice(-5);
    const lastUtterance = recent[recent.length - 1];

    // Sinal 1: Padrão de entrevista (entrevistador pergunta, candidato responde, entrevistador pergunta)
    // Se há múltiplas falas do entrevistador no histórico recente, há padrão de entrevista
    const interviewerCount = recent.filter(u => u.speaker === 'interviewer').length;
    if (interviewerCount >= 2 && lastUtterance.speaker === 'interviewer' && currentScore > 0.15) {
      bonus += 0.05;
      reasons.push('sequência de perguntas do entrevistador');
    }

    // Sinal 2: Follow-up imediato após resposta do candidato
    // Se a fala anterior foi do candidato e a atual é do entrevistador,
    // é provável que seja um follow-up (pergunta)
    if (recent.length >= 2) {
      const prev = recent[recent.length - 2];
      if (prev.speaker === 'candidate' && lastUtterance.speaker === 'interviewer' && currentScore > 0.15) {
        bonus += 0.05;
        reasons.push('follow-up após resposta do candidato');
      }
    }

    // Sinal 3: Pergunta após resposta curta do candidato
    // Resposta muito curta do candidato pode indicar que o entrevistador
    // fará uma pergunta de aprofundamento
    if (recent.length >= 2) {
      const prev = recent[recent.length - 2];
      if (prev.speaker === 'candidate' && prev.text.length < 50 && lastUtterance.speaker === 'interviewer') {
        bonus += 0.03;
        reasons.push('possível aprofundamento após resposta curta');
      }
    }

    // Sinal 4: Score já alto + contexto = confiança extra
    if (currentScore >= 0.5 && recent.length >= 3) {
      bonus += 0.03;
      reasons.push('contexto conversacional reforça detecção');
    }

    return { bonus: Math.min(bonus, 0.15), reasons };
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
