chrome.runtime.onInstalled.addListener(() => {
  console.log('Copiloto de Conversas instalado com sucesso.');
});

let creatingOffscreen: Promise<void> | null = null;
let captureTransition: Promise<void> = Promise.resolve();
const tabSessions = new Map<number, string>();
const capturingTabs = new Set<number>();
const TAB_SESSION_PREFIX = 'copilotTabSession:';
const CAPTURE_STATE_PREFIX = 'copilotCaptureState:';

function serializeCaptureTransition<T>(operation: () => Promise<T>): Promise<T> {
  const result = captureTransition.then(operation, operation);
  captureTransition = result.then(() => undefined, () => undefined);
  return result;
}

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
 * Envia mensagem ao offscreen de forma segura, suprimindo erro quando o
 * documento ainda não registrou listeners ou já foi encerrado.
 */
function sendMessageSafe(msg: Record<string, unknown>): Promise<void> {
  return chrome.runtime.sendMessage(msg).catch(() => {
    // Ignora: offscreen document pode não existir ou não ter listener registrado
  });
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

async function hasCaptureState(tabId: number): Promise<boolean> {
  const key = `${CAPTURE_STATE_PREFIX}${tabId}`;
  const stored = await chrome.storage.session.get(key);
  return capturingTabs.has(tabId) || stored[key] === true;
}

async function stopCaptureForTab(tabId?: number): Promise<{ audioKey: string | null; audioAvailable: boolean }> {
  const noAudio: { audioKey: string | null; audioAvailable: boolean } = { audioKey: null, audioAvailable: false };
  let audioResult = noAudio;

  try {
    const res = await chrome.runtime.sendMessage({ type: 'STOP_AUDIO_CAPTURE' }) as
      { audioKey?: string | null; audioAvailable?: boolean } | undefined;
    if (res && res.audioKey) {
      audioResult = { audioKey: res.audioKey, audioAvailable: res.audioAvailable === true };
    }
  } catch (err) {
    // Offscreen document pode não existir (captura nunca iniciada nesta sessão)
  }

  await closeOffscreenDocument();

  if (tabId) {
    capturingTabs.delete(tabId);
    await chrome.storage.session.remove(`${CAPTURE_STATE_PREFIX}${tabId}`);
  }
  return audioResult;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'AUDIO_VAD_STATE' && message.sessionId) {
    const targetTab = [...tabSessions.entries()]
      .find(([, sessionId]) => sessionId === message.sessionId)?.[0];
    if (targetTab) {
      chrome.tabs.sendMessage(targetTab, message).catch(() => {});
    }
    return;
  }

  if (message.type === 'REGISTER_TAB_SESSION' && sender.tab?.id && message.sessionId) {
    const activeSessionId = tabSessions.get(sender.tab.id);
    if (capturingTabs.has(sender.tab.id) && activeSessionId && activeSessionId !== message.sessionId) {
      sendResponse({ status: 'error', error: 'A aba já possui outra sessão de captura ativa.' });
      return;
    }
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

      sendResponse({ isCapturing: await hasCaptureState(targetTabId) });
    })();
    return true;
  }

  if (message.type === 'START_CAPTURE') {
    serializeCaptureTransition(async () => {
      let targetTabId: number | undefined;
      let previousSessionId: string | undefined;
      try {
        targetTabId = message.tabId || sender.tab?.id;
        if (!targetTabId) {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          targetTabId = activeTab?.id;
        }

        if (!targetTabId) {
          throw new Error('Não foi possível identificar a aba para captura.');
        }

        previousSessionId = await getTabSession(targetTabId);
        if (await hasCaptureState(targetTabId)) {
          sendResponse({ status: 'ok', active: true, sessionId: previousSessionId });
          return;
        }

        const sessionId = message.sessionId;
        if (!sessionId) {
          throw new Error('Não foi possível criar uma nova sessão para esta captura.');
        }

        const streamId = await getTabMediaStreamId(targetTabId);

        const offscreenUrl = chrome.runtime.getURL('src/offscreen/offscreen.html');
        await setupOffscreenDocument(offscreenUrl);
        const storedAudioSettings = await chrome.storage.local.get(['rmsThreshold', 'recordFullAudio']);
        const enableRecording = storedAudioSettings.recordFullAudio === true;

        tabSessions.set(targetTabId, sessionId);
        await chrome.storage.session.set({ [`${TAB_SESSION_PREFIX}${targetTabId}`]: sessionId });

        await sendMessageSafe({
          type: 'INIT_AUDIO_CAPTURE',
          streamId,
          sessionId,
          rmsThreshold: typeof storedAudioSettings.rmsThreshold === 'number'
            ? storedAudioSettings.rmsThreshold
            : 0.01,
          enableRecording
        });

        capturingTabs.add(targetTabId);
        await chrome.storage.session.set({ [`${CAPTURE_STATE_PREFIX}${targetTabId}`]: true });
        sendResponse({ status: 'ok', sessionId, audioRecordingEnabled: enableRecording });
      } catch (err: any) {
        if (targetTabId) {
          if (previousSessionId) {
            tabSessions.set(targetTabId, previousSessionId);
            await chrome.storage.session.set({ [`${TAB_SESSION_PREFIX}${targetTabId}`]: previousSessionId });
          } else {
            tabSessions.delete(targetTabId);
            await chrome.storage.session.remove(`${TAB_SESSION_PREFIX}${targetTabId}`);
          }
        }
        if (err.message && err.message.includes('active stream')) {
          console.log('[Service Worker] A captura de áudio já está ativa nesta aba.');
          sendResponse({ status: 'ok', active: true, sessionId: previousSessionId });
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
    }).catch(err => console.error('[Service Worker] Falha na transição de início:', err));
    return true; // async
  }

  // RF-002: Encerramento de sessão — libera todos os recursos
  if (message.type === 'STOP_CAPTURE') {
    serializeCaptureTransition(async () => {
      try {
        let targetTabId = message.tabId || sender.tab?.id;
        if (!targetTabId) {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          targetTabId = activeTab?.id;
        }

        const { audioKey, audioAvailable } = await stopCaptureForTab(targetTabId);
        sendResponse({ status: 'ok', audioKey, audioAvailable });
      } catch (err: any) {
        console.error('Erro ao parar captura:', err);
        sendResponse({ status: 'error', error: err.message });
      }
    }).catch(err => console.error('[Service Worker] Falha na transição de parada:', err));
    return true; // async
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== 'loading') return;

  void hasCaptureState(tabId)
    .then(isCapturing => isCapturing
      ? serializeCaptureTransition(() => stopCaptureForTab(tabId))
      : undefined)
    .catch(err => console.error('[Service Worker] Erro ao encerrar captura durante recarga:', err));
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
