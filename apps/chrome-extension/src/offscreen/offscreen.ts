import type { AudioSource, SessionRegisterPayload, WSMessage } from '@conversation-copilot/shared-types';

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
  const wsUrl = (import.meta as any).env?.VITE_DIRECT_WHISPER === 'false' ? orchestratorWsUrl : whisperWsUrl;

  const ws = new WebSocket(wsUrl);
  audioSockets[source] = ws;
  ws.binaryType = 'arraybuffer';

  ws.onopen = () => {
    console.log(`[Offscreen] Canal de áudio ${source} conectado ao Orquestrador.`);
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

chrome.runtime.onMessage.addListener((message) => {
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
    startCapture(message.streamId, message.rmsThreshold);
  } else if (message.type === 'STOP_AUDIO_CAPTURE') {
    stopCapture();
  } else if (message.type === 'SET_RMS_THRESHOLD' && typeof message.rmsThreshold === 'number') {
    if (audioWorkletNode) {
      audioWorkletNode.port.postMessage({ rmsThreshold: message.rmsThreshold });
    }
  }
});

async function startCapture(streamId: string, initialRmsThreshold?: number) {
  try {
    stopCapture(false);

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
      console.warn(`[Offscreen] Microfone local indisponível ou permissão negada (${errName}: ${errMsg}). Continuando apenas com o áudio da aba.`);
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

    console.log('[Offscreen] Captura dual (Aba + Microfone) iniciada com sucesso em 16kHz.');
  } catch (err) {
    stopCapture(false);
    console.error('[Offscreen] Falha ao iniciar captura de áudio:', err);
  }
}

function stopCapture(log = true) {
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
