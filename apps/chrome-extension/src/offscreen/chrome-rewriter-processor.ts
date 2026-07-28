export type RewriteStyle = 'shorten' | 'formal' | 'technical' | 'expand';

export class ChromeRewriterProcessor {
  /**
   * Reescreve um texto utilizando a Rewriter API ou a Prompt API (fallback) do Gemini Nano no Chrome
   */
  public async rewriteText(text: string, style: RewriteStyle): Promise<{ rewrittenText: string; success: boolean }> {
    if (!text || !text.trim()) {
      return { rewrittenText: text, success: false };
    }

    const win = (typeof window !== 'undefined' ? (window as any) : null) || (typeof globalThis !== 'undefined' ? (globalThis as any) : null);
    const ai = win?.ai || (win?.window && win.window.ai);
    if (!ai) {
      return { rewrittenText: text, success: false };
    }

    // 1. Tenta a Rewriter API / Writer API nativa do Chrome se disponível
    try {
      if (ai.rewriter && typeof ai.rewriter.create === 'function') {
        const toneMap: Record<RewriteStyle, string> = {
          shorten: 'more-concise',
          formal: 'more-formal',
          technical: 'more-formal',
          expand: 'as-is'
        };
        const rewriter = await ai.rewriter.create({
          tone: toneMap[style] || 'as-is'
        });
        const result = await rewriter.rewrite(text);
        if (typeof rewriter.destroy === 'function') {
          rewriter.destroy();
        }
        if (result && result.trim()) {
          return { rewrittenText: result.trim(), success: true };
        }
      }
    } catch (err) {
      console.warn('[ChromeRewriterProcessor] Rewriter API indisponível, usando fallback para Prompt API:', err);
    }

    // 2. Fallback para a Prompt API local (window.ai.languageModel) no Gemini Nano
    try {
      if (ai.languageModel && typeof ai.languageModel.create === 'function') {
        const promptsMap: Record<RewriteStyle, string> = {
          shorten: 'Reescreva a resposta a seguir para ser extremamente concisa e direta (máximo 25 palavras):',
          formal: 'Reescreva a resposta a seguir em tom altamente corporativo, profissional e formal:',
          technical: 'Reescreva a resposta a seguir enfatizando termos técnicos, padrões de projeto e arquitetura de software:',
          expand: 'Reescreva a resposta a seguir adicionando detalhes explicativos, exemplos práticos e contexto:'
        };

        const session = await ai.languageModel.create({
          systemPrompt: 'Você é um assistente especialista em reescrita e refinamento de texto para entrevistas técnicas. Retorne APENAS o texto reescrito sem introduções ou explicações adicionais.'
        });

        const prompt = `${promptsMap[style] || promptsMap.shorten}\n\n"${text}"`;
        const result = await session.prompt(prompt);

        if (typeof session.destroy === 'function') {
          session.destroy();
        }

        if (result && result.trim()) {
          return { rewrittenText: result.trim(), success: true };
        }
      }
    } catch (err) {
      console.warn('[ChromeRewriterProcessor] Erro no fallback para Prompt API:', err);
    }

    return { rewrittenText: text, success: false };
  }
}
