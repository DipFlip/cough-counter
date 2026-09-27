// Forwards raw mic samples to the main thread in fixed-size batches so that
// no audio is dropped (unlike polling an AnalyserNode on requestAnimationFrame).
const BATCH_SIZE = 1024;

class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(BATCH_SIZE);
    this.filled = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) {
      for (let i = 0; i < channel.length; i++) {
        this.buffer[this.filled++] = channel[i];
        if (this.filled === BATCH_SIZE) {
          this.port.postMessage(this.buffer, [this.buffer.buffer]);
          this.buffer = new Float32Array(BATCH_SIZE);
          this.filled = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor("capture-processor", CaptureProcessor);
