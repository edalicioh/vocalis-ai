import React from 'react';
import { createRoot } from 'react-dom/client';
import { CopilotOverlay } from './overlay';
import { injectStyles } from './styles-injection';

const HOST_ID = 'conversation-copilot-host';
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

  const root = createRoot(mountPoint);
  root.render(React.createElement(CopilotOverlay));

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
