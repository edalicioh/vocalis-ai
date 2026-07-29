let ws: WebSocket | null = null;
let audioContext: AudioContext | null = null;
let tabStream: MediaStream | null = null;
let micStream: MediaStream | null = null;
let tabSourceNode: MediaStreamAudioSourceNode | null = null;
let micSourceNode: MediaStreamAudioSourceNode | null = null;
let audioWorkletNode: AudioWorkletNode | null = null;
let sentAudioChunks = 0;

let activeSessionId: string | null = null;

function connectWebSocket() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const wsUrl = import.meta.env.VITE_ORCHESTRATOR_WS_URL || 'ws://localhost:3001/ws';
  ws = new WebSocket(wsUrl);
  ws.binaryType = 'arraybuffer';

  ws.onopen = async () => {
    console.log('[Offscreen] Conectado ao Orquestrador WebSocket.');
    if (activeSessionId) {
      ws?.send(JSON.stringify({ type: 'session.register', sessionId: activeSessionId, payload: {} }));
    }
  };

  ws.onclose = () => {
    console.log('[Offscreen] WebSocket fechado. Tentando reconectar...');
    setTimeout(connectWebSocket, 3000);
  };

  ws.onerror = (err) => {
    console.error('[Offscreen] Erro de WebSocket:', err);
  };
}

connectWebSocket();

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'INIT_AUDIO_CAPTURE' && message.streamId) {
    if (message.sessionId) {
      activeSessionId = message.sessionId;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'session.register', sessionId: activeSessionId, payload: {} }));
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
      numberOfInputs: 1,
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
        chrome.runtime.sendMessage({
          type: 'AUDIO_VAD_STATE',
          isAudioActive: event.data.isAudioActive,
          rms: event.data.rms
        }).catch(() => {});
        return;
      }

      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      if (event.data instanceof ArrayBuffer) {
        ws.send(event.data);
        sentAudioChunks++;
        if (sentAudioChunks === 1) {
          console.log(`[Offscreen] Primeiro bloco PCM enviado (${event.data.byteLength} bytes).`);
        }
      }
    };

    sentAudioChunks = 0;

    // 4. Conectar áudio da aba
    tabSourceNode = audioContext.createMediaStreamSource(tabStream);
    tabSourceNode.connect(audioWorkletNode);

    // 5. Conectar áudio do microfone ao mesmo processador (mixagem)
    if (micStream) {
      micSourceNode = audioContext.createMediaStreamSource(micStream);
      micSourceNode.connect(audioWorkletNode);
    }

    audioWorkletNode.connect(audioContext.destination);

    console.log('[Offscreen] Captura dual (Aba + Microfone) iniciada com sucesso em 16kHz.');
  } catch (err) {
    stopCapture(false);
    console.error('[Offscreen] Falha ao iniciar captura de áudio:', err);
  }
}

function stopCapture(log = true) {
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
