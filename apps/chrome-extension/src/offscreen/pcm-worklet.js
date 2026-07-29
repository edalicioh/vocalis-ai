class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.bufferSize = options.processorOptions?.bufferSize || 4096;
    this.rmsThreshold = options.processorOptions?.rmsThreshold ?? 0.01;
    this.sources = ['tab', 'microphone'].map(() => ({
      buffer: new Int16Array(this.bufferSize),
      offset: 0,
      floatSamples: new Float32Array(this.bufferSize)
    }));

    this.port.onmessage = (event) => {
      if (event.data && typeof event.data.rmsThreshold === 'number') {
        this.rmsThreshold = event.data.rmsThreshold;
      }
    };
  }

  processSource(input, sourceIndex) {
    if (!input) return;

    const state = this.sources[sourceIndex];
    const source = sourceIndex === 0 ? 'tab' : 'microphone';

    for (let i = 0; i < input.length; i++) {
      const sample = Math.max(-1, Math.min(1, input[i]));
      state.floatSamples[state.offset] = sample;
      state.buffer[state.offset++] = sample < 0
        ? sample * 0x8000
        : sample * 0x7fff;

      if (state.offset === this.bufferSize) {
        // Cálculo de energia RMS (Root Mean Square)
        let sumSquare = 0;
        for (let j = 0; j < this.bufferSize; j++) {
          sumSquare += state.floatSamples[j] * state.floatSamples[j];
        }
        const rms = Math.sqrt(sumSquare / this.bufferSize);
        const isAudioActive = this.rmsThreshold === 0.0 || rms >= this.rmsThreshold;

        // Emite o estado VAD de cada origem para a extensão.
        this.port.postMessage({ type: 'VAD_STATE', source, isAudioActive, rms });

        // RMS Energy Gate: só envia o pacote PCM se houver áudio ativo acima do limiar
        if (isAudioActive) {
          const chunk = state.buffer.buffer;
          this.port.postMessage({ type: 'AUDIO_CHUNK', source, chunk }, [chunk]);
        }

        state.buffer = new Int16Array(this.bufferSize);
        state.floatSamples = new Float32Array(this.bufferSize);
        state.offset = 0;
      }
    }
  }

  process(inputs, outputs) {
    const tabInput = inputs[0]?.[0];
    const microphoneInput = inputs[1]?.[0];

    // Mantém somente o áudio da aba audível e força o Chrome a processar o nó continuamente.
    const output = outputs[0]?.[0];
    if (output && tabInput) output.set(tabInput);

    this.processSource(tabInput, 0);
    this.processSource(microphoneInput, 1);

    return true;
  }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
