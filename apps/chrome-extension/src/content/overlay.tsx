import React, { useState, useEffect, useRef } from 'react';
import { SpeechManager } from '../tts/speech-manager';
import { SettingsForm } from '../shared/settings-form';
import {
  Utterance,
  Suggestion,
  WSMessage,
  StatusUpdatePayload,
  StructuredAnswer,
  QuestionDetectionResult,
  AnswerStartedPayload,
  AnswerDeltaPayload,
  AnswerCompletedPayload,
  AnswerCancelledPayload,
  SavedConversation,
  ToneUpdatePayload,
  ConversationTone,
  MeetingMode,
  ConversationSummary,
  ConversationSummaryStatus,
  ConversationSummaryUpdatePayload,
  UiLanguage
} from '@conversation-copilot/shared-types';
import { saveConversation, triggerMarkdownDownload, serializeConversationSummary, patchConversationAudioKey } from '../shared/conversation-storage';
import {
  WidgetId,
  WidgetDimensions,
  WidgetDimensionsMap,
  WidgetPositionsMap,
  WidgetStatesMap,
  HUDLayoutMode,
  loadWidgetPositions,
  saveWidgetPositions,
  loadWidgetDimensions,
  saveWidgetDimensions,
  loadWidgetStates,
  saveWidgetStates,
  loadHUDLayoutMode,
  saveHUDLayoutMode,
  loadOpacity,
  saveOpacity
} from './widget-state';
import { FunctionBarWidget } from './widgets/FunctionBarWidget';
import { ResponsePanelWidget } from './widgets/ResponsePanelWidget';
import { TranscriptionWidget } from './widgets/TranscriptionWidget';
import { createSessionId } from './session-id';
import { normalizeMeetingMode } from '../shared/meeting-mode';

const speechManager = new SpeechManager();

const EMPTY_SUMMARY: ConversationSummary = {
  topics: [],
  previousQuestions: [],
  technologies: [],
  decisions: [],
  actionItems: [],
  summaryText: '',
  lastUpdated: 0
};

interface CopilotOverlayProps {
  tabSessionId: string;
  externalCaptureState?: boolean;
  createTabSessionId?: () => string;
  onSessionIdChange?: (sessionId: string) => void;
  onCaptureStateChange?: (isCapturing: boolean) => void;
}

