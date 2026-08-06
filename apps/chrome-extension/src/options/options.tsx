import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { SettingsForm } from '../shared/settings-form';
import { SavedConversation } from '@conversation-copilot/shared-types';
import { getSavedConversations, deleteConversation, triggerMarkdownDownload } from '../shared/conversation-storage';

type Tab = 'settings' | 'history';

const OptionsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') === 'history' ? 'history' : 'settings';
  });
  const [conversations, setConversations] = useState<SavedConversation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  const loadHistory = async () => {
    setLoading(true);
    const list = await getSavedConversations();
    setConversations(list);
    setLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta conversa do banco local?')) {
      await deleteConversation(id);
      loadHistory();
    }
  };

  const filteredConversations = conversations.filter(conv => {
    if (!searchTerm.trim()) return true;
    const query = searchTerm.toLowerCase().trim();
    const matchTitle = conv.title?.toLowerCase().includes(query);
    const matchUrl = conv.url?.toLowerCase().includes(query);
    const matchUtterance = conv.transcriptions?.some(u => u.text.toLowerCase().includes(query));
    const matchSuggestion = conv.suggestions?.some(s => s.question?.toLowerCase().includes(query) || s.rawText?.toLowerCase().includes(query));
    return matchTitle || matchUrl || matchUtterance || matchSuggestion;
  });

  const [chromeAiStatus, setChromeAiStatus] = useState<{ available: boolean; status: string }>({ available: false, status: 'unsupported' });

  useEffect(() => {
    const isAiAvailable =
      typeof (window as any).LanguageModel !== 'undefined' ||
      typeof (window as any).ai?.languageModel !== 'undefined' ||
      (typeof (window as any).ai !== 'undefined' && (window as any).ai !== null);

    if (isAiAvailable) {
      setChromeAiStatus({ available: true, status: 'available' });
    } else {
      chrome.storage.local.get('chromeAiStatus', (res) => {
        if (res.chromeAiStatus) {
          setChromeAiStatus(res.chromeAiStatus);
        }
      });
    }
  }, []);

  return (
    <div style={pageContainerStyle}>
      {/* Top Bar Header */}
      <header style={headerStyle}>
        <div style={headerContentStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '32px' }}>🎙️</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={titleStyle}>Copiloto de Conversas & Entrevistas</h1>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: chromeAiStatus.available ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                    color: chromeAiStatus.available ? '#10b981' : '#f59e0b',
                    border: `1px solid ${chromeAiStatus.available ? '#10b981' : '#f59e0b'}`
                  }}
                  title={
                    chromeAiStatus.available
                      ? 'Gemini Nano ativo para correção e sumarização no navegador'
                      : 'Prompt API não detectada no navegador. Transcrição usando bypass transparente'
                  }
                >
                  {chromeAiStatus.available ? '✨ Gemini Nano: Ativo (On-device)' : '⚡ Gemini Nano: Indisponível (Bypass Ativo)'}
                </span>
              </div>
              <p style={subtitleStyle}>Painel Geral de Configurações e Histórico de Reuniões</p>
            </div>
          </div>

          {/* Navegação por Abas */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setActiveTab('settings')}
              style={tabButtonStyle(activeTab === 'settings')}
            >
              ⚙️ Configurações Globais
            </button>
            <button
              onClick={() => setActiveTab('history')}
              style={tabButtonStyle(activeTab === 'history')}
            >
              📚 Histórico de Reuniões ({conversations.length})
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={mainStyle}>
        {activeTab === 'settings' ? (
          <div style={cardStyle}>
            <SettingsForm />
          </div>
        ) : (
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', color: '#f8fafc' }}>📚 Reuniões Salvas no Banco Local</h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
                  Suas reuniões são salvas localmente no navegador (`chrome.storage.local`). Pesquise por palavras-chave ou baixe em Markdown (.md).
                </p>
              </div>
              <button onClick={loadHistory} style={refreshButtonStyle}>
                🔄 Atualizar Lista
              </button>
            </div>

            {/* Campo de Busca em Tempo Real (HIST-02) */}
            <div style={{ marginBottom: '16px' }}>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="🔍 Pesquisar por palavra-chave em títulos, URLs, transcrições ou atas..."
                style={searchInputStyle}
              />
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>Carregando histórico...</div>
            ) : filteredConversations.length === 0 ? (
              <div style={emptyStateStyle}>
                <span style={{ fontSize: '36px' }}>📭</span>
                <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#94a3b8' }}>
                  {searchTerm ? `Nenhuma reunião encontrada para "${searchTerm}".` : 'Nenhuma reunião salva no banco local até o momento.'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredConversations.map((conv) => (
                  <div key={conv.id} style={itemCardStyle}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ margin: 0, fontSize: '15px', color: '#60a5fa' }}>{conv.title || 'Reunião Sem Título'}</h3>
                        <span style={badgeStyle}>
                          {new Date(conv.timestamp).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', wordBreak: 'break-all' }}>
                        🌐 {conv.url}
                      </div>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '12px', color: '#cbd5e1' }}>
                        <span>💬 <strong>{conv.transcriptions.length}</strong> falas transcritas</span>
                        <span>🤖 <strong>{conv.suggestions.length}</strong> sugestões geradas</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => triggerMarkdownDownload(conv)}
                        style={downloadBtnStyle}
                        title="Baixar em formato Markdown (.md)"
                      >
                        📥 Baixar .md
                      </button>
                      <button
                        onClick={() => handleDelete(conv.id)}
                        style={deleteBtnStyle}
                        title="Excluir do banco local"
                      >
                        🗑️ Excluir
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

// ============================================================
// Estilos
// ============================================================

const pageContainerStyle: React.CSSProperties = {
  minHeight: '100vh',
  backgroundColor: '#0f172a',
  color: '#f8fafc',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center'
};

const headerStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#1e293b',
  borderBottom: '1px solid #334155',
  padding: '16px 0',
  display: 'flex',
  justifyContent: 'center'
};

const headerContentStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '900px',
  padding: '0 24px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '16px'
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '20px',
  fontWeight: 700,
  color: '#60a5fa'
};

const subtitleStyle: React.CSSProperties = {
  margin: '4px 0 0 0',
  fontSize: '13px',
  color: '#94a3b8'
};

const tabButtonStyle = (isActive: boolean): React.CSSProperties => ({
  backgroundColor: isActive ? '#2563eb' : '#0f172a',
  color: isActive ? '#ffffff' : '#94a3b8',
  border: isActive ? '1px solid #3b82f6' : '1px solid #334155',
  padding: '8px 14px',
  borderRadius: '8px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.15s ease'
});

const mainStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '900px',
  padding: '24px',
  flex: 1
};

const cardStyle: React.CSSProperties = {
  backgroundColor: '#1e293b',
  borderRadius: '12px',
  border: '1px solid #334155',
  padding: '24px',
  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
};

const itemCardStyle: React.CSSProperties = {
  backgroundColor: '#0f172a',
  borderRadius: '8px',
  border: '1px solid #334155',
  padding: '16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '16px'
};

const badgeStyle: React.CSSProperties = {
  backgroundColor: '#334155',
  color: '#cbd5e1',
  fontSize: '11px',
  padding: '2px 8px',
  borderRadius: '12px',
  fontWeight: 500
};

const refreshButtonStyle: React.CSSProperties = {
  backgroundColor: '#0f172a',
  color: '#94a3b8',
  border: '1px solid #334155',
  padding: '6px 12px',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer'
};

const downloadBtnStyle: React.CSSProperties = {
  backgroundColor: '#16a34a',
  color: '#ffffff',
  border: 'none',
  padding: '8px 14px',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer'
};

const deleteBtnStyle: React.CSSProperties = {
  backgroundColor: 'rgba(239, 68, 68, 0.15)',
  color: '#fca5a5',
  border: '1px solid #ef4444',
  padding: '8px 12px',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer'
};

const emptyStateStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '48px 16px',
  backgroundColor: '#0f172a',
  borderRadius: '8px',
  border: '1px dashed #334155'
};

const searchInputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#0f172a',
  color: '#f8fafc',
  border: '1px solid #334155',
  borderRadius: '8px',
  padding: '10px 14px',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box'
};

// ============================================================
// Mount
// ============================================================

const root = createRoot(document.getElementById('options-root')!);
root.render(<OptionsPage />);
