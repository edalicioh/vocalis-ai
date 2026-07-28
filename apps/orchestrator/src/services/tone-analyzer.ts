import { ConversationTone, Utterance } from '@conversation-copilot/shared-types';
import { AnswerProvider, AnswerInput } from './answer-provider.js';
import { ContextManager } from './context-manager.js';

/**
 * Resultado da análise de tom da conversa.
 */
export interface ToneAnalysisResult {
  tone: ConversationTone;
  confidence: number;
  summary: string;
}

/**
 * Analisador de tom emocional da conversa (temperatura).
 *
 * Utiliza análise híbrida:
 * 1. Heurística rápida (sem LLM) — contagem de sinais léxicos e estruturais
 * 2. LLM em background (a cada N falas) — classificação semântica
 *
 * O resultado é armazenado no ContextManager e broadcast para a extensão.
 */
export class ToneAnalyzer {

  // ========= Termos de referência por tom =========

  private static readonly TONE_SIGNALS: Record<ConversationTone, {
    positive: RegExp[];
    negative: RegExp[];
    structural: (utterances: Utterance[]) => number;
  }> = {
    amigável: {
      positive: [
        /\b(obrigad[oa]|por favor|com certeza|ótimo|excelente|legal|bacana|show|beleza|blz|valeu|abraço|bom dia|boa tarde|boa noite)\b/i,
        /\b(haha|hehe|kkk|rsrs|😊|😄|👍)\b/i
      ],
      negative: [
        /\b(péssimo|horrível|não aceito|inaceitável|ruim|lixo)\b/i
      ],
      structural: (u) => {
        const avgLen = u.reduce((sum, x) => sum + x.text.length, 0) / u.length;
        return avgLen > 40 ? 0.1 : 0;
      }
    },
    tenso: {
      positive: [
        /\b(por favor|com urgência|preciso agora|não posso esperar|mais uma vez|não entendi|repita|repete)\b/i
      ],
      negative: [
        /\b(não|nunca|impossível|errado|incorreto|problema|erro|falha|bug|crash)\b/i,
        /\.{3,}/,
        /!{2,}/
      ],
      structural: (u) => {
        const shortAnswers = u.filter(x => x.speaker === 'candidate' && x.text.length < 30).length;
        return shortAnswers >= 3 ? 0.15 : 0;
      }
    },
    disperso: {
      positive: [
        /\b(mas|however|então|enfim|ah sim|ah tá|ok|certo|beleza)\b/i
      ],
      negative: [],
      structural: (u) => {
        const topicChanges = this.countTopicChanges(u);
        return topicChanges >= 3 ? 0.2 : 0;
      }
    },
    interessado: {
      positive: [
        /\b(interessante|curioso|legal|bacana|adorei|gostei|muito bom|incrível|surpreendente)\b/i,
        /\b(conta mais|me explica|como assim|por que|pode detalhar|quero saber)\b/i
      ],
      negative: [],
      structural: (u) => {
        const questions = u.filter(x => x.text.includes('?')).length;
        return questions >= 4 ? 0.15 : 0;
      }
    },
    confuso: {
      positive: [
        /\b(não entendi|não ficou claro|como assim|pode explicar|repita|repete|não peguei|não entendi bem|não ficou claro)\b/i,
        /\b(não sei|tô perdido|estou perdido|não faço ideia|não tenho certeza|acho que)\b/i
      ],
      negative: [],
      structural: (u) => {
        const repetitions = this.countRepetitions(u);
        return repetitions >= 2 ? 0.2 : 0;
      }
    },
    formal: {
      positive: [
        /\b(por gentileza|senhor|senhora|com licença|se não me engano|a mim parece|gostaria de)\b/i,
        /\b(senhor[es]?|doutor[a]?|professor[a]?)\b/i
      ],
      negative: [
        /\b(cara|mano|véi|pô|caraio|porra|foda)\b/i,
        /\b(kkk|rsrs|hehe)\b/i
      ],
      structural: (u) => {
        const avgLen = u.reduce((sum, x) => sum + x.text.length, 0) / u.length;
        return avgLen > 60 ? 0.1 : 0;
      }
    },
    neutro: {
      positive: [],
      negative: [],
      structural: () => 0
    }
  };

