import type { AudioSource, SessionRegisterPayload, WSMessage } from '@conversation-copilot/shared-types';
import {
  initializeAudioRecording,
  saveAudioChunk,
  completeAudioRecording,
  cleanupOrphanAudioRecordings,
  MAX_AUDIO_RECORDING_SIZE
} from './audio-recorder-storage';

const audioSockets: Record<AudioSource, WebSocket | null> = {
  tab: null,
  microphone: null
};
let audioContext: AudioContext | null = null;
let tabStream: MediaStream | null = null;
let micStream: MediaStream | null = null;
let tabSourceNode: MediaStreamAudioSourceNode | null = null;
let micSourceNode: MediaStreamAudioSourceNode | null = null;
let audioWorkletNode: AudioWorkletNode | null = null;
let sentAudioChunks = 0;

let activeSessionId: string | null = null;

// --- Gravação local do áudio completo da chamada (MediaRecorder → IndexedDB) ---
let recordingDestination: MediaStreamAudioDestinationNode | null = null;
let mediaRecorder: MediaRecorder | null = null;
let recordedBytes = 0;
let recordingTruncated = false;
let finalizingRecording = false;
let nextChunkIndex = 0;
let recordedSessionId: string | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();

function enqueueWrite<T>(op: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(op, op);
  writeQueue = result.then(() => undefined, () => undefined);
  return result;
}
const vadState: Record<AudioSource, { isAudioActive: boolean; rms: number }> = {
  tab: { isAudioActive: false, rms: 0 },
  microphone: { isAudioActive: false, rms: 0 }
};

function registerAudioSocket(ws: WebSocket, source: AudioSource) {
  if (!activeSessionId) return;

  const message: WSMessage<SessionRegisterPayload> = {
    type: 'session.register',
    sessionId: activeSessionId,
    payload: { audioSource: source }
  };
  ws.send(JSON.stringify(message));
}

function connectWebSocket(source: AudioSource) {
  const currentSocket = audioSockets[source];
  if (currentSocket && (currentSocket.readyState === WebSocket.OPEN || currentSocket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const whisperWsUrl = (import.meta as any).env?.VITE_WHISPER_WS_URL || 'ws://localhost:8000/ws/transcribe';
  const orchestratorWsUrl = (import.meta as any).env?.VITE_ORCHESTRATOR_WS_URL || 'ws://localhost:3001/ws';
  const useDirectWhisper = (import.meta as any).env?.VITE_DIRECT_WHISPER === 'true';
  const wsUrl = useDirectWhisper ? whisperWsUrl : orchestratorWsUrl;
  const destination = useDirectWhisper ? 'Whisper' : 'Orquestrador';

  const ws = new WebSocket(wsUrl);
  audioSockets[source] = ws;
  ws.binaryType = 'arraybuffer';

  ws.onopen = () => {
    console.log(`[Offscreen] Canal de áudio ${source} conectado ao ${destination}.`);
    registerAudioSocket(ws, source);
  };

  ws.onclose = () => {
    if (audioSockets[source] === ws) {
      audioSockets[source] = null;
    }
    console.log(`[Offscreen] Canal de áudio ${source} fechado. Tentando reconectar...`);
    setTimeout(() => connectWebSocket(source), 3000);
  };

  ws.onerror = (err) => {
    console.error(`[Offscreen] Erro no canal de áudio ${source}:`, err);
  };
}

connectWebSocket('tab');
connectWebSocket('microphone');

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'INIT_AUDIO_CAPTURE' && message.streamId) {
    if (message.sessionId) {
      activeSessionId = message.sessionId;
      for (const source of ['tab', 'microphone'] as const) {
        const ws = audioSockets[source];
        if (ws && ws.readyState === WebSocket.OPEN) {
          registerAudioSocket(ws, source);
        }
      }
    }
    void startCapture(message.streamId, message.rmsThreshold, message.enableRecording === true);
  } else if (message.type === 'STOP_AUDIO_CAPTURE') {
    stopCapture()
      .then(() => sendResponse({
        audioKey: recordedSessionId,
        audioAvailable: recordedSessionId !== null
      }))
      .catch((err) => {
        console.error('[Offscreen] Erro ao encerrar a gravação de áudio:', err);
        sendResponse({ audioKey: null, audioAvailable: false });
      });
    return true;
  } else if (message.type === 'SET_RMS_THRESHOLD' && typeof message.rmsThreshold === 'number') {
    if (audioWorkletNode) {
      audioWorkletNode.port.postMessage({ rmsThreshold: message.rmsThreshold });
    }
  }
});

