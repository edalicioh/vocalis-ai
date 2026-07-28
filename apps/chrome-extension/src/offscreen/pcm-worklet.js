class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.bufferSize = options.processorOptions?.bufferSize || 4096;
    this.rmsThreshold = options.processorOptions?.rmsThreshold ?? 0.01;
    this.buffer = new Int16Array(this.bufferSize);
    this.offset = 0;
    this.floatSamples = new Float32Array(this.bufferSize);

    this.port.onmessage = (event) => {
      if (event.data && typeof event.data.rmsThreshold === 'number') {
        this.rmsThreshold = event.data.rmsThreshold;
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;

    // Mantém o áudio da aba audível e força o Chrome a processar o nó continuamente.
    const output = outputs[0]?.[0];
    if (output) output.set(input);

    for (let i = 0; i < input.length; i++) {
      const sample = Math.max(-1, Math.min(1, input[i]));
      this.floatSamples[this.offset] = sample;
      this.buffer[this.offset++] = sample < 0
        ? sample * 0x8000
        : sample * 0x7fff;

      if (this.offset === this.bufferSize) {
        // Cálculo de energia RMS (Root Mean Square)
        let sumSquare = 0;
        for (let j = 0; j < this.bufferSize; j++) {
          sumSquare += this.floatSamples[j] * this.floatSamples[j];
        }
        const rms = Math.sqrt(sumSquare / this.bufferSize);
        const isAudioActive = this.rmsThreshold === 0.0 || rms >= this.rmsThreshold;

        // Emite o estado VAD para a extensão
        this.port.postMessage({ type: 'VAD_STATE', isAudioActive, rms });

        // RMS Energy Gate: só envia o pacote PCM se houver áudio ativo acima do limiar
        if (isAudioActive) {
          const chunk = this.buffer.buffer;
          this.port.postMessage(chunk, [chunk]);
        }

        this.buffer = new Int16Array(this.bufferSize);
        this.floatSamples = new Float32Array(this.bufferSize);
        this.offset = 0;
      }
    }

    return true;
  }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
