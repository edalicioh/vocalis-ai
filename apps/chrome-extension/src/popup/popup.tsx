import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { SettingsForm } from '../shared/settings-form';

const PopupSettings: React.FC = () => {
  const [pageStatus, setPageStatus] = useState<{ isMeeting: boolean; isEnabledManually: boolean; isMounted: boolean } | null>(null);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturePending, setCapturePending] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab?.id) {
        setActiveTabId(tab.id);
        chrome.runtime.sendMessage({ type: 'GET_CAPTURE_STATE', tabId: tab.id }, (captureState) => {
          if (!chrome.runtime.lastError) {
            setIsCapturing(Boolean(captureState?.isCapturing));
          }
        });
        chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_STATUS' }, (res) => {
          if (chrome.runtime.lastError) {
            // Ignora se a aba for restrita (chrome://) ou se o script ainda não tiver respondido
            return;
          }
          if (res) {
            setPageStatus(res);
          }
        });
      }
    });
  }, []);

  const notifyCaptureState = (isActive: boolean, sessionId?: string) => {
    if (!activeTabId) return;
    chrome.tabs.sendMessage(
      activeTabId,
      { type: 'CAPTURE_STATE_CHANGED', isCapturing: isActive, sessionId },
      () => void chrome.runtime.lastError
    );
  };

  const updatePageStatus = (isMounted: boolean) => {
    setPageStatus(prev => prev ? {
      ...prev,
      isMounted,
      isEnabledManually: prev.isMeeting ? prev.isEnabledManually : isMounted
    } : null);
  };

  const togglePageActivation = (callback: (isMounted: boolean) => void) => {
    if (!activeTabId) return;
    chrome.tabs.sendMessage(activeTabId, { type: 'TOGGLE_PAGE_COPILOT' }, (response) => {
      if (chrome.runtime.lastError) {
        setCapturePending(false);
        setCaptureError(chrome.runtime.lastError.message || 'Não foi possível alterar a ativação nesta página.');
        return;
      }

      const isMounted = Boolean(response?.isMounted);
      updatePageStatus(isMounted);
      callback(isMounted);
    });
  };

  const startCapture = (activatedNow: boolean) => {
    if (!activeTabId) return;
    chrome.tabs.sendMessage(activeTabId, { type: 'CREATE_COPILOT_SESSION' }, (sessionResponse) => {
      if (chrome.runtime.lastError || !sessionResponse?.sessionId) {
        setCapturePending(false);
        setCaptureError('A sessão do Copiloto ainda não está pronta. Atualize a página e tente novamente.');
        if (activatedNow) togglePageActivation(() => undefined);
        return;
      }

      chrome.runtime.sendMessage(
        { type: 'START_CAPTURE', tabId: activeTabId, sessionId: sessionResponse.sessionId },
        (response) => {
          setCapturePending(false);
          if (chrome.runtime.lastError) {
            setCaptureError(chrome.runtime.lastError.message || 'Falha ao comunicar com a extensão.');
            if (activatedNow) togglePageActivation(() => undefined);
            return;
          }

          if (response?.status === 'ok') {
            setIsCapturing(true);
            notifyCaptureState(true, response.sessionId || sessionResponse.sessionId);
          } else {
            setCaptureError(response?.error || 'Não foi possível iniciar a captura de áudio.');
            if (activatedNow) togglePageActivation(() => undefined);
          }
        }
      );
    });
  };

  const stopCapture = () => {
    if (!activeTabId || !pageStatus) return;
    chrome.runtime.sendMessage({ type: 'STOP_CAPTURE', tabId: activeTabId }, (response) => {
      if (chrome.runtime.lastError || response?.status !== 'ok') {
        setCapturePending(false);
        setCaptureError(response?.error || chrome.runtime.lastError?.message || 'Não foi possível parar a captura.');
        return;
      }

      setIsCapturing(false);
      notifyCaptureState(false);
      if (!pageStatus.isMeeting && pageStatus.isMounted) {
        togglePageActivation(() => setCapturePending(false));
      } else {
        setCapturePending(false);
      }
    });
  };

  const handlePrimaryAction = () => {
    if (!activeTabId || !pageStatus || capturePending) return;
    setCapturePending(true);
    setCaptureError(null);

    if (isCapturing) {
      stopCapture();
    } else if (pageStatus.isMounted) {
      startCapture(false);
    } else {
      togglePageActivation((isMounted) => {
        if (isMounted) startCapture(true);
        else setCapturePending(false);
      });
    }
  };

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', paddingBottom: '4px' }}>
        <h2 style={titleStyle}>🎙️ Copiloto de Conversas</h2>
      </div>

      {/* Controle único de ativação e captura */}
      <div style={pageCardStyle}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc' }}>
          Copiloto nesta página
        </div>
        <div style={{ marginTop: '2px', fontSize: '10px', color: '#94a3b8', lineHeight: 1.4 }}>
          {isCapturing
            ? 'Captura ativa. A transcrição está sendo enviada ao Copiloto.'
            : pageStatus?.isMounted
              ? 'Captura desativada. Inicie a captura de áudio quando estiver pronto.'
              : 'Captura desativada. Ative o Copiloto e inicie a captura em uma única ação.'}
        </div>
        <button
          onClick={handlePrimaryAction}
          disabled={!activeTabId || !pageStatus || capturePending}
          style={{
            marginTop: '8px',
            width: '100%',
            padding: '8px 12px',
            border: 'none',
            borderRadius: '8px',
            backgroundColor: isCapturing ? '#dc2626' : '#2563eb',
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: 700,
            cursor: !activeTabId || !pageStatus || capturePending ? 'not-allowed' : 'pointer',
            opacity: !activeTabId || !pageStatus || capturePending ? 0.55 : 1
          }}
        >
          {capturePending
            ? 'Processando...'
            : isCapturing
              ? pageStatus?.isMeeting ? 'Parar captura' : 'Parar e desativar'
              : pageStatus?.isMounted ? 'Iniciar captura' : 'Ativar e iniciar captura'}
        </button>
        {captureError && (
          <div role="alert" style={{ marginTop: '6px', color: '#fca5a5', fontSize: '10px', lineHeight: 1.4 }}>
            {captureError}
          </div>
        )}
      </div>

      {/* Botão de Atalho para Configurações Globais */}
      <div style={{ marginTop: '4px' }}>
        <button
          onClick={() => {
            if (chrome.runtime?.openOptionsPage) {
              chrome.runtime.openOptionsPage();
            } else {
              window.open(chrome.runtime.getURL('src/options/options.html'));
            }
          }}
          style={{
            width: '100%',
            backgroundColor: '#1e293b',
            color: '#94a3b8',
            border: '1px solid #334155',
            padding: '8px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'background-color 0.15s ease'
          }}
        >
          ⚙️ Abrir Configurações Globais (Aba Dedicada)
        </button>
      </div>

      <SettingsForm
        onSave={(payload) => {
          if (!activeTabId) return;
          chrome.tabs.sendMessage(
            activeTabId,
            { type: 'SETTINGS_UPDATED', payload },
            () => void chrome.runtime.lastError
          );
        }}
      />
    </div>
  );
};

// ============================================================
// Estilos
// ============================================================

const containerStyle: React.CSSProperties = {
  padding: '12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  minHeight: '400px'
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '15px',
  color: '#60a5fa',
  textAlign: 'center'
};

const pageCardStyle: React.CSSProperties = {
  backgroundColor: '#1f2937',
  borderRadius: '8px',
  padding: '8px 10px',
  border: '1px solid #374151'
};

// ============================================================
// Mount
// ============================================================
const root = createRoot(document.getElementById('popup-root')!);
root.render(<PopupSettings />);
