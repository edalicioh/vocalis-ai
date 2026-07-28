chrome.runtime.onInstalled.addListener(() => {
  console.log('Copiloto de Conversas instalado com sucesso.');
});

let creatingOffscreen: Promise<void> | null = null;
const tabSessions = new Map<number, string>();
const capturingTabs = new Set<number>();
const TAB_SESSION_PREFIX = 'copilotTabSession:';
const CAPTURE_STATE_PREFIX = 'copilotCaptureState:';

async function getTabSession(tabId: number): Promise<string | undefined> {
  const cached = tabSessions.get(tabId);
  if (cached) return cached;

  const key = `${TAB_SESSION_PREFIX}${tabId}`;
  const stored = await chrome.storage.session.get(key);
  const sessionId = stored[key] as string | undefined;
  if (sessionId) tabSessions.set(tabId, sessionId);
  return sessionId;
}

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

function getTabMediaStreamId(targetTabId: number): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId }, (id) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(id);
      }
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'REGISTER_TAB_SESSION' && sender.tab?.id && message.sessionId) {
    tabSessions.set(sender.tab.id, message.sessionId);
    chrome.storage.session.set({ [`${TAB_SESSION_PREFIX}${sender.tab.id}`]: message.sessionId });
    sendResponse({ status: 'ok' });
    return;
  }

  if (message.type === 'GET_CAPTURE_STATE') {
    (async () => {
      const targetTabId = message.tabId || sender.tab?.id;
      if (!targetTabId) {
        sendResponse({ isCapturing: false });
        return;
      }

      const key = `${CAPTURE_STATE_PREFIX}${targetTabId}`;
      const stored = await chrome.storage.session.get(key);
      sendResponse({ isCapturing: capturingTabs.has(targetTabId) || stored[key] === true });
    })();
    return true;
  }

  if (message.type === 'START_CAPTURE') {
    (async () => {
      try {
        let targetTabId = message.tabId || sender.tab?.id;
        if (!targetTabId) {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          targetTabId = activeTab?.id;
        }

        if (!targetTabId) {
          throw new Error('Não foi possível identificar a aba para captura.');
        }

        const sessionId = message.sessionId || await getTabSession(targetTabId);
        if (!sessionId) {
          throw new Error('A sessão do Copiloto ainda não está disponível nesta aba. Atualize a página e tente novamente.');
        }

        const streamId = await getTabMediaStreamId(targetTabId);

        const offscreenUrl = chrome.runtime.getURL('src/offscreen/offscreen.html');
        await setupOffscreenDocument(offscreenUrl);

        chrome.runtime.sendMessage({
          type: 'INIT_AUDIO_CAPTURE',
          streamId,
          sessionId
        });

        capturingTabs.add(targetTabId);
        await chrome.storage.session.set({ [`${CAPTURE_STATE_PREFIX}${targetTabId}`]: true });
        sendResponse({ status: 'ok' });
      } catch (err: any) {
        if (err.message && err.message.includes('active stream')) {
          console.log('[Service Worker] A captura de áudio já está ativa nesta aba.');
          sendResponse({ status: 'ok', active: true });
        } else if (err.message && err.message.includes('not been invoked')) {
          sendResponse({
            status: 'need_invocation',
            error: 'Abra o popup da extensão para autorizar a captura nesta aba.'
          });
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
        let targetTabId = message.tabId || sender.tab?.id;
        if (!targetTabId) {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          targetTabId = activeTab?.id;
        }

        // 1. Para a captura de áudio no offscreen
        chrome.runtime.sendMessage({ type: 'STOP_AUDIO_CAPTURE' });

        // 2. Fecha o offscreen document para liberar recursos
        await closeOffscreenDocument();

        if (targetTabId) {
          capturingTabs.delete(targetTabId);
          await chrome.storage.session.remove(`${CAPTURE_STATE_PREFIX}${targetTabId}`);
        }
        sendResponse({ status: 'ok' });
      } catch (err: any) {
        console.error('Erro ao parar captura:', err);
        sendResponse({ status: 'error', error: err.message });
      }
    })();
    return true; // async
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabSessions.delete(tabId);
  capturingTabs.delete(tabId);
  chrome.storage.session.remove([
    `${TAB_SESSION_PREFIX}${tabId}`,
    `${CAPTURE_STATE_PREFIX}${tabId}`
  ]);
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
