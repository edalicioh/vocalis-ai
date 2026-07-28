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
  SavedConversation,
  ToneUpdatePayload,
  ConversationTone,
  MeetingMode
} from '@conversation-copilot/shared-types';
import { saveConversation, triggerMarkdownDownload } from '../shared/conversation-storage';
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

const speechManager = new SpeechManager();

interface CopilotOverlayProps {
  tabSessionId: string;
}

export const CopilotOverlay: React.FC<CopilotOverlayProps> = ({ tabSessionId }) => {

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
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [transcriptions, setTranscriptions] = useState<Utterance[]>([]);
  const [partialTranscript, setPartialTranscript] = useState<string>('');
  const [completedSuggestions, setCompletedSuggestions] = useState<Suggestion[]>([]);
  const [activeSuggestion, setActiveSuggestion] = useState<Suggestion | null>(null);
  const [detectedQuestion, setDetectedQuestion] = useState<QuestionDetectionResult | null>(null);

  // --- Tom da Conversa ---
  const [tone, setTone] = useState<ConversationTone>('neutro');
  const [toneConfidence, setToneConfidence] = useState<number>(0.5);
  const [toneSummary, setToneSummary] = useState<string>('');

  // --- Modo de Reunião ---
  const [meetingMode, setMeetingMode] = useState<MeetingMode>(() => {
    return (localStorage.getItem('copilotMeetingMode') as MeetingMode) || 'technical_interview';
  });

  const [isAudioActive, setIsAudioActive] = useState(false);

  const handleChangeMeetingMode = (newMode: MeetingMode) => {
    setMeetingMode(newMode);
    localStorage.setItem('copilotMeetingMode', newMode);
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

    if (mode === 'default') {
      setWidgetStates(prev => {
        const next = {
          ...prev,
          response: { visible: true, minimized: false },
          transcription: { visible: true, minimized: false }
        };
        saveWidgetStates(next);
        return next;
      });
    } else if (mode === 'compact') {
      setWidgetStates(prev => {
        const next = {
          ...prev,
          response: { visible: true, minimized: true },
          transcription: { visible: false, minimized: false }
        };
        saveWidgetStates(next);
        return next;
      });
    } else if (mode === 'reading') {
      setWidgetStates(prev => {
        const next = {
          ...prev,
          response: { visible: true, minimized: false },
          transcription: { visible: true, minimized: false }
        };
        saveWidgetStates(next);
        return next;
      });
    } else if (mode === 'keywords') {
      setWidgetStates(prev => {
        const next = {
          ...prev,
          response: { visible: true, minimized: false },
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
    chrome.runtime.sendMessage({ type: 'REGISTER_TAB_SESSION', sessionId: tabSessionId });

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
      const { isCapturing: nextCapturing } = (event as CustomEvent<{ isCapturing: boolean }>).detail;
      setIsCapturing(nextCapturing);
      setCaptureError(null);

      if (nextCapturing) {
        setWidgetStates(prev => {
          const next = {
            ...prev,
            functionBar: { ...prev.functionBar, visible: true },
            transcription: { visible: true, minimized: false },
            response: { visible: true, minimized: false }
          };
          saveWidgetStates(next);
          return next;
        });
        sendWsMessage({ type: 'session.start', payload: {} });
      } else {
        sendWsMessage({ type: 'session.stop', payload: {} });
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        setWidgetStates(prev => {
          const anyVisible = prev.response.visible || prev.transcription.visible;
          const next = {
            status: { visible: false, minimized: false },
            functionBar: { visible: true, minimized: false },
            response: { visible: !anyVisible, minimized: false },
            transcription: { visible: !anyVisible, minimized: false }
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

  const sendWsMessage = (msg: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ ...msg, sessionId: tabSessionId }));
    }
  };

  const connectWebSocket = () => {
    const ws = new WebSocket('ws://localhost:3001/ws');
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'session.register', sessionId: tabSessionId, payload: {} }));
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
    if (msg.sessionId && msg.sessionId !== tabSessionId) return;

    switch (msg.type) {
      case 'status.update':
      case 'STATUS_UPDATE' as any: {
        const payload = msg.payload as StatusUpdatePayload;
        setStatus(payload);
        setIsCapturing(payload.isCapturing || false);
        break;
      }

      case 'transcript.partial': {
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
        setActiveSuggestion({
          id: started.id,
          question: started.question,
          structured: {},
          rawText: '',
          timestamp: Date.now(),
          status: 'streaming'
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
        updateWidgetVisibility('response', true);

        if (!isTtsMuted) {
          const structured = completed.structured as StructuredAnswer | undefined;
          if (structured?.opening || structured?.answer) {
            speechManager.speakStructured(structured);
          } else if (suggestion.rawText) {
            speechManager.speak(suggestion.rawText);
          }
        }
        break;
      }

      case 'conversation.tone.updated': {
        const tonePayload = msg.payload as ToneUpdatePayload;
        setTone(tonePayload.tone);
        setToneConfidence(tonePayload.confidence);
        setToneSummary(tonePayload.summary);
        break;
      }
    }
  };

  // ========= Ações dos Widgets =========

  const handleToggleCapture = () => {
    const nextState = !isCapturing;

    if (nextState) {
      setCaptureError(null);
      setWidgetStates(prev => {
        const next = {
          ...prev,
          functionBar: { ...prev.functionBar, visible: true },
          transcription: { visible: true, minimized: false },
          response: { visible: true, minimized: false }
        };
        saveWidgetStates(next);
        return next;
      });

      chrome.runtime.sendMessage(
        { type: 'START_CAPTURE', sessionId: tabSessionId },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('[Overlay] Erro ao iniciar captura:', chrome.runtime.lastError.message);
            setIsCapturing(false);
          } else if (response?.status === 'ok') {
            setIsCapturing(true);
            setCaptureError(null);
            sendWsMessage({ type: 'session.start', payload: {} });
          } else if (response?.status === 'need_invocation') {
            setIsCapturing(false);
            setCaptureError('Abra o popup da extensão e inicie a captura por ele.');
          } else if (response?.status === 'error') {
            console.error('[Overlay] Falha ao iniciar captura:', response.error);
            setIsCapturing(false);
            setCaptureError(response.error || 'Não foi possível iniciar a captura de áudio.');
          } else {
            console.error('[Overlay] O service worker não confirmou o início da captura.');
            setIsCapturing(false);
            setCaptureError('O Chrome não confirmou o início da captura.');
          }
        }
      );
    } else {
      setIsCapturing(false);
      sendWsMessage({ type: 'session.stop', payload: {} });
      chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' });
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
      id: tabSessionId,
      title: document.title || 'Reunião Copiloto',
      url: window.location.href,
      timestamp: Date.now(),
      transcriptions,
      suggestions: completedSuggestions
    };
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

      {/* Widget 2: Painel de Resposta */}
      {widgetStates.response.visible && (
        <ResponsePanelWidget
          position={widgetPositions.response}
          onPositionChange={pos => updateWidgetPosition('response', pos)}
          dimensions={widgetDimensions.response}
          onDimensionsChange={dimensions => updateWidgetDimensions('response', dimensions)}
          suggestion={latestSuggestion}
          streamingContent={activeSuggestion?.rawText || ''}
          isStreaming={!!activeSuggestion}
          question={detectedQuestion}
          onClose={() => updateWidgetVisibility('response', false)}
          onToggleMinimize={() => toggleWidgetMinimized('response')}
          isMinimized={widgetStates.response.minimized}
          onSpeak={handleSpeakText}
          isSpeaking={isTtsSpeaking}
          onStopSpeech={handleStopSpeech}
          activeSentenceIndex={activeSentenceIndex}
          opacity={opacity}
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
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
