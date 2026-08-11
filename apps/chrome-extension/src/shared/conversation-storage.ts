import { SavedConversation, StructuredAnswer, ConversationSummary } from '@conversation-copilot/shared-types';

const STORAGE_KEY = 'savedConversations';

/**
 * Serializa o snapshot estruturado do resumo (RF-018) em Markdown compacto
 * para armazenamento e exportação.
 */
export function serializeConversationSummary(summary: ConversationSummary): string {
  const lines: string[] = [];
  lines.push(`## 📝 Resumo da Conversa`);
  lines.push(``);
  lines.push(summary.summaryText || 'Sem resumo textual.');
  lines.push(``);

  if (summary.topics.length > 0) {
    lines.push(`**Temas:**`);
    summary.topics.forEach(t => lines.push(`- ${t}`));
    lines.push(``);
  }
  if (summary.decisions.length > 0) {
    lines.push(`**Decisões:**`);
    summary.decisions.forEach(d => lines.push(`- ${d}`));
    lines.push(``);
  }
  if (summary.actionItems.length > 0) {
    lines.push(`**Ações / Próximos Passos:**`);
    summary.actionItems.forEach(a => lines.push(`- [ ] ${a}`));
    lines.push(``);
  }
  if (summary.previousQuestions.length > 0) {
    lines.push(`**Perguntas:**`);
    summary.previousQuestions.forEach(q => lines.push(`- ${q}`));
    lines.push(``);
  }

  return lines.join('\n').trim();
}

/**
 * Salva ou atualiza uma reunião no banco local da extensão (chrome.storage.local).
 */
export async function saveConversation(conv: SavedConversation): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      if (!chrome?.storage?.local) {
        resolve();
        return;
      }

      chrome.storage.local.get([STORAGE_KEY], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        const existing: SavedConversation[] = result[STORAGE_KEY] || [];
        const index = existing.findIndex(item => item.id === conv.id);

        if (index >= 0) {
          existing[index] = conv;
        } else {
          existing.unshift(conv);
        }

        // Mantém até 50 reuniões salvas para não exceder limites de storage
        const trimmed = existing.slice(0, 50);

        chrome.storage.local.set({ [STORAGE_KEY]: trimmed }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Recupera todas as reuniões salvas no banco local da extensão.
 */
export async function getSavedConversations(): Promise<SavedConversation[]> {
  return new Promise((resolve) => {
    try {
      if (!chrome?.storage?.local) {
        resolve([]);
        return;
      }

      chrome.storage.local.get([STORAGE_KEY], (result) => {
        if (chrome.runtime.lastError) {
          resolve([]);
          return;
        }
        const list: SavedConversation[] = result[STORAGE_KEY] || [];
        // Ordena por data mais recente
        list.sort((a, b) => b.timestamp - a.timestamp);
        resolve(list);
      });
    } catch {
      resolve([]);
    }
  });
}

/**
 * Exclui uma reunião do banco local.
 */
export async function deleteConversation(id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      if (!chrome?.storage?.local) {
        resolve();
        return;
      }

      chrome.storage.local.get([STORAGE_KEY], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        const existing: SavedConversation[] = result[STORAGE_KEY] || [];
        const filtered = existing.filter(item => item.id !== id);

        chrome.storage.local.set({ [STORAGE_KEY]: filtered }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Vincula a chave do áudio gravado (sessionId) a uma reunião já salva,
 * permitindo exibir o botão de download mesmo quando a conversa foi
 * salva antes do encerramento da gravação.
 */
export async function patchConversationAudioKey(sessionId: string, audioKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      if (!chrome?.storage?.local) {
        resolve();
        return;
      }

      chrome.storage.local.get([STORAGE_KEY], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        const existing: SavedConversation[] = result[STORAGE_KEY] || [];
        const index = existing.findIndex(item => item.id === sessionId);

        if (index >= 0) {
          existing[index] = { ...existing[index], audioKey };
          chrome.storage.local.set({ [STORAGE_KEY]: existing }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        } else {
          resolve();
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Formata os dados da conversa em um documento Markdown (.md) estruturado.
 */
export function exportToMarkdown(conv: SavedConversation): string {
  const dateStr = new Date(conv.timestamp).toLocaleString('pt-BR');
  const lines: string[] = [];

  lines.push(`# 🎙️ Copiloto de Conversas — Histórico de Reunião`);
  lines.push(``);
  lines.push(`- **Título**: ${conv.title || 'Reunião Sem Título'}`);
  lines.push(`- **Página / URL**: ${conv.url || 'Não informado'}`);
  lines.push(`- **Data e Hora**: ${dateStr}`);
  lines.push(`- **Sessão ID**: \`${conv.id}\``);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);

  // Resumo da conversa (RF-018)
  if (conv.summary) {
    lines.push(conv.summary);
    lines.push(``);
    lines.push(`---`);
    lines.push(``);
  }

  // Transcrição
  lines.push(`## 💬 Transcrição ao Vivo`);
  lines.push(``);
  if (conv.transcriptions.length === 0) {
    lines.push(`*Nenhuma transcrição gravada nesta sessão.*`);
  } else {
    conv.transcriptions.forEach(u => {
      const speaker = u.speaker === 'interviewer' ? '🗣️ **Entrevistador**' : '👤 **Você**';
      const timeStr = u.timestamp ? new Date(u.timestamp).toLocaleTimeString('pt-BR') : '';
      lines.push(`${speaker} ${timeStr ? `*(${timeStr})*` : ''}: ${u.text}`);
    });
  }
  lines.push(``);
  lines.push(`---`);
  lines.push(``);

  // Sugestões da IA
  lines.push(`## 🤖 Perguntas Detectadas & Sugestões da IA`);
  lines.push(``);
  if (conv.suggestions.length === 0) {
    lines.push(`*Nenhuma pergunta ou sugestão registrada nesta sessão.*`);
  } else {
    conv.suggestions.forEach((sug, index) => {
      lines.push(`### Pergunta ${index + 1}: "${sug.question}"`);
      lines.push(``);

      const s = sug.structured as Partial<StructuredAnswer> | undefined;
      if (s?.opening) {
        lines.push(`**Frase de Abertura**: ${s.opening}`);
        lines.push(``);
      }

      const answerText = s?.answer || sug.rawText || '';
      if (answerText) {
        lines.push(`**Resposta Sugerida**:`);
        lines.push(answerText);
        lines.push(``);
      }

      if (s?.keyPoints && s.keyPoints.length > 0) {
        lines.push(`**Pontos-Chave**:`);
        s.keyPoints.forEach(kp => lines.push(`- ${kp}`));
        lines.push(``);
      }

      lines.push(`---\n`);
    });
  }

  return lines.join('\n');
}

/**
 * Dispara o download automático do arquivo Markdown (.md) no navegador.
 */
export function triggerMarkdownDownload(conv: SavedConversation, customMarkdown?: string): void {
  const markdownText = customMarkdown || exportToMarkdown(conv);
  const blob = new Blob([markdownText], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const d = new Date(conv.timestamp);
  const formattedDate = d.toISOString().slice(0, 10);
  const filename = customMarkdown
    ? `ata-reuniao-${formattedDate}-${conv.id.slice(-5)}.md`
    : `reuniao-copilot-${formattedDate}-${conv.id.slice(-5)}.md`;

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