async function startCapture(streamId: string, initialRmsThreshold?: number, enableRecording = false) {
  try {
    await stopCapture(false);

    // 1. Obter o fluxo da aba (áudio da reunião / entrevistador)
    tabStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        // @ts-ignore
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      },
      video: false
    });

    // 2. Obter o fluxo do microfone (voz do próprio usuário)
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });
      console.log('[Offscreen] Microfone local (sua voz) capturado com sucesso.');
    } catch (micErr: any) {
      const errName = micErr?.name || 'DOMException';
      const errMsg = micErr?.message || String(micErr);
      console.info(`[Offscreen] Microfone local indisponível ou permissão negada (${errName}: ${errMsg}). Continuando apenas com o áudio da aba.`);
    }

    // 3. Criar AudioContext configurado em 16kHz
    audioContext = new AudioContext({ sampleRate: 16000 });

    await audioContext.audioWorklet.addModule(chrome.runtime.getURL('pcm-worklet.js'));
    audioWorkletNode = new AudioWorkletNode(audioContext, 'pcm-capture-processor', {
      numberOfInputs: 2,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      channelCount: 1,
      channelCountMode: 'explicit',
      processorOptions: {
        bufferSize: 4096,
        rmsThreshold: typeof initialRmsThreshold === 'number' ? initialRmsThreshold : 0.01
      }
    });

    audioWorkletNode.port.onmessage = (event: MessageEvent<any>) => {
      if (!event.data) return;

      if (event.data.type === 'VAD_STATE') {
        const source = event.data.source as AudioSource;
        vadState[source] = {
          isAudioActive: event.data.isAudioActive,
          rms: event.data.rms
        };
        const isAudioActive = vadState.tab.isAudioActive || vadState.microphone.isAudioActive;
        chrome.runtime.sendMessage({
          type: 'AUDIO_VAD_STATE',
          sessionId: activeSessionId,
          isAudioActive,
          rms: Math.max(vadState.tab.rms, vadState.microphone.rms)
        }).catch(() => {});
        return;
      }

      if (event.data.type === 'AUDIO_CHUNK' && event.data.chunk instanceof ArrayBuffer) {
        const source = event.data.source as AudioSource;
        const ws = audioSockets[source];
        if (!ws || ws.readyState !== WebSocket.OPEN) return;

        ws.send(event.data.chunk);
        sentAudioChunks++;
        if (sentAudioChunks === 1) {
          console.log(`[Offscreen] Primeiro bloco PCM enviado (${source}, ${event.data.chunk.byteLength} bytes).`);
        }
      }
    };

    sentAudioChunks = 0;

    // 4. Conectar áudio da aba
    tabSourceNode = audioContext.createMediaStreamSource(tabStream);
    tabSourceNode.connect(audioWorkletNode, 0, 0);

    // 5. Conectar o microfone à entrada isolada do processador.
    if (micStream) {
      micSourceNode = audioContext.createMediaStreamSource(micStream);
      micSourceNode.connect(audioWorkletNode, 0, 1);
    }

    audioWorkletNode.connect(audioContext.destination);

    // 6. Gravação local opcional do áudio completo (MediaRecorder → IndexedDB)
    if (enableRecording && activeSessionId) {
      recordedSessionId = null;
      try {
        const savedIds = await loadSavedSessionIds();
        await cleanupOrphanAudioRecordings(savedIds);
        await setupAudioRecorder();
      } catch (recErr) {
        console.warn('[Offscreen] Gravação de áudio local indisponível:', recErr);
      }
    }

    console.log('[Offscreen] Captura dual (Aba + Microfone) iniciada com sucesso em 16kHz.');
  } catch (err) {
    await stopCapture(false);
    console.error('[Offscreen] Falha ao iniciar captura de áudio:', err);
  }
}

async function loadSavedSessionIds(): Promise<string[]> {
  try {
    const res = await chrome.storage.local.get('savedConversations');
    const list = (res?.savedConversations as Array<{ id?: string }> | undefined) || [];
    return list.map(c => c.id).filter(Boolean) as string[];
  } catch {
    return [];
  }
}

function pickRecordingMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm'];
  for (const type of candidates) {
    if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
}

async function setupAudioRecorder(): Promise<void> {
  if (!audioContext || !tabSourceNode || !activeSessionId) return;

  recordingDestination = audioContext.createMediaStreamDestination();
  tabSourceNode.connect(recordingDestination);
  if (micSourceNode) {
    micSourceNode.connect(recordingDestination);
  }

  const options: MediaRecorderOptions = { audioBitsPerSecond: 32000 };
  const preferredMime = pickRecordingMimeType();
  if (preferredMime) options.mimeType = preferredMime;

  mediaRecorder = new MediaRecorder(recordingDestination.stream, options);
  const actualMime = mediaRecorder.mimeType || preferredMime || 'audio/webm';
  await initializeAudioRecording(activeSessionId, actualMime);

  recordedBytes = 0;
  recordingTruncated = false;
  finalizingRecording = false;
  nextChunkIndex = 0;

  mediaRecorder.ondataavailable = async (e) => {
    if (finalizingRecording) return;
    if (!e.data || e.data.size === 0 || !activeSessionId || !mediaRecorder) return;
    const sessionId = activeSessionId;
    const index = nextChunkIndex++;
    try {
      recordedBytes = await enqueueWrite(() => saveAudioChunk(sessionId, e.data, index));
    } catch (writeErr) {
      console.warn('[Offscreen] Falha ao salvar bloco de áudio local:', writeErr);
    }
    if (recordedBytes >= MAX_AUDIO_RECORDING_SIZE) {
      recordingTruncated = true;
      try {
        mediaRecorder?.stop();
      } catch {
        // Recorder já inativo
      }
    }
  };

  mediaRecorder.start(10000);
}

async function stopAndFinalizeRecorder(): Promise<void> {
  const recorder = mediaRecorder;
  const sessionId = activeSessionId;
  if (!recorder || !sessionId) return;

  finalizingRecording = true;
  let finalChunk: Blob | null = null;

  if (recorder.state !== 'inactive') {
    const chunkPromise = new Promise<Blob | null>((resolve) => {
      let settled = false;
      const timeoutId = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve(null);
        }
      }, 5000);
      const onData = (e: BlobEvent) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        resolve(e.data && e.data.size > 0 ? e.data : null);
      };
      recorder.addEventListener('dataavailable', onData, { once: true });
      try {
        recorder.stop();
      } catch (err) {
        clearTimeout(timeoutId);
        if (!settled) {
          settled = true;
          resolve(null);
        }
      }
    });
    finalChunk = await chunkPromise;
  }

  if (finalChunk) {
    const index = nextChunkIndex++;
    try {
      recordedBytes = await enqueueWrite(() => saveAudioChunk(sessionId, finalChunk!, index));
    } catch (writeErr) {
      console.warn('[Offscreen] Falha ao salvar bloco final de áudio local:', writeErr);
    }
  }

  await writeQueue.catch(() => {});

  try {
    await completeAudioRecording(sessionId, { truncated: recordingTruncated });
    recordedSessionId = sessionId;
  } catch (finalErr) {
    console.warn('[Offscreen] Falha ao finalizar a gravação de áudio local:', finalErr);
    recordedSessionId = null;
  }

  mediaRecorder = null;
  if (recordingDestination) {
    recordingDestination.disconnect();
    recordingDestination = null;
  }
}

async function stopCapture(log = true) {
  await stopAndFinalizeRecorder();

  vadState.tab = { isAudioActive: false, rms: 0 };
  vadState.microphone = { isAudioActive: false, rms: 0 };
  if (audioWorkletNode) {
    audioWorkletNode.port.onmessage = null;
    audioWorkletNode.port.close();
    audioWorkletNode.disconnect();
    audioWorkletNode = null;
  }
  if (tabSourceNode) {
    tabSourceNode.disconnect();
    tabSourceNode = null;
  }
  if (micSourceNode) {
    micSourceNode.disconnect();
    micSourceNode = null;
  }
  if (tabStream) {
    tabStream.getTracks().forEach(track => track.stop());
    tabStream = null;
  }
  if (micStream) {
    micStream.getTracks().forEach(track => track.stop());
    micStream = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  if (log) {
    console.log('[Offscreen] Captura de áudio encerrada.');
  }
}
