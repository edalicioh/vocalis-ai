class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.bufferSize = options.processorOptions?.bufferSize || 4096;
    this.buffer = new Int16Array(this.bufferSize);
    this.offset = 0;
  }

  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;

    // Mantém o áudio da aba audível e força o Chrome a processar o nó continuamente.
    const output = outputs[0]?.[0];
    if (output) output.set(input);

    for (let i = 0; i < input.length; i++) {
      const sample = Math.max(-1, Math.min(1, input[i]));
      this.buffer[this.offset++] = sample < 0
        ? sample * 0x8000
        : sample * 0x7fff;

      if (this.offset === this.bufferSize) {
        const chunk = this.buffer.buffer;
        this.port.postMessage(chunk, [chunk]);
        this.buffer = new Int16Array(this.bufferSize);
        this.offset = 0;
      }
    }

    return true;
  }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
