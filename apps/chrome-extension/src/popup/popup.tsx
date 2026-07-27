import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { SettingsForm } from '../shared/settings-form';

const PopupSettings: React.FC = () => {
  const [pageStatus, setPageStatus] = useState<{ isMeeting: boolean; isEnabledManually: boolean; isMounted: boolean } | null>(null);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab?.id) {
        setActiveTabId(tab.id);
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

  const handleTogglePageCopilot = () => {
    if (activeTabId) {
      chrome.tabs.sendMessage(activeTabId, { type: 'TOGGLE_PAGE_COPILOT' }, (res) => {
        if (chrome.runtime.lastError) {
          return;
        }
        if (res) {
          setPageStatus(prev => prev ? { ...prev, isMounted: res.isMounted, isEnabledManually: !prev.isEnabledManually } : null);
        }
      });
    }
  };

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', paddingBottom: '4px' }}>
        <h2 style={titleStyle}>🎙️ Copiloto de Conversas</h2>
      </div>

      {/* Card de Controle de Ativação da Página Atual */}
      <div style={pageCardStyle}>
        <div style={{ fontSize: '11px', color: '#9ca3af' }}>
          Status nesta página:
        </div>
        {pageStatus?.isMeeting ? (
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#10b981' }}>
            🌐 Reunião Detectada (Ativo Automático)
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
            <span style={{ fontSize: '11px', color: pageStatus?.isMounted ? '#60a5fa' : '#6b7280' }}>
              {pageStatus?.isMounted ? '✨ Ativo Sob Demanda' : '⚪ Oculto por padrão'}
            </span>
            <button
              onClick={handleTogglePageCopilot}
              style={{
                backgroundColor: pageStatus?.isMounted ? 'rgba(239, 68, 68, 0.2)' : '#2563eb',
                color: pageStatus?.isMounted ? '#fca5a5' : '#ffffff',
                border: pageStatus?.isMounted ? '1px solid #ef4444' : 'none',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {pageStatus?.isMounted ? 'Desativar nesta página' : '⚡ Ativar nesta página'}
            </button>
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

      <SettingsForm />
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

