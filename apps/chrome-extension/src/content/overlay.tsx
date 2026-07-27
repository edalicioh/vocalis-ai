import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SpeechManager } from '../tts/speech-manager';
import { SettingsForm } from '../shared/settings-form';
import {
  Utterance,
  Suggestion,
  WSMessage,
  StatusUpdatePayload,
  PanelMode,
  StructuredAnswer,
  QuestionDetectionResult,
  AnswerStartedPayload,
  AnswerDeltaPayload,
  AnswerCompletedPayload,
  AnswerCancelledPayload,
  AnswerFailedPayload,
  TtsMode,
  SavedConversation
} from '@conversation-copilot/shared-types';
import { saveConversation, triggerMarkdownDownload } from '../shared/conversation-storage';

const speechManager = new SpeechManager();

// ============================================================
// Persistência de posição global (chrome.storage.local)
// ============================================================

const STORAGE_KEY = 'copilotPosition';
const DEFAULT_POSITION = { x: window.innerWidth - 400, y: 20 };

function loadPosition(): { x: number; y: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') return parsed;
    }
  } catch { /* ignore */ }
  return DEFAULT_POSITION;
}

function savePosition(pos: { x: number; y: number }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch { /* ignore */ }
}

// ============================================================
// Persistência de Dimensões e Opacidade
// ============================================================

const DIMENSIONS_KEY = 'copilotDimensions';
const DEFAULT_DIMENSIONS = { width: 380, height: 500 };

function loadDimensions(): { width: number; height: number } {
  try {
    const raw = localStorage.getItem(DIMENSIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.width === 'number' && typeof parsed.height === 'number') {
        return {
          width: Math.min(Math.max(parsed.width, 280), 700),
          height: Math.min(Math.max(parsed.height, 200), window.innerHeight * 0.9)
        };
      }
    }
  } catch { /* ignore */ }
  return DEFAULT_DIMENSIONS;
}

function saveDimensions(dim: { width: number; height: number }) {
  try {
    localStorage.setItem(DIMENSIONS_KEY, JSON.stringify(dim));
  } catch { /* ignore */ }
}

const OPACITY_KEY = 'copilotOpacity';
function loadOpacity(): number {
  try {
    const raw = localStorage.getItem(OPACITY_KEY);
    if (raw) {
      const num = parseFloat(raw);
      if (!isNaN(num) && num >= 0.5 && num <= 1.0) return num;
    }
  } catch { /* ignore */ }
  return 0.95;
}

function saveOpacity(op: number) {
  try { localStorage.setItem(OPACITY_KEY, String(op)); } catch { /* ignore */ }
}

// ============================================================
// Persistência de modo do painel e mute
// ============================================================

const PANEL_MODE_KEY = 'copilotPanelMode';
const MUTED_KEY = 'copilotMuted';

function loadPanelMode(): PanelMode {
  try {
    const raw = localStorage.getItem(PANEL_MODE_KEY);
    if (raw === 'compact' || raw === 'keywords-only' || raw === 'transcription-only') return raw;
  } catch { /* ignore */ }
  return 'normal';
}

function savePanelMode(mode: PanelMode) {
  try { localStorage.setItem(PANEL_MODE_KEY, mode); } catch { /* ignore */ }
}

function loadMuted(): boolean {
  try { return localStorage.getItem(MUTED_KEY) === 'true'; } catch { /* ignore */ }
  return false;
}

function saveMuted(muted: boolean) {
  try { localStorage.setItem(MUTED_KEY, String(muted)); } catch { /* ignore */ }
}

// ============================================================
// Componente principal
// ============================================================