export const CopilotOverlay: React.FC<CopilotOverlayProps> = ({
  tabSessionId,
  externalCaptureState,
  createTabSessionId,
  onSessionIdChange,
  onCaptureStateChange
}) => {

  // --- Estados e Posições dos Widgets HUD ---
  const [widgetPositions, setWidgetPositions] = useState<WidgetPositionsMap>(loadWidgetPositions);
  const [widgetDimensions, setWidgetDimensions] = useState<WidgetDimensionsMap>(loadWidgetDimensions);
  const [widgetStates, setWidgetStates] = useState<WidgetStatesMap>(loadWidgetStates);
  const [hudLayoutMode, setHudLayoutMode] = useState<HUDLayoutMode>(loadHUDLayoutMode);

  // --- Modal de Configurações ---
  const [showSettings, setShowSettings] = useState(false);
  const [opacity, setOpacity] = useState<number>(loadOpacity);

  // --- Transcrição, Pergunta e Sugestões ---
  const [status, setStatus] = useState<StatusUpdatePayload>({
    whisperConnected: false,
    llmConfigured: false,
    isCapturing: false
  });
  const [isCapturing, setIsCapturing] = useState(false);
  const isCapturingRef = useRef(false);
  const [isCapturePending, setIsCapturePending] = useState(false);
  const capturePendingRef = useRef(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  // --- Gravação local do áudio completo (audioKey = sessionId no IndexedDB) ---
  const audioKeyRef = useRef<string | null>(null);
  const savedSessionIdRef = useRef<string | null>(null);
  const [audioRecordingActive, setAudioRecordingActive] = useState(false);
  const [transcriptions, setTranscriptions] = useState<Utterance[]>([]);
  const [partialTranscript, setPartialTranscript] = useState<string>('');
  const [completedSuggestions, setCompletedSuggestions] = useState<Suggestion[]>([]);
  const [activeSuggestion, setActiveSuggestion] = useState<Suggestion | null>(null);
  const [detectedQuestion, setDetectedQuestion] = useState<QuestionDetectionResult | null>(null);

  // --- Tom da Conversa ---
  const [tone, setTone] = useState<ConversationTone>('neutro');
  const [toneConfidence, setToneConfidence] = useState<number>(0.5);
  const [toneSummary, setToneSummary] = useState<string>('');

  // --- Resumo Contínuo da Conversa (RF-018) ---
  const [summaryStatus, setSummaryStatus] = useState<ConversationSummaryStatus>('idle');
  const [summary, setSummary] = useState<ConversationSummary>(EMPTY_SUMMARY);

  // --- Modo de Reunião e Idioma ---
  const [meetingMode, setMeetingMode] = useState<MeetingMode>(() => {
    try {
      return normalizeMeetingMode(localStorage.getItem('copilotMeetingMode'));
    } catch (e) {
      return 'technical_interview';
    }
  });

  const [uiLanguage, setUiLanguage] = useState<UiLanguage>(() => {
    return (localStorage.getItem('copilotUiLanguage') as UiLanguage) || 'pt-BR';
  });

  const [isAudioActive, setIsAudioActive] = useState(false);

  const handleChangeMeetingMode = (newMode: MeetingMode) => {
    setMeetingMode(newMode);
    try {
      localStorage.setItem('copilotMeetingMode', newMode);
    } catch (e) {}
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.set({ meetingMode: newMode });
      }
    } catch (e) {}
    const storedNotes = localStorage.getItem('copilotModeNotes');
    let modeNotes = {};
    if (storedNotes) {
      try { modeNotes = JSON.parse(storedNotes); } catch (e) {}
    }
    sendWsMessage({
      type: 'settings.update',
      payload: { meetingMode: newMode, modeNotes }
    });
  };

  // --- TTS State ---
  const [isTtsMuted, setIsTtsMuted] = useState(false);
  const [ttsRate, setTtsRate] = useState(1.0);
  const [isTtsSpeaking, setIsTtsSpeaking] = useState(false);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef(tabSessionId);
  const pendingSessionStartRef = useRef<string | null>(null);

  // ========= Handlers de Posição e Estado =========

  const updateWidgetPosition = (id: WidgetId, pos: { x: number; y: number }) => {
    setWidgetPositions(prev => {
      const next = { ...prev, [id]: pos };
      saveWidgetPositions(next);
      return next;
    });
  };

  const updateWidgetDimensions = (id: WidgetId, dimensions: WidgetDimensions) => {
    setWidgetDimensions(prev => {
      const next = { ...prev, [id]: dimensions };
      saveWidgetDimensions(next);
      return next;
    });
  };

  const updateWidgetVisibility = (id: WidgetId, visible: boolean) => {
    if (visible && (id === 'response' || id === 'transcription') && !isCapturingRef.current) return;

    setWidgetStates(prev => {
      const next = { ...prev, [id]: { ...prev[id], visible } };
      saveWidgetStates(next);
      return next;
    });
  };

  const toggleWidgetMinimized = (id: WidgetId) => {
    setWidgetStates(prev => {
      const next = { ...prev, [id]: { ...prev[id], minimized: !prev[id].minimized } };
      saveWidgetStates(next);
      return next;
    });
  };

  const handleChangeHudMode = (mode: HUDLayoutMode) => {
    setHudLayoutMode(mode);
    saveHUDLayoutMode(mode);
    const showCapturePanels = isCapturingRef.current;

    if (mode === 'default') {
      setWidgetStates(prev => {
        const next = {
          ...prev,
          response: { visible: showCapturePanels, minimized: false },
          transcription: { visible: showCapturePanels, minimized: false }
        };
        saveWidgetStates(next);
        return next;
      });
    } else if (mode === 'compact') {
      setWidgetStates(prev => {
        const next = {
          ...prev,
          response: { visible: showCapturePanels, minimized: true },
          transcription: { visible: false, minimized: false }
        };
        saveWidgetStates(next);
        return next;
      });
    } else if (mode === 'reading') {
      setWidgetStates(prev => {
        const next = {
          ...prev,
          response: { visible: showCapturePanels, minimized: false },
          transcription: { visible: showCapturePanels, minimized: false }
        };
        saveWidgetStates(next);
        return next;
      });
    } else if (mode === 'keywords') {
      setWidgetStates(prev => {
        const next = {
          ...prev,
          response: { visible: showCapturePanels, minimized: false },
          transcription: { visible: false, minimized: false }
        };
        saveWidgetStates(next);
        return next;
      });
    }
  };

  // ========= Conexão WebSocket & Atalhos =========

  useEffect(() => {
    connectWebSocket();
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
        chrome.runtime.sendMessage({ type: 'REGISTER_TAB_SESSION', sessionId: sessionIdRef.current }).catch(() => {});
      }
    } catch {
      // Ignorar se o contexto da extensão foi invalidado ao recarregar
    }

    speechManager.setOnSentenceStart((index) => {
      setActiveSentenceIndex(index);
      setIsTtsSpeaking(true);
    });
    speechManager.setOnSpeechEnd(() => {
      setActiveSentenceIndex(null);
      setIsTtsSpeaking(false);
    });

    const handleForceTrigger = () => {
      sendWsMessage({ type: 'answer.force', payload: {} });
    };

    const handleCaptureStateChange = (event: Event) => {
      const detail = (event as CustomEvent<{ isCapturing: boolean; sessionId?: string }>).detail;
      handleExternalCaptureState(detail.isCapturing, detail.sessionId);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        if (!isCapturingRef.current) return;
        setWidgetStates(prev => {
          const anyVisible = prev.response.visible || prev.transcription.visible;
          const next = {
            ...prev,
            response: { ...prev.response, visible: !anyVisible },
            transcription: { ...prev.transcription, visible: !anyVisible }
          };
          saveWidgetStates(next);
          return next;
        });
      } else if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        sendWsMessage({ type: 'answer.force', payload: {} });
      } else if (e.key === 'Escape') {
        setShowSettings(false);
      }
    };

    const handleRuntimeMessage = (msg: any) => {
      if (msg.type === 'AUDIO_VAD_STATE') {
        setIsAudioActive(msg.isAudioActive === true);
      } else if (msg.type === 'SETTINGS_UPDATED') {
        sendWsMessage({ type: 'settings.update', payload: msg.payload });
      }
    };

    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    window.addEventListener('copilot:force-trigger', handleForceTrigger);
    window.addEventListener('copilot:capture-state-changed', handleCaptureStateChange);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      wsRef.current?.close();
      speechManager.cancel();
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
      window.removeEventListener('copilot:force-trigger', handleForceTrigger);
      window.removeEventListener('copilot:capture-state-changed', handleCaptureStateChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    sessionIdRef.current = tabSessionId;
  }, [tabSessionId]);

  useEffect(() => {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.get(['meetingMode'], (res) => {
          const normalized = normalizeMeetingMode(res.meetingMode);
          setMeetingMode(normalized);
          try {
            localStorage.setItem('copilotMeetingMode', normalized);
          } catch (e) {}
        });
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (typeof externalCaptureState !== 'boolean') return;
    handleExternalCaptureState(externalCaptureState, tabSessionId);
  }, [externalCaptureState, tabSessionId]);

  const sendWsMessage = (msg: any, sessionId: string = sessionIdRef.current) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ ...msg, sessionId }));
    }
  };

  const applyCaptureState = (nextCapturing: boolean) => {
    isCapturingRef.current = nextCapturing;
    setIsCapturing(nextCapturing);
    setWidgetStates(prev => {
      const next = {
        ...prev,
        functionBar: { ...prev.functionBar, visible: true },
        transcription: { visible: nextCapturing, minimized: false },
        response: { visible: nextCapturing, minimized: false }
      };
      saveWidgetStates(next);
      return next;
    });
  };

  const loadSessionSettings = (): Promise<Record<string, unknown>> => {
    return new Promise(resolve => {
      chrome.storage.local.get([
        'aiProvider', 'geminiApiKey', 'geminiModel', 'openaiApiKey', 'openaiModel', 'anthropicApiKey', 'anthropicModel',
        'ollamaEndpoint', 'ollamaModel', 'customProxyEndpoint', 'customProxyApiKey', 'customProxyModel',
        'meetingMode', 'conversationAnalysisMode', 'responseMode', 'name', 'role', 'seniority', 'skills', 'experiences'
      ], (stored) => {
        resolve({
          aiProvider: stored.aiProvider || 'gemini',
          geminiApiKey: stored.geminiApiKey,
          geminiModel: stored.geminiModel,
          openaiApiKey: stored.openaiApiKey,
          openaiModel: stored.openaiModel,
          anthropicApiKey: stored.anthropicApiKey,
          anthropicModel: stored.anthropicModel,
          ollamaEndpoint: stored.ollamaEndpoint,
          ollamaModel: stored.ollamaModel,
          customProxyEndpoint: stored.customProxyEndpoint,
          customProxyApiKey: stored.customProxyApiKey,
          customProxyModel: stored.customProxyModel,
          meetingMode: stored.meetingMode,
          conversationAnalysisMode: stored.conversationAnalysisMode === 'hybrid' ? 'hybrid' : 'local',
          responseMode: stored.responseMode,
          userProfile: {
            name: stored.name,
            role: stored.role,
            seniority: stored.seniority,
            skills: stored.skills ? String(stored.skills).split(',').map(s => s.trim()) : [],
            experiences: stored.experiences ? String(stored.experiences).split(';').map(s => s.trim()) : []
          }
        });
      });
    });
  };

  const bootstrapSession = async (
    sessionId: string,
    shouldStart: boolean,
    socket: WebSocket | null = wsRef.current
  ) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      if (shouldStart) pendingSessionStartRef.current = sessionId;
      return;
    }

    socket.send(JSON.stringify({ type: 'session.register', sessionId, payload: {} }));
    const settings = await loadSessionSettings();
    if (
      socket.readyState !== WebSocket.OPEN
      || wsRef.current !== socket
      || sessionIdRef.current !== sessionId
    ) return;

    socket.send(JSON.stringify({ type: 'settings.update', sessionId, payload: settings }));
    if (
      shouldStart
      && (isCapturingRef.current || pendingSessionStartRef.current === sessionId)
    ) {
      socket.send(JSON.stringify({ type: 'session.start', sessionId, payload: {} }));
      pendingSessionStartRef.current = null;
    }
  };

  const resetSessionUi = () => {
    setTranscriptions([]);
    setPartialTranscript('');
    setCompletedSuggestions([]);
    setActiveSuggestion(null);
    setDetectedQuestion(null);
    setTone('neutro');
    setToneConfidence(0.5);
    setToneSummary('');
    setSummary(EMPTY_SUMMARY);
    setSummaryStatus('idle');
    setIsAudioActive(false);
    speechManager.cancel();
    setIsTtsSpeaking(false);
    setActiveSentenceIndex(null);
  };

  const startSession = (sessionId: string) => {
    if (isCapturingRef.current && sessionIdRef.current === sessionId) return;

    sessionIdRef.current = sessionId;
    onSessionIdChange?.(sessionId);
    pendingSessionStartRef.current = sessionId;
    resetSessionUi();
    setCaptureError(null);
    applyCaptureState(true);
    onCaptureStateChange?.(true);

    try {
      chrome.runtime.sendMessage({ type: 'REGISTER_TAB_SESSION', sessionId }).catch(() => {});
    } catch {
      // Ignorar se o contexto da extensão foi invalidado ao recarregar
    }
    void bootstrapSession(sessionId, true);
  };

  const handleExternalCaptureState = (nextCapturing: boolean, sessionId?: string) => {
    if (nextCapturing) {
      startSession(sessionId || sessionIdRef.current);
      return;
    }

    if (!isCapturingRef.current) return;
    const stoppedSessionId = sessionIdRef.current;
    pendingSessionStartRef.current = null;
    applyCaptureState(false);
    setIsAudioActive(false);
    onCaptureStateChange?.(false);
    sendWsMessage({ type: 'session.stop', payload: {} }, stoppedSessionId);
  };

  const connectWebSocket = () => {
    const wsUrl = import.meta.env.VITE_ORCHESTRATOR_WS_URL || 'ws://localhost:3001/ws';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      const currentSessionId = sessionIdRef.current;
      const shouldStart = isCapturingRef.current || pendingSessionStartRef.current === currentSessionId;
      void bootstrapSession(currentSessionId, shouldStart, ws);
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        handleMessage(msg);
      } catch (err) {
        console.error('[Overlay] Erro ao decodificar WS:', err);
      }
    };

    ws.onclose = () => {
      setTimeout(connectWebSocket, 3000);
    };
  };

  const handleMessage = (msg: WSMessage) => {
    if (msg.sessionId && msg.sessionId !== sessionIdRef.current) return;

    switch (msg.type) {
      case 'status.update':
      case 'STATUS_UPDATE' as any: {
        const payload = msg.payload as StatusUpdatePayload;
        setStatus(payload);
        const isWaitingForStart = pendingSessionStartRef.current === sessionIdRef.current;
        if (!isWaitingForStart || payload.isCapturing) {
          applyCaptureState(payload.isCapturing === true);
        }
        break;
      }

      case 'transcript.partial': {
        setStatus(prev => ({ ...prev, whisperConnected: true }));
        const p = msg.payload as any;
        const text = typeof p === 'string' ? p : (p?.text || p?.utterance || '');
        if (text) {
          setPartialTranscript(text);
          updateWidgetVisibility('transcription', true);
        }
        break;
      }

      case 'transcript.final':
      case 'TRANSCRIPTION_DELTA' as any: {
        setStatus(prev => ({ ...prev, whisperConnected: true }));
        const p = msg.payload as any;
        setPartialTranscript('');
        if (p) {
          const item: Utterance = {
            id: p.id || 'u-' + Date.now(),
            speaker: p.speaker || 'interviewer',
            text: typeof p === 'string' ? p : (p?.text || p?.utterance || ''),
            timestamp: p.timestamp || Date.now(),
            isFinal: true
          };
          if (item.text) {
            setTranscriptions(prev => [...prev.slice(-15), item]);
            updateWidgetVisibility('transcription', true);
          }
        }
        break;
      }

      case 'question.detected': {
        const detection = msg.payload as QuestionDetectionResult;
        setDetectedQuestion(detection);
        speechManager.cancel();
        setIsTtsSpeaking(false);
        setActiveSentenceIndex(null);
        updateWidgetVisibility('response', true);
        break;
      }

      case 'answer.started': {
        const started = msg.payload as AnswerStartedPayload;
        // Preserva a sugestão anterior se já havia uma em andamento
        setActiveSuggestion(prev => {
          if (prev?.rawText?.trim()) {
            const savedItem: Suggestion = {
              id: prev.id,
              question: prev.question,
              structured: prev.structured || {},
              rawText: prev.rawText || 'Resposta interrompida por nova pergunta.',
              timestamp: prev.timestamp,
              status: 'complete'
            };
            setCompletedSuggestions(history => [savedItem, ...history.filter(s => s.id !== savedItem.id)]);
          }
          return {
            id: started.id,
            question: started.question,
            structured: {},
            rawText: '',
            timestamp: Date.now(),
            status: 'streaming'
          };
        });
        updateWidgetVisibility('response', true);
        break;
      }

      case 'answer.delta':
      case 'SUGGESTION_STREAM' as any: {
        const delta = msg.payload as AnswerDeltaPayload | any;
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
        updateWidgetVisibility('response', true);
        break;
      }

      case 'answer.completed':
      case 'SUGGESTION_COMPLETE' as any: {
        const completed = msg.payload as AnswerCompletedPayload | any;
        const structuredText = [completed.structured?.opening, completed.structured?.answer]
          .filter(Boolean)
          .join(' ');
        setActiveSuggestion(prev => {
          if (!prev || prev.id !== completed.id) return prev;

          const suggestion: Suggestion = {
            id: completed.id,
            question: prev.question || completed.question || '',
            structured: completed.structured || {},
            rawText: structuredText || completed.answer || prev.rawText || '',
            timestamp: Date.now(),
            status: 'complete'
          };
          setCompletedSuggestions(history => [suggestion, ...history.filter(s => s.id !== suggestion.id)]);

          if (!isTtsMuted) {
            const structured = completed.structured as StructuredAnswer | undefined;
            if (structured?.opening || structured?.answer) {
              speechManager.speakStructured(structured);
            } else if (suggestion.rawText) {
              speechManager.speak(suggestion.rawText);
            }
          }

          return null;
        });
        setDetectedQuestion(null);
        updateWidgetVisibility('response', true);
        break;
      }

      case 'answer.cancelled': {
        const cancelled = msg.payload as AnswerCancelledPayload;
        setActiveSuggestion(prev => prev?.id === cancelled.id ? null : prev);
        break;
      }

      case 'answer.failed': {
        const failedPayload = msg.payload as any;
        setActiveSuggestion(prev => {
          if (prev) {
            const savedItem: Suggestion = {
              id: prev.id,
              question: prev.question,
              structured: prev.structured || {},
              rawText: prev.rawText || `Falha na geração: ${failedPayload?.error || 'Erro de conexão'}`,
              timestamp: prev.timestamp,
              status: 'error'
            };
            setCompletedSuggestions(history => [savedItem, ...history.filter(s => s.id !== savedItem.id)]);
          }
          return null;
        });
        setDetectedQuestion(null);
        break;
      }

      case 'conversation.tone.updated': {
        const tonePayload = msg.payload as ToneUpdatePayload;
        setTone(tonePayload.tone);
        setToneConfidence(tonePayload.confidence);
        setToneSummary(tonePayload.summary);
        break;
      }

      case 'conversation.summary.updated': {
        const summaryPayload = msg.payload as ConversationSummaryUpdatePayload;
        setSummary(summaryPayload.summary || EMPTY_SUMMARY);
        setSummaryStatus(summaryPayload.status);
        break;
      }
    }
  };

  // ========= Ações dos Widgets =========

  const handleToggleCapture = () => {
    if (capturePendingRef.current) return;
    const nextState = !isCapturingRef.current;
    capturePendingRef.current = true;
    setIsCapturePending(true);

    if (nextState) {
      setCaptureError(null);
      const requestedSessionId = createTabSessionId?.() || createSessionId();

      chrome.runtime.sendMessage(
        { type: 'START_CAPTURE', sessionId: requestedSessionId },
        (response) => {
          capturePendingRef.current = false;
          setIsCapturePending(false);
          if (chrome.runtime.lastError) {
            console.error('[Overlay] Erro ao iniciar captura:', chrome.runtime.lastError.message);
            applyCaptureState(false);
          } else if (response?.status === 'ok') {
            audioKeyRef.current = null;
            savedSessionIdRef.current = null;
            setAudioRecordingActive(response.audioRecordingEnabled === true);
            startSession(response.sessionId || requestedSessionId);
          } else if (response?.status === 'need_invocation') {
            applyCaptureState(false);
            setCaptureError('Abra o popup da extensão e inicie a captura por ele.');
          } else if (response?.status === 'error') {
            console.error('[Overlay] Falha ao iniciar captura:', response.error);
            applyCaptureState(false);
            setCaptureError(response.error || 'Não foi possível iniciar a captura de áudio.');
          } else {
            console.error('[Overlay] O service worker não confirmou o início da captura.');
            applyCaptureState(false);
            setCaptureError('O Chrome não confirmou o início da captura.');
          }
        }
      );
    } else {
      const stoppedSessionId = sessionIdRef.current;
      sendWsMessage({ type: 'session.stop', payload: {} }, stoppedSessionId);
      chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' }, (response) => {
        capturePendingRef.current = false;
        setIsCapturePending(false);
        setAudioRecordingActive(false);
        if (chrome.runtime.lastError || response?.status !== 'ok') {
          setCaptureError(response?.error || chrome.runtime.lastError?.message || 'Não foi possível parar a captura.');
        }
        if (response?.audioKey) {
          audioKeyRef.current = response.audioKey;
          if (savedSessionIdRef.current === stoppedSessionId) {
            void patchConversationAudioKey(stoppedSessionId, response.audioKey);
          }
        } else {
          audioKeyRef.current = null;
        }
        applyCaptureState(false);
        setIsAudioActive(false);
        onCaptureStateChange?.(false);
      });
    }
  };

  const handleSpeakText = (text: string) => {
    if (!text) return;
    if (isTtsSpeaking) {
      speechManager.cancel();
      setIsTtsSpeaking(false);
    } else {
      speechManager.speak(text);
    }
  };

  const handleStopSpeech = () => {
    speechManager.cancel();
    setIsTtsSpeaking(false);
  };

  const handleSaveSession = () => {
    const conv: SavedConversation = {
      id: sessionIdRef.current,
      title: document.title || 'Reunião Copiloto',
      url: window.location.href,
      timestamp: Date.now(),
      transcriptions,
      suggestions: completedSuggestions,
      summary: summaryStatus === 'ready' && summary.summaryText
        ? serializeConversationSummary(summary)
        : undefined,
      audioKey: audioKeyRef.current ?? undefined
    };
    savedSessionIdRef.current = conv.id;
    saveConversation(conv);
    triggerMarkdownDownload(conv);
  };

  const latestSuggestion = completedSuggestions[0] || null;

  return (
    <>
      {/* Widget 1: Barra de Funções (Com Status da Conexão Integrado) */}
      {widgetStates.functionBar.visible && (
        <FunctionBarWidget
          position={widgetPositions.functionBar}
          onPositionChange={pos => updateWidgetPosition('functionBar', pos)}
          status={status}
          isCapturing={isCapturing}
          isCapturePending={isCapturePending}
          onToggleCapture={handleToggleCapture}
          isGenerating={!!activeSuggestion}
          isSpeaking={isTtsSpeaking}
          onStopSpeech={handleStopSpeech}
          ttsMuted={isTtsMuted}
          onToggleMute={() => {
            const next = !isTtsMuted;
            setIsTtsMuted(next);
            speechManager.setMuted(next);
          }}
          ttsRate={ttsRate}
          onChangeTtsRate={rate => {
            setTtsRate(rate);
            speechManager.setRate(rate);
          }}
          hudMode={hudLayoutMode}
          onChangeHudMode={handleChangeHudMode}
          onForceSuggestion={() => sendWsMessage({ type: 'answer.force', payload: {} })}
          onSaveSession={handleSaveSession}
          onOpenSettings={() => setShowSettings(true)}
          opacity={opacity}
          onOpacityChange={(nextOpacity) => {
            setOpacity(nextOpacity);
            saveOpacity(nextOpacity);
          }}
          tone={tone}
          toneConfidence={toneConfidence}
          toneSummary={toneSummary}
          meetingMode={meetingMode}
          onChangeMeetingMode={handleChangeMeetingMode}
          isAudioActive={isAudioActive}
          uiLanguage={uiLanguage}
        />
      )}

      {captureError && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            left: `${widgetPositions.functionBar.x}px`,
            top: `${Math.max(8, widgetPositions.functionBar.y - 54)}px`,
            width: '340px',
            boxSizing: 'border-box',
            zIndex: 1000000,
            padding: '8px 12px',
            borderRadius: '10px',
            backgroundColor: 'rgba(120, 53, 15, 0.96)',
            border: '1px solid rgba(251, 191, 36, 0.55)',
            color: '#fef3c7',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '12px',
            lineHeight: 1.4,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)'
          }}
        >
          {captureError}
        </div>
      )}

      {audioRecordingActive && isCapturing && (
        <div
          role="status"
          style={{
            position: 'fixed',
            right: '16px',
            bottom: '16px',
            zIndex: 1000001,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '8px',
            backgroundColor: 'rgba(127, 29, 29, 0.96)',
            border: '1px solid rgba(239, 68, 68, 0.6)',
            color: '#fecaca',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '11px',
            fontWeight: 600,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)'
          }}
        >
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
          GRAVANDO ÁUDIO LOCAL
        </div>
      )}

      {/* Widget 2: Painel de Resposta */}
      {widgetStates.response.visible && (
        <ResponsePanelWidget
          position={widgetPositions.response}
          onPositionChange={pos => updateWidgetPosition('response', pos)}
          dimensions={widgetDimensions.response}
          onDimensionsChange={dimensions => updateWidgetDimensions('response', dimensions)}
          suggestion={latestSuggestion}
          suggestions={completedSuggestions}
          streamingContent={activeSuggestion?.rawText || ''}
          isStreaming={!!activeSuggestion}
          question={activeSuggestion ? {
            isQuestion: true,
            score: 1,
            reasons: [],
            questionText: activeSuggestion.question
          } : detectedQuestion}
          onClose={() => updateWidgetVisibility('response', false)}
          onToggleMinimize={() => toggleWidgetMinimized('response')}
          isMinimized={widgetStates.response.minimized}
          onSpeak={handleSpeakText}
          isSpeaking={isTtsSpeaking}
          onStopSpeech={handleStopSpeech}
          activeSentenceIndex={activeSentenceIndex}
          opacity={opacity}
          uiLanguage={uiLanguage}
        />
      )}

      {/* Widget 3: Painel de Transcrição */}
      {widgetStates.transcription.visible && (
        <TranscriptionWidget
          position={widgetPositions.transcription}
          onPositionChange={pos => updateWidgetPosition('transcription', pos)}
          dimensions={widgetDimensions.transcription}
          onDimensionsChange={dimensions => updateWidgetDimensions('transcription', dimensions)}
          utterances={transcriptions}
          partialTranscript={partialTranscript}
          summary={summary}
          summaryStatus={summaryStatus}
          onClose={() => updateWidgetVisibility('transcription', false)}
          onToggleMinimize={() => toggleWidgetMinimized('transcription')}
          isMinimized={widgetStates.transcription.minimized}
          opacity={opacity}
        />
      )}

      {/* Modal de Configurações */}
      {showSettings && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000000,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            style={{
              width: '460px',
              maxHeight: '85vh',
              backgroundColor: '#0f0f23',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '16px',
              boxShadow: '0 16px 48px rgba(0, 0, 0, 0.6)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                fontWeight: 600
              }}
            >
              <span>Configurações do Copiloto</span>
              <button
                onClick={() => setShowSettings(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: '16px', overflowY: 'auto' }}>
              <SettingsForm
                opacity={opacity}
                onOpacityChange={(nextOpacity) => {
                  setOpacity(nextOpacity);
                  saveOpacity(nextOpacity);
                }}
                onSave={(payload) => sendWsMessage({ type: 'settings.update', payload })}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
