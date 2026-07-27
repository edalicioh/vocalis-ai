chrome.runtime.onInstalled.addListener(() => {
  console.log('Copiloto de Conversas instalado com sucesso.');
});

let creatingOffscreen: Promise<void> | null = null;

async function setupOffscreenDocument(path: string) {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [path]
  });

  if (existingContexts.length > 0) {
    return;
  }

  if (creatingOffscreen) {
    await creatingOffscreen;
  } else {
    creatingOffscreen = chrome.offscreen.createDocument({
      url: path,
      reasons: [chrome.offscreen.Reason.USER_MEDIA],
      justification: 'Captura de áudio da aba da reunião para transcrição local em tempo real.'
    });
    await creatingOffscreen;
    creatingOffscreen = null;
  }
}

/**
 * Remove o offscreen document para liberar recursos (RF-002).
 */
async function closeOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT]
  });

  if (existingContexts.length > 0) {
    await chrome.offscreen.closeDocument();
    console.log('[Service Worker] Offscreen document fechado.');
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_CAPTURE') {
    (async () => {
      try {
        let targetTabId = message.tabId || sender.tab?.id;
        if (!targetTabId) {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          targetTabId = activeTab?.id;
        }

        const streamId = await new Promise<string>((resolve, reject) => {
          chrome.tabCapture.getMediaStreamId({ targetTabId }, (id) => {
            if (chrome.runtime.lastError) {
              // Tenta sem targetTabId (compatibilidade com activeTab)
              chrome.tabCapture.getMediaStreamId({}, (idFallback) => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  resolve(idFallback);
                }
              });
            } else {
              resolve(id);
            }
          });
        });

        const offscreenUrl = chrome.runtime.getURL('src/offscreen/offscreen.html');
        await setupOffscreenDocument(offscreenUrl);

        chrome.runtime.sendMessage({
          type: 'INIT_AUDIO_CAPTURE',
          streamId,
          sessionId: message.sessionId
        });

        sendResponse({ status: 'ok' });
      } catch (err: any) {
        if (err.message && err.message.includes('active stream')) {
          console.log('[Service Worker] A captura de áudio já está ativa nesta aba.');
          sendResponse({ status: 'ok', active: true });
        } else if (err.message && err.message.includes('not been invoked')) {
          console.warn('[Service Worker] Para capturar o áudio desta aba, clique no ícone do Copiloto na barra do Chrome para ativar a permissão.');
          sendResponse({ status: 'need_invocation', error: 'Clique no ícone da extensão na barra do Chrome para ativar a captura nesta aba.' });
        } else {
          console.error('[Service Worker] Erro na captura de áudio:', err.message);
          sendResponse({ status: 'error', error: err.message });
        }
      }
    })();
    return true; // async
  }

  // RF-002: Encerramento de sessão — libera todos os recursos
  if (message.type === 'STOP_CAPTURE') {
    (async () => {
      try {
        // 1. Para a captura de áudio no offscreen
        chrome.runtime.sendMessage({ type: 'STOP_AUDIO_CAPTURE' });

        // 2. Fecha o offscreen document para liberar recursos
        await closeOffscreenDocument();

        sendResponse({ status: 'ok' });
      } catch (err: any) {
        console.error('Erro ao parar captura:', err);
        sendResponse({ status: 'error', error: err.message });
      }
    })();
    return true; // async
  }
});

// Atalho Alt+S para forçar sugestão
chrome.commands.onCommand.addListener((command) => {
  if (command === 'trigger_suggestion') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'HOTKEY_TRIGGER' });
      }
    });
  }
});