export const CopilotOverlay: React.FC = () => {
  // --- Identificador único de sessão da aba ---
  const [tabSessionId] = useState(() => 'session-tab-' + Math.random().toString(36).substring(2, 9));

  // --- Visibilidade do painel (false = só botão flutuante) ---
  const [panelOpen, setPanelOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // --- Posição e Dimensões ---
  const [position, setPosition] = useState<{ x: number; y: number }>(loadPosition);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>(loadDimensions);
  const [opacity, setOpacity] = useState<number>(loadOpacity);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [meetingMarkdown, setMeetingMarkdown] = useState<string | null>(null);

  // --- Arrasto e Redimensionamento ---
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // --- Outros estados existentes ---
  const [panelMode, setPanelMode] = useState<PanelMode>(loadPanelMode);
  const [isCapturing, setIsCapturing] = useState(false);
  const [status, setStatus] = useState<StatusUpdatePayload>({
    whisperConnected: false,
    llmConfigured: false,
    isCapturing: false
  });
  const [transcriptions, setTranscriptions] = useState<Utterance[]>([]);
  const [completedSuggestions, setCompletedSuggestions] = useState<Suggestion[]>([]);
  const [activeSuggestion, setActiveSuggestion] = useState<Suggestion | null>(null);
  const [detectedQuestion, setDetectedQuestion] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(loadMuted);
  const [ttsMode, setTtsMode] = useState<TtsMode>('manual');
  const [highlightedSentence, setHighlightedSentence] = useState<number>(-1);
  const [isTtsSpeaking, setIsTtsSpeaking] = useState(false);

  // --- Streaming UX ---
  const [isStalled, setIsStalled] = useState(false);
  const [fadingOut, setFadingOut] = useState<string | null>(null);
  const stalledTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const transcriptionEndRef = useRef<HTMLDivElement | null>(null);

  // ========= WebSocket Connection & Atalhos de Teclado =========

  useEffect(() => {
    connectWebSocket();

    speechManager.setOnSentenceStart((index) => {
      setHighlightedSentence(index);
      setIsTtsSpeaking(true);
    });
    speechManager.setOnSpeechEnd(() => {
      setHighlightedSentence(-1);
      setIsTtsSpeaking(false);
    });

    const handleForceTrigger = () => {
      sendWsMessage({ type: 'answer.force', payload: {} });
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        setPanelOpen(prev => !prev);
      }
    };

    window.addEventListener('copilot:force-trigger', handleForceTrigger);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      wsRef.current?.close();
      speechManager.cancel();
      window.removeEventListener('copilot:force-trigger', handleForceTrigger);
      window.removeEventListener('keydown', handleKeyDown);
      if (stalledTimerRef.current) clearTimeout(stalledTimerRef.current);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  // --- Persistência panelMode ---
  useEffect(() => { savePanelMode(panelMode); }, [panelMode]);

  // --- Persistência isMuted ---
  useEffect(() => { saveMuted(isMuted); }, [isMuted]);

  useEffect(() => {
    transcriptionEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcriptions]);

  const connectWebSocket = () => {
    const ws = new WebSocket('ws://localhost:3001/ws');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[Overlay] Conectado ao Orquestrador com sessionId:', tabSessionId);
      ws.send(JSON.stringify({ type: 'session.register', sessionId: tabSessionId, payload: {} }));
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        handleMessage(msg);
      } catch (err) {
        console.error('[Overlay] Erro ao decodificar mensagem:', err);
      }
    };

    ws.onclose = () => {
      setTimeout(connectWebSocket, 3000);
    };
  };

  const handleMessage = (msg: WSMessage) => {
    if (msg.sessionId && msg.sessionId !== tabSessionId) {
      return; // Ignora mensagens direcionadas a outras abas
    }
    switch (msg.type) {
      case 'status.update':
      case 'STATUS_UPDATE' as any: {
        setStatus(msg.payload as StatusUpdatePayload);
        break;
      }

      case 'meeting.summary.completed' as any: {
        const payload = msg.payload as { markdown: string };
        if (payload?.markdown) {
          setMeetingMarkdown(payload.markdown);
          setCopiedId('meeting-summary');
          setTimeout(() => setCopiedId(null), 3000);
        }
        break;
      }

      case 'transcript.partial':
      case 'transcript.final':
      case 'TRANSCRIPTION_DELTA' as any: {
        const item = msg.payload as Utterance;
        setTranscriptions(prev => [...prev.slice(-15), item]);
        break;
      }

      case 'question.detected': {
        const detection = msg.payload as QuestionDetectionResult;
        setDetectedQuestion(detection.questionText);
        speechManager.cancel();
        setIsTtsSpeaking(false);
        setHighlightedSentence(-1);
        break;
      }

      case 'answer.started': {
        const started = msg.payload as AnswerStartedPayload;
        if (errorTimerRef.current) { clearTimeout(errorTimerRef.current); errorTimerRef.current = null; }
        if (stalledTimerRef.current) clearTimeout(stalledTimerRef.current);
        setIsStalled(false);
        setActiveSuggestion({
          id: started.id,
          question: started.question,
          structured: {},
          rawText: '',
          timestamp: Date.now(),
          status: 'streaming'
        });
        stalledTimerRef.current = setTimeout(() => setIsStalled(true), 5000);
        break;
      }

      case 'answer.delta':
      case 'SUGGESTION_STREAM' as any: {
        const delta = msg.payload as AnswerDeltaPayload | any;
        if (stalledTimerRef.current) { clearTimeout(stalledTimerRef.current); stalledTimerRef.current = null; }
        setIsStalled(false);
        setActiveSuggestion(prev => {
          if (!prev) {
            return {
              id: delta.id,
              question: delta.question || '',
              structured: {},
              rawText: delta.chunk || '',
              timestamp: Date.now(),
              status: 'streaming'
            };
          }
          return { ...prev, rawText: prev.rawText + (delta.chunk || '') };
        });
        break;
      }

      case 'answer.completed':
      case 'SUGGESTION_COMPLETE' as any: {
        const completed = msg.payload as AnswerCompletedPayload | any;
        if (stalledTimerRef.current) { clearTimeout(stalledTimerRef.current); stalledTimerRef.current = null; }
        if (errorTimerRef.current) { clearTimeout(errorTimerRef.current); errorTimerRef.current = null; }
        setIsStalled(false);
        const suggestion: Suggestion = {
          id: completed.id,
          question: activeSuggestion?.question || completed.question || '',
          structured: completed.structured || {},
          rawText: completed.answer || activeSuggestion?.rawText || '',
          timestamp: Date.now(),
          status: 'complete'
        };

        setActiveSuggestion(null);
        setCompletedSuggestions(prev => [suggestion, ...prev]);
        setDetectedQuestion(null);

        if (!speechManager.getIsMuted() && speechManager.getMode() !== 'off' && speechManager.getMode() !== 'manual') {
          const structured = completed.structured as StructuredAnswer | undefined;
          if (structured) {
            speechManager.speakStructured(structured);
          } else {
            speechManager.speak(completed.answer || suggestion.rawText);
          }
        }
        break;
      }

      case 'answer.cancelled': {
        const cancelled = msg.payload as AnswerCancelledPayload;
        if (activeSuggestion && activeSuggestion.id === cancelled.id) {
          const cancelledSuggestion: Suggestion = {
            ...activeSuggestion,
            status: 'cancelled',
            reason: cancelled.reason
          };
          setActiveSuggestion(null);
          setFadingOut(cancelledSuggestion.id);
          setTimeout(() => {
            setCompletedSuggestions(prev => [cancelledSuggestion, ...prev]);
            setFadingOut(null);
          }, 300);
        }
        break;
      }

      case 'answer.failed': {
        const failed = msg.payload as AnswerFailedPayload;
        if (stalledTimerRef.current) { clearTimeout(stalledTimerRef.current); stalledTimerRef.current = null; }
        setIsStalled(false);
        if (activeSuggestion && activeSuggestion.id === failed.id) {
          setActiveSuggestion(prev => prev ? { ...prev, rawText: failed.error, status: 'error' } : null);
          if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
          errorTimerRef.current = setTimeout(() => {
            setActiveSuggestion(prev => {
              if (prev && prev.status === 'error') {
                setCompletedSuggestions(completed => [prev, ...completed]);
                return null;
              }
              return prev;
            });
            errorTimerRef.current = null;
          }, 30000);
        }
        break;
      }
    }
  };

  // ========= Drag handlers (Painel e FAB) =========

  const handleDragStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: position.x,
      originY: position.y
    };

    const handlePointerMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      const panelWidth = dimensions.width;
      const panelHeight = dimensions.height;
      const maxX = Math.max(0, window.innerWidth - panelWidth);
      const maxY = Math.max(0, window.innerHeight - panelHeight);
      setPosition({
        x: Math.max(0, Math.min(maxX, dragRef.current.originX + dx)),
        y: Math.max(0, Math.min(maxY, dragRef.current.originY + dy))
      });
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      dragRef.current = null;
      setPosition(pos => {
        savePosition(pos);
        return pos;
      });
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  }, [position, dimensions]);

  const handleFabPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    let moved = false;
    const startX = e.clientX;
    const startY = e.clientY;
    const originX = position.x;
    const originY = position.y;
    const buttonSize = 52;

    const handlePointerMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.hypot(dx, dy) > 5) {
        moved = true;
      }
      const maxX = Math.max(0, window.innerWidth - buttonSize);
      const maxY = Math.max(0, window.innerHeight - buttonSize);
      setPosition({
        x: Math.max(0, Math.min(maxX, originX + dx)),
        y: Math.max(0, Math.min(maxY, originY + dy))
      });
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      setPosition(pos => {
        savePosition(pos);
        return pos;
      });
      if (!moved) {
        setPanelOpen(true);
        setShowSettings(false);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [position]);

  // ========= Handlers de Redimensionamento e Cópia =========

  const handleResizeStart = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: dimensions.width,
      startH: dimensions.height
    };
    setIsResizing(true);

    const handlePointerMove = (moveEv: PointerEvent) => {
      if (!resizeRef.current) return;
      const deltaX = moveEv.clientX - resizeRef.current.startX;
      const deltaY = moveEv.clientY - resizeRef.current.startY;
      const newW = Math.min(Math.max(resizeRef.current.startW + deltaX, 280), 700);
      const newH = Math.min(Math.max(resizeRef.current.startH + deltaY, 200), window.innerHeight * 0.9);
      const newDim = { width: newW, height: newH };
      setDimensions(newDim);
      saveDimensions(newDim);
    };

    const handlePointerUp = () => {
      resizeRef.current = null;
      setIsResizing(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleCopySuggestion = (sug: Suggestion) => {
    const text = getAnswerText(sug) || sug.rawText || '';
    if (text) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedId(sug.id);
        setTimeout(() => setCopiedId(null), 2000);
      }).catch(() => {});
    }
  };

  // ========= Handlers existentes =========

  const handleStartCapture = () => {
    chrome.runtime.sendMessage({ type: 'START_CAPTURE', sessionId: tabSessionId }, (res) => {
      if (chrome.runtime.lastError) {
        console.warn('[Overlay] Falha ao comunicar com o service worker:', chrome.runtime.lastError.message);
        return;
      }
      if (res?.status === 'ok') {
        setIsCapturing(true);
        sendWsMessage({ type: 'session.start', sessionId: tabSessionId, payload: {} });
      }
    });
  };

  const getCurrentConversationObj = (): SavedConversation => {
    const allSuggestions = [...completedSuggestions];
    if (activeSuggestion) {
      allSuggestions.push(activeSuggestion);
    }
    return {
      id: tabSessionId,
      title: document.title || 'Reunião Copiloto',
      url: window.location.href,
      timestamp: Date.now(),
      transcriptions: transcriptions,
      suggestions: allSuggestions
    };
  };

  const handleSaveAndDownloadMd = () => {
    const conv = getCurrentConversationObj();
    saveConversation(conv);
    triggerMarkdownDownload(conv, meetingMarkdown || undefined);
    setCopiedId('save-md');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleStopCapture = () => {
    chrome.runtime.sendMessage({ type: 'STOP_CAPTURE', sessionId: tabSessionId }, () => {
      if (chrome.runtime.lastError) {
        // Ignora erros de encerramento
      }
      setIsCapturing(false);
      sendWsMessage({ type: 'session.stop', sessionId: tabSessionId, payload: {} });
      speechManager.cancel();
      // Auto-salva no banco local
      saveConversation(getCurrentConversationObj());
    });
  };

  const handleForceTrigger = () => {
    sendWsMessage({ type: 'answer.force', sessionId: tabSessionId, payload: {} });
  };

  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    speechManager.setMuted(nextMute);
  };

  const handleSpeakSuggestion = (suggestion: Suggestion) => {
    if (suggestion.structured && (suggestion.structured as StructuredAnswer).answer) {
      speechManager.speakStructured(suggestion.structured as StructuredAnswer);
    } else {
      speechManager.speak(suggestion.rawText);
    }
  };

  const handlePauseTts = () => {
    if (speechManager.getIsPaused()) {
      speechManager.resume();
    } else {
      speechManager.pause();
    }
  };

  const handleRepeatTts = () => {
    speechManager.repeat();
  };

  const cyclePanelMode = () => {
    const modes: PanelMode[] = ['normal', 'compact', 'keywords-only', 'transcription-only'];
    const idx = modes.indexOf(panelMode);
    setPanelMode(modes[(idx + 1) % modes.length]);
  };

  const sendWsMessage = (msg: WSMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const msgWithSession = { ...msg, sessionId: tabSessionId };
      wsRef.current.send(JSON.stringify(msgWithSession));
    }
  };

  // ========= Helpers =========

  const getAnswerText = (sug: Suggestion): string => {
    const s = sug.structured as Partial<StructuredAnswer> | undefined;
    return s?.answer || sug.rawText || '';
  };

  const getKeyPoints = (sug: Suggestion): string[] => {
    const s = sug.structured as Partial<StructuredAnswer> | undefined;
    return s?.keyPoints || [];
  };

  const getOpening = (sug: Suggestion): string => {
    const s = sug.structured as Partial<StructuredAnswer> | undefined;
    return s?.opening || '';
  };

  const getStatusLabel = (sug: Suggestion): string => {
    switch (sug.status) {
      case 'cancelled': return '⏹️ Interrompida';
      case 'error': return '❌ Erro';
      case 'streaming': return '⏳ Gerando...';
      default: return '';
    }
  };

  // ========= Render: Botão flutuante (quando painel fechado) =========

  if (!panelOpen) {
    return (
      <div
        style={{
          ...floatingButtonStyle,
          left: `${position.x}px`,
          top: `${position.y}px`,
          cursor: 'grab'
        }}
        onPointerDown={handleFabPointerDown}
        title="Abrir ou arrastar Copiloto (Alt+C)"
        aria-label="Abrir ou arrastar Copiloto"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPanelOpen(true); setShowSettings(false); }}}
      >
        🤖
      </div>
    );
  }

  // ========= Render: Painel completo =========

  return (
    <div
      style={{
        ...containerStyle,
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${dimensions.width}px`,
        height: `${dimensions.height}px`,
        backgroundColor: `rgba(17, 24, 39, ${opacity})`
      }}
    >
      {/* Drag Handle (com duplo clique para alternar modo compacto) */}
      <div
        style={{
          ...dragHandleStyle,
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
        onPointerDown={handleDragStart}
        onDoubleClick={() => setPanelMode(prev => prev === 'compact' ? 'normal' : 'compact')}
        title="Arrastar ou dar duplo clique para alternar modo compacto"
      >
        <span style={{ fontSize: '10px', color: '#6b7280' }}>⋮⋮</span>
      </div>

      {/* Toolbar — linha de título e ações globais */}
      <div style={toolbarStyle} onDoubleClick={() => setPanelMode(prev => prev === 'compact' ? 'normal' : 'compact')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
          <span style={indicatorStyle(status.whisperConnected && status.llmConfigured)} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#f3f4f6' }}>Copiloto</span>
          <span style={{ fontSize: '9px', color: '#6b7280' }}>
            {panelMode === 'compact' ? '· compacto' : panelMode === 'keywords-only' ? '· palavras-chave' : panelMode === 'transcription-only' ? '· transcrição' : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '2px' }}>
          <button
            onClick={() => setShowSettings(prev => !prev)}
            style={{ ...iconButtonStyle, color: showSettings ? '#60a5fa' : '#9ca3af' }}
            title="Ajustes"
            aria-label="Ajustes"
          >
            ⚙️
          </button>
          <button
            onClick={() => setPanelOpen(false)}
            style={iconButtonStyle}
            title="Ocultar painel (Alt+C)"
            aria-label="Ocultar painel"
          >
            ✖️
          </button>
        </div>
      </div>

      {/* Barra de ações (não aparece quando ajustes abertos) */}
      {!showSettings && (
        <div style={actionBarStyle}>
          {isCapturing ? (
            <button onClick={handleStopCapture} style={dangerBtnStyle}>⬛ Parar</button>
          ) : (
            <button onClick={handleStartCapture} style={primaryBtnStyle}>▶ Iniciar</button>
          )}
          <button onClick={handleForceTrigger} style={actionBtnStyle} title="Forçar sugestão (Alt+S)" aria-label="Forçar sugestão">
            ⚡
          </button>
          <button onClick={toggleMute} style={actionBtnStyle} title={isMuted ? 'Ativar áudio' : 'Silenciar'} aria-label={isMuted ? 'Ativar áudio' : 'Silenciar leitura'}>
            {isMuted ? '🔇' : '🔊'}
          </button>
          {isTtsSpeaking && (
            <>
              <button onClick={handlePauseTts} style={actionBtnStyle} title="Pausar/Retomar Leitura" aria-label={speechManager.getIsPaused() ? 'Retomar leitura' : 'Pausar leitura'}>
                {speechManager.getIsPaused() ? '▶' : '⏸'}
              </button>
              <button onClick={handleRepeatTts} style={actionBtnStyle} title="Repetir Leitura" aria-label="Repetir leitura">
                🔁
              </button>
            </>
          )}
          <button onClick={cyclePanelMode} style={actionBtnStyle} title="Alternar modo visual" aria-label="Alternar modo visual">
            👁
          </button>
          <button
            onClick={handleSaveAndDownloadMd}
            style={{ ...actionBtnStyle, color: copiedId === 'save-md' ? '#10b981' : '#9ca3af' }}
            title="Salvar no Banco & Baixar Markdown (.md)"
            aria-label="Salvar no banco e baixar Markdown"
          >
            {copiedId === 'save-md' ? '✓' : '💾'}
          </button>
          <button
            onClick={() => {
              if (chrome.runtime?.openOptionsPage) {
                chrome.runtime.openOptionsPage();
              } else {
                window.open(chrome.runtime.getURL('src/options/options.html?tab=history'), '_blank');
              }
            }}
            style={actionBtnStyle}
            title="Abrir Histórico de Reuniões"
            aria-label="Abrir Histórico de Reuniões"
          >
            📚
          </button>

          {/* Slider de Transparência/Opacidade */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginLeft: 'auto' }} title={`Opacidade: ${Math.round(opacity * 100)}%`}>
            <span style={{ fontSize: '10px', color: '#9ca3af' }}>💧</span>
            <input
              type="range"
              min="0.3"
              max="1.0"
              step="0.05"
              value={opacity}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setOpacity(val);
                saveOpacity(val);
              }}
              style={{ width: '40px', cursor: 'pointer', accentColor: '#3b82f6' }}
              aria-label="Ajustar opacidade"
            />
          </div>
        </div>
      )}

      {/* Status bar compacta */}
      {!showSettings && panelMode !== 'compact' && (
        <div style={statusBarStyle}>
          <span style={{ fontSize: '10px', color: '#9ca3af' }}>
            Whisper {status.whisperConnected ? '🟢' : '🔴'} · IA {status.llmConfigured ? '🟢' : '🟡'}
          </span>
        </div>
      )}

      {/* Conteúdo principal ou ajustes */}
      {showSettings ? (
        <div style={settingsContainerStyle}>
          <SettingsForm
            opacity={opacity}
            onOpacityChange={(val) => {
              setOpacity(val);
              saveOpacity(val);
            }}
          />
        </div>
      ) : (
        <div style={scrollAreaStyle}>
          {/* Transcrição (normal e transcription-only) */}
          {(panelMode === 'normal' || panelMode === 'transcription-only') && (
            <div style={sectionBoxStyle}>
              <div style={sectionTitleStyle}>Transcrição ao Vivo</div>
              <div style={transcriptionListStyle}>
                {transcriptions.length === 0 ? (
                  <span style={{ color: '#6b7280', fontSize: '11px', fontStyle: 'italic' }}>Aguardando áudio...</span>
                ) : (
                  transcriptions.map((item, idx) => (
                    <div key={idx} style={{
                      marginBottom: '4px',
                      fontSize: '12px',
                      color: item.isFinal ? '#e5e7eb' : '#9ca3af',
                      fontStyle: item.isFinal ? 'normal' : 'italic'
                    }}>
                      <span style={{ color: '#60a5fa', fontWeight: 600 }}>
                        {item.speaker === 'interviewer' ? 'Entrevistador' : 'Fala'}:
                      </span>{' '}
                      {item.text}
                      {item.confidence !== undefined && (
                        <span style={{ color: '#4b5563', fontSize: '9px', marginLeft: '4px' }}>
                          ({Math.round(item.confidence * 100)}%)
                        </span>
                      )}
                    </div>
                  ))
                )}
                <div ref={transcriptionEndRef} />
              </div>
            </div>
          )}

          {/* Pergunta detectada */}
          {detectedQuestion && panelMode !== 'transcription-only' && (
            <div style={questionBannerStyle}>
              ❓ <strong>Pergunta detectada:</strong> {detectedQuestion}
            </div>
          )}

          {/* Sugestões (normal, compact, keywords-only) */}
          {panelMode !== 'transcription-only' && (
            <div style={sectionBoxStyle}>
              {panelMode !== 'compact' && (
                <div style={sectionTitleStyle}>Sugestão Contextual</div>
              )}

              {activeSuggestion && (
                <div style={activeSuggestion.status === 'error' ? errorCardStyle : streamingCardStyle}>
                  <div style={{ fontSize: '11px', color: '#93c5fd', fontWeight: 600 }}>
                    ❓ {activeSuggestion.question}
                  </div>
                  <div style={{ fontSize: '12px', color: '#f3f4f6', marginTop: '6px', whiteSpace: 'pre-wrap' }}>
                    {activeSuggestion.rawText || (isStalled ? '(sem resposta...)' : 'Gerando sugestão...')}
                    {activeSuggestion.status === 'streaming' && activeSuggestion.rawText && (
                      <span style={{ display: 'inline-block', animation: 'copilot-blink 0.8s infinite', marginLeft: '1px' }}>│</span>
                    )}
                  </div>
                  {activeSuggestion.status === 'error' && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                      <button
                        onClick={() => sendWsMessage({ type: 'answer.force', payload: {} })}
                        style={{ ...smallButtonStyle, backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5' }}
                        aria-label="Tentar novamente"
                      >
                        🔁 Tentar novamente
                      </button>
                    </div>
                  )}
                </div>
              )}

              {completedSuggestions.length === 0 && !activeSuggestion ? (
                <div style={{ color: '#6b7280', fontSize: '11px', textAlign: 'center', padding: '12px 0' }}>
                  Pressione <strong>Alt+S</strong> para sugerir agora.
                </div>
              ) : (
                completedSuggestions.slice(0, 3).map((sug) => (
                  <div key={sug.id} style={{
                    ...suggestionCardStyle,
                    opacity: sug.status === 'cancelled' ? 0.6 : 1,
                    borderLeft: sug.status === 'cancelled' ? '3px solid #ef4444' : '3px solid transparent',
                    animation: fadingOut === sug.id ? 'copilot-fadeOut 0.3s ease-out forwards' : undefined
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: '#fbbf24', fontWeight: 600 }}>
                        ❓ {sug.question}
                      </span>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <button
                          onClick={() => handleCopySuggestion(sug)}
                          style={{
                            ...smallButtonStyle,
                            backgroundColor: copiedId === sug.id ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                            color: copiedId === sug.id ? '#34d399' : '#e5e7eb'
                          }}
                          aria-label="Copiar resposta"
                        >
                          {copiedId === sug.id ? '✓ Copiado!' : '📋 Copiar'}
                        </button>
                        {sug.status !== 'cancelled' && sug.status !== 'error' && (
                          <button onClick={() => handleSpeakSuggestion(sug)} style={smallButtonStyle} aria-label="Ler em voz alta">
                            🗣️ Ler
                          </button>
                        )}
                        {getStatusLabel(sug) && (
                          <span style={{ fontSize: '10px', color: '#ef4444' }}>{getStatusLabel(sug)}</span>
                        )}
                      </div>
                    </div>

                    {sug.status === 'cancelled' && sug.reason && (
                      <div style={{ fontSize: '10px', color: '#ef4444', marginTop: '4px' }}>
                        Cancelado: {sug.reason}
                      </div>
                    )}

                    {getOpening(sug) && panelMode !== 'keywords-only' && (
                      <div style={{ fontSize: '12px', color: '#34d399', fontWeight: 600, marginTop: '6px' }}>
                        💡 {getOpening(sug)}
                      </div>
                    )}

                    {panelMode !== 'keywords-only' && panelMode !== 'compact' && (
                      <div style={{ fontSize: '12px', color: '#f3f4f6', marginTop: '6px', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                        {getAnswerText(sug)}
                      </div>
                    )}

                    {getKeyPoints(sug).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                        {getKeyPoints(sug).map((kp, i) => (
                          <span key={i} style={keywordBadgeStyle}>{kp}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Toast flutuante de feedback de cópia e ata (D-09) */}
      {copiedId && (
        <div style={toastContainerStyle}>
          {copiedId === 'save-md' ? '✓ Salvo e baixado!' : copiedId === 'meeting-summary' ? 'Ata Pronta! 📄' : 'Copiado! ✓'}
        </div>
      )}

      {/* Resize Handle no canto inferior direito (D-01) */}
      <div
        onPointerDown={handleResizeStart}
        style={{
          position: 'absolute',
          bottom: '2px',
          right: '4px',
          cursor: 'se-resize',
          padding: '4px',
          color: '#6b7280',
          fontSize: '10px',
          userSelect: 'none',
          zIndex: 10
        }}
        title="Arrastar para redimensionar"
        aria-label="Arrastar para redimensionar"
      >
        ◢
      </div>
    </div>
  );
};


// ============================================================
// Estilos — Vanilla CSS Inline para Shadow DOM
// ============================================================

const floatingButtonStyle: React.CSSProperties = {
  position: 'fixed',
  width: '52px',
  height: '52px',
  backgroundColor: 'rgba(17, 24, 39, 0.92)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  fontSize: '22px',
  zIndex: 999999,
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  userSelect: 'none',
  touchAction: 'none'
};

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  maxHeight: '90vh',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: '16px',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
  color: '#f9fafb',
  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  zIndex: 999999,
  display: 'flex',
  flexDirection: 'column',
  padding: '0',
  overflow: 'hidden',
  touchAction: 'none'
};

const toastContainerStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '12px',
  left: '50%',
  transform: 'translateX(-50%)',
  backgroundColor: 'rgba(16, 185, 129, 0.95)',
  color: '#ffffff',
  padding: '4px 12px',
  borderRadius: '16px',
  fontSize: '11px',
  fontWeight: 600,
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
  pointerEvents: 'none',
  zIndex: 999999,
  animation: 'copilot-fadeIn 0.2s ease-out'
};

const dragHandleStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '4px 0 0 0',
  cursor: 'grab',
  userSelect: 'none',
  touchAction: 'none'
};

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '6px 12px 8px 12px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
};

const actionBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '6px 12px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
  backgroundColor: 'rgba(255, 255, 255, 0.03)'
};

const statusBarStyle: React.CSSProperties = {
  padding: '4px 12px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.04)'
};

const settingsContainerStyle: React.CSSProperties = {
  padding: '10px 12px',
  overflowY: 'auto',
  maxHeight: 'calc(85vh - 120px)',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px'
};

const scrollAreaStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '8px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  maxHeight: 'calc(85vh - 120px)'
};

const sectionBoxStyle: React.CSSProperties = {
  marginTop: '4px',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px'
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: '#9ca3af'
};

const transcriptionListStyle: React.CSSProperties = {
  maxHeight: '100px',
  overflowY: 'auto',
  backgroundColor: 'rgba(0, 0, 0, 0.3)',
  padding: '8px',
  borderRadius: '8px',
  border: '1px solid rgba(255, 255, 255, 0.05)'
};

const questionBannerStyle: React.CSSProperties = {
  marginTop: '8px',
  padding: '8px 10px',
  backgroundColor: 'rgba(251, 191, 36, 0.15)',
  border: '1px solid rgba(251, 191, 36, 0.3)',
  borderRadius: '8px',
  fontSize: '12px',
  color: '#fbbf24'
};

const streamingCardStyle: React.CSSProperties = {
  backgroundColor: 'rgba(30, 58, 138, 0.4)',
  border: '1px solid #3b82f6',
  borderRadius: '8px',
  padding: '10px'
};

const errorCardStyle: React.CSSProperties = {
  ...streamingCardStyle,
  backgroundColor: 'rgba(127, 29, 29, 0.35)',
  border: '1px solid #ef4444'
};

const suggestionCardStyle: React.CSSProperties = {
  backgroundColor: 'rgba(31, 41, 55, 0.8)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: '8px',
  padding: '10px',
  maxHeight: '220px',
  overflowY: 'auto'
};

const keywordBadgeStyle: React.CSSProperties = {
  backgroundColor: 'rgba(59, 130, 246, 0.2)',
  color: '#93c5fd',
  padding: '2px 8px',
  borderRadius: '12px',
  fontSize: '10px',
  fontWeight: 600,
  border: '1px solid rgba(59, 130, 246, 0.3)'
};

const indicatorStyle = (active: boolean): React.CSSProperties => ({
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  backgroundColor: active ? '#10b981' : '#ef4444',
  boxShadow: active ? '0 0 8px #10b981' : 'none',
  flexShrink: 0
});

const iconButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '14px',
  padding: '2px 4px',
  lineHeight: 1
};

const actionBtnStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.06)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  cursor: 'pointer',
  fontSize: '13px',
  padding: '3px 7px',
  borderRadius: '6px',
  lineHeight: 1,
  color: '#e5e7eb'
};

const primaryBtnStyle: React.CSSProperties = {
  backgroundColor: '#2563eb',
  color: '#ffffff',
  border: 'none',
  padding: '4px 10px',
  borderRadius: '6px',
  fontSize: '11px',
  fontWeight: 600,
  cursor: 'pointer'
};

const dangerBtnStyle: React.CSSProperties = {
  backgroundColor: '#dc2626',
  color: '#ffffff',
  border: 'none',
  padding: '4px 10px',
  borderRadius: '6px',
  fontSize: '11px',
  fontWeight: 600,
  cursor: 'pointer'
};

const smallButtonStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
  color: '#e5e7eb',
  border: 'none',
  padding: '2px 6px',
  borderRadius: '4px',
  fontSize: '10px',
  cursor: 'pointer'
};
