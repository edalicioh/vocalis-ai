import { ContextManager } from './context-manager.js';
import { GeminiProvider } from './gemini.js';

export interface MeetingSummaryResult {
  executiveSummary: string;
  decisions: string[];
  actionItems: string[];
  formattedMarkdown: string;
}

export class MeetingSummaryService {
  /**
   * Gera a ata completa em Markdown estruturado ao final da reunião.
   */
  public static async generateSummary(
    cm: ContextManager,
    geminiProvider: GeminiProvider
  ): Promise<string> {
    const recentUtterances = cm.getRecentUtterances();
    if (recentUtterances.length === 0) {
      return this.buildFallbackSummary(cm);
    }

    const fullDialogue = recentUtterances
      .map(u => `[${u.speaker === 'interviewer' ? 'ENTREVISTADOR/REUNIÃO' : 'FALA'}]: ${u.text}`)
      .join('\n');

    const prompt = `
Você é um secretário técnico altamente qualificado.
Analise a transcrição da reunião/entrevista abaixo e gere uma ata estruturada em Português do Brasil (pt-BR).

=== REGRAS DE FORMATO ===
Gere EXATAMENTE o documento Markdown com as seguintes seções:

## 📌 Resumo Executivo
(Uma síntese objetiva de 2 a 4 parágrafos sobre o tema principal e discussões)

## 🤝 Decisões Tomadas
(Lista de decisões alinhadas durante a conversa, em marcadores "- ")

## ✅ Action Items (Tarefas & Próximos Passos)
(Lista de tarefas identificadas ou compromissos assumidos, em marcadores "- [ ] ")

=== TRANSCRIÇÃO DA REUNIÃO ===
${fullDialogue}
`.trim();

    try {
      if (!geminiProvider.isConfigured()) {
        return this.buildFallbackSummary(cm);
      }

      let generatedMarkdown = '';
      const stream = geminiProvider.generate({
        requestId: `summary-${Date.now()}`,
        question: 'resumo da reunião',
        prompt,
        responseMode: 'full',
        userProfile: cm.getUserProfile(),
        jobDescription: cm.getJobDescription()
      });

      for await (const event of stream) {
        if (event.type === 'answer.delta') {
          generatedMarkdown += event.data.chunk;
        }
      }

      if (!generatedMarkdown.trim()) {
        return this.buildFallbackSummary(cm);
      }

      return `${generatedMarkdown.trim()}\n\n---\n\n## 💬 Transcrição Completa\n\n${fullDialogue}`;
    } catch {
      return this.buildFallbackSummary(cm);
    }
  }

  private static buildFallbackSummary(cm: ContextManager): string {
    const recentUtterances = cm.getRecentUtterances();
    const fullDialogue = recentUtterances.length > 0
      ? recentUtterances.map(u => `[${u.speaker}]: ${u.text}`).join('\n')
      : 'Nenhuma fala registrada.';

    return `
# Ata de Reunião — Copiloto de Conversas

## 📌 Resumo Executivo
Sessão encerrada. O acompanhamento em tempo real capturou o diálogo da reunião.

## 🤝 Decisões Tomadas
- Sessão de áudio finalizada pelo usuário.

## ✅ Action Items (Tarefas & Próximos Passos)
- [ ] Revisar transcrição e sugestões contextuais no painel.

---

## 💬 Transcrição Completa

${fullDialogue}
`.trim();
  }
}
