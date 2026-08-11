import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CopilotOverlay } from './overlay';
import { createSessionId } from './session-id';
import { injectStyles } from './styles-injection';

const HOST_ID = 'conversation-copilot-host';
let currentTabSessionId = createSessionId();
let currentCaptureState = false;
const MEETING_DOMAINS = [
  'meet.google.com',
  'zoom.us',
  'teams.microsoft.com',
  'teams.live.com',
  'webex.com',
  'whereby.com'
];

function isMeetingPage(): boolean {
  const hostname = window.location.hostname;
  return MEETING_DOMAINS.some(domain => hostname === domain || hostname.endsWith('.' + domain));
}

let hostElement: HTMLDivElement | null = null;
let overlayRoot: Root | null = null;

function resetTabSessionId(): string {
  currentTabSessionId = createSessionId();
  return currentTabSessionId;
}

function updateCurrentSessionId(sessionId: string): void {
  currentTabSessionId = sessionId;
}

function renderOverlay(): void {
  if (!overlayRoot) return;

  overlayRoot.render(React.createElement(CopilotOverlay, {
    tabSessionId: currentTabSessionId,
    externalCaptureState: currentCaptureState,
    createTabSessionId: resetTabSessionId,
    onSessionIdChange: updateCurrentSessionId,
    onCaptureStateChange: (isCapturing: boolean) => {
      currentCaptureState = isCapturing;
    }
  }));
}

function mountOverlay() {
  if (document.getElementById(HOST_ID)) {
    if (hostElement) hostElement.style.display = 'block';
    return;
  }

  hostElement = document.createElement('div');
  hostElement.id = HOST_ID;
  document.body.appendChild(hostElement);

  const shadowRoot = hostElement.attachShadow({ mode: 'open' });
  injectStyles(shadowRoot);

  const mountPoint = document.createElement('div');
  shadowRoot.appendChild(mountPoint);

  overlayRoot = createRoot(mountPoint);
  renderOverlay();

  console.log('[Content Script] Copiloto de Conversas montado com sucesso via Shadow DOM.');
}

function unmountOverlay() {
  if (hostElement) {
    hostElement.style.display = 'none';
  }
}

function isExtensionValid(): boolean {
  try {
    return !!(chrome && chrome.runtime && chrome.runtime.id);
  } catch {
    return false;
  }
}

function checkAndApplyActivation() {
  if (!isExtensionValid()) return;
  const isMeeting = isMeetingPage();
  if (isMeeting) {
    mountOverlay();
    return;
  }

  // Se não for página de reunião, verifica se o usuário ativou manualmente para este domínio
  const host = window.location.hostname;
  try {
    chrome.storage.local.get(['enabledPages'], (result) => {
      if (chrome.runtime.lastError) return;
      const enabledPages: string[] = result?.enabledPages || [];
      if (enabledPages.includes(host)) {
        mountOverlay();
      } else {
        unmountOverlay();
      }
    });
  } catch {
    unmountOverlay();
  }
}

try {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!isExtensionValid()) return;
    if (msg?.type === 'HOTKEY_TRIGGER') {
      window.dispatchEvent(new CustomEvent('copilot:force-trigger'));
    } else if (msg?.type === 'CAPTURE_STATE_CHANGED') {
      if (typeof msg.sessionId === 'string' && msg.sessionId) {
        currentTabSessionId = msg.sessionId;
      }
      currentCaptureState = Boolean(msg.isCapturing);
      renderOverlay();
      sendResponse({ status: 'ok' });
    } else if (msg?.type === 'CREATE_COPILOT_SESSION') {
      const sessionId = resetTabSessionId();
      renderOverlay();
      sendResponse({ status: 'ok', sessionId });
    } else if (msg?.type === 'GET_COPILOT_SESSION') {
      sendResponse({ sessionId: currentTabSessionId });
    } else if (msg?.type === 'GET_PAGE_STATUS') {
      const isMeeting = isMeetingPage();
      const host = window.location.hostname;
      try {
        chrome.storage.local.get(['enabledPages'], (result) => {
          if (chrome.runtime.lastError) return;
          const enabledPages: string[] = result?.enabledPages || [];
          const isEnabledManually = enabledPages.includes(host);
          try {
            sendResponse({ isMeeting, isEnabledManually, isMounted: !!(hostElement && hostElement.style.display !== 'none') });
          } catch { /* ignore context invalidation */ }
        });
      } catch { /* ignore */ }
      return true; // async response
    } else if (msg?.type === 'TOGGLE_PAGE_COPILOT') {
      const host = window.location.hostname;
      try {
        chrome.storage.local.get(['enabledPages'], (result) => {
          if (chrome.runtime.lastError) return;
          let enabledPages: string[] = result?.enabledPages || [];
          if (enabledPages.includes(host)) {
            enabledPages = enabledPages.filter(h => h !== host);
            unmountOverlay();
          } else {
            enabledPages.push(host);
            mountOverlay();
          }
          chrome.storage.local.set({ enabledPages }, () => {
            if (chrome.runtime.lastError) return;
            try {
              sendResponse({ isMounted: !!(hostElement && hostElement.style.display !== 'none') });
            } catch { /* ignore context invalidation */ }
          });
        });
      } catch { /* ignore */ }
      return true; // async response
    }
  });
} catch {
  /* ignore context invalidation */
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkAndApplyActivation);
} else {
  checkAndApplyActivation();
}