  /**
   * Analisa o tom usando heurística rápida (sem LLM).
   * Retorna a classificação e confiança baseada em sinais léxicos e estruturais.
   */
  public static analyzeHeuristic(utterances: Utterance[]): ToneAnalysisResult {
    if (utterances.length === 0) {
      return { tone: 'neutro', confidence: 0.3, summary: 'Conversa não iniciada.' };
    }

    const scores: Partial<Record<ConversationTone, number>> = {};

    for (const [tone, signals] of Object.entries(this.TONE_SIGNALS) as Array<[ConversationTone, typeof this.TONE_SIGNALS[ConversationTone]]>) {
      if (tone === 'neutro') continue;

      let score = 0;

      // Pontuação por sinais positivos
      for (const pattern of signals.positive) {
        const matches = utterances.filter(u => pattern.test(u.text)).length;
        score += matches * 0.1;
      }

      // Pontuação por sinais negativos
      for (const pattern of signals.negative) {
        const matches = utterances.filter(u => pattern.test(u.text)).length;
        score -= matches * 0.1;
      }

      // Pontuação estrutural
      score += signals.structural(utterances);

      scores[tone] = Math.max(0, score);
    }

    // Encontra o tom com maior pontuação
    let bestTone: ConversationTone = 'neutro';
    let bestScore = 0.15; // mínimo para sair do neutro

    for (const [tone, score] of Object.entries(scores) as Array<[ConversationTone, number]>) {
      if (score > bestScore) {
        bestScore = score;
        bestTone = tone;
      }
    }

    const confidence = Math.min(0.85, bestScore + 0.3);

    const summary = this.generateHeuristicSummary(bestTone, utterances);

    return {
      tone: bestTone,
      confidence: Math.round(confidence * 100) / 100,
      summary
    };
  }

  /**
   * Analisa o tom usando LLM (chamada assíncrona).
   * Usado quando heurística não é suficiente ou para refinar.
   */
  public static async analyzeWithLLM(
    cm: ContextManager,
    answerProvider: AnswerProvider
  ): Promise<ToneAnalysisResult | null> {
    if (!answerProvider.isConfigured()) {
      return null;
    }

    const prompt = cm.buildToneAnalysisPrompt();

    try {
      const input: AnswerInput = {
        requestId: `tone-${Date.now()}`,
        question: 'análise de tom',
        prompt,
        responseMode: 'short'
      };

      let responseText = '';
      for await (const event of answerProvider.generate(input)) {
        if (event.type === 'answer.delta') {
          responseText += (event.data as any).chunk || '';
        }
      }

      // Parseia a resposta JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const validTones: ConversationTone[] = ['neutro', 'amigável', 'tenso', 'disperso', 'interessado', 'confuso', 'formal'];
        const tone = validTones.includes(parsed.tone) ? parsed.tone : 'neutro';
        const confidence = typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5;
        const summary = typeof parsed.summary === 'string' ? parsed.summary : 'Tom não classificado.';

        return { tone, confidence, summary };
      }
    } catch {
      // Erro silencioso — fallback para heurística
    }

    return null;
  }

  /**
   * Gera resumo descritivo baseado no tom detectado por heurística.
   */
  private static generateHeuristicSummary(tone: ConversationTone, utterances: Utterance[]): string {
    const totalUtterances = utterances.length;
    const interviewerUtterances = utterances.filter(u => u.speaker === 'interviewer').length;
    const candidateUtterances = utterances.filter(u => u.speaker === 'candidate').length;
    const avgLength = Math.round(utterances.reduce((sum, u) => sum + u.text.length, 0) / totalUtterances);

    const base = `Conversa com ${totalUtterances} falas (${interviewerUtterances} entrevistador, ${candidateUtterances} candidato), média de ${avgLength} caracteres.`;

    const summaries: Record<ConversationTone, string> = {
      neutro: `${base} Tom neutro e equilibrado.`,
      amigável: `${base} Tom cordial e descontraído.`,
      tenso: `${base} Possível tensão — respostas curtas ou pressão.`,
      disperso: `${base} Possível dispersão — múltiplos tópicos.`,
      interessado: `${base} Engajamento alto — muitas perguntas e detalhes.`,
      confuso: `${base} Possível confusão — pedidos de esclarecimento.`,
      formal: `${base} Tom formal e profissional.`
    };

    return summaries[tone] || base;
  }

  /**
   * Conta mudanças de tópico aproximadas (baseado em marcadores de transição).
   */
  private static countTopicChanges(utterances: Utterance[]): number {
    const transitionPatterns = /\b(mas|however|então|enfim|sobre|voltando|outra coisa|ah sim|a propósito)\b/i;
    let count = 0;
    for (const u of utterances) {
      if (transitionPatterns.test(u.text)) count++;
    }
    return count;
  }

  /**
   * Conta repetições suspeitas (mesma frase ou palavras-chave repetidas).
   */
  private static countRepetitions(utterances: Utterance[]): number {
    const texts = utterances.map(u => u.text.toLowerCase());
    let count = 0;

    for (let i = 1; i < texts.length; i++) {
      // Verifica se há palavras significativas repetidas consecutivas
      const words = texts[i].split(/\s+/).filter(w => w.length > 4);
      const prevWords = texts[i - 1].split(/\s+/).filter(w => w.length > 4);
      const overlap = words.filter(w => prevWords.includes(w)).length;
      if (overlap >= 2) count++;
    }

    return count;
  }
}
