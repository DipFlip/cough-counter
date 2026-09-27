import type { AudioClassifier } from "@mediapipe/tasks-audio";

// Keep in sync with the @mediapipe/tasks-audio version in package.json
const MEDIAPIPE_WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio@1.0.1/wasm";
const YAMNET_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/audio_classifier/yamnet/float32/1/yamnet.tflite";

const FRAME_MS = 10; // Loudness is measured per 10ms frame
const FLOOR_WINDOW_FRAMES = 1000; // Background noise estimated over the last 10s
const FLOOR_PERCENTILE = 0.2;
const MIN_FLOOR_DB = -75; // Ignore digital silence (e.g. before the mic warms up)
const FLOOR_UPDATE_EVERY = 20; // Recompute the noise floor every 200ms
const WARMUP_FRAMES = 50; // Don't trigger until we have 0.5s of background
export const START_DB = 12; // Candidate starts this far above the noise floor
const END_DB = 6; // ...and ends when it drops below this
const END_HOLD_MS = 80; // Must stay quiet this long to end the candidate
const MIN_EVENT_MS = 60;
const MAX_EVENT_MS = 1500;
const MIN_ONSET_GAP_MS = 200; // Individual coughs in a bout are usually further apart
const CLIP_PRE_MS = 300; // Audio kept before the onset
const CLIP_POST_MS = 900; // Audio kept after the onset
const YAMNET_WINDOW_MS = 975;
// YAMNet scores depend on where the sound sits in its window, so classify a
// few shifted windows and keep the best (≈1-2ms each, only run on candidates)
const WINDOW_OFFSETS_MS = [0, 110, 225];
const RING_SECONDS = 4;

export interface CoughEvent {
  id: number;
  time: number;
  coughScore: number;
  topLabel: string;
  topScore: number;
  isCough: boolean;
  clip: Float32Array;
  sampleRate: number;
}

interface CoughEngineCallbacks {
  onEvent: (event: CoughEvent) => void;
  onError: (message: string) => void;
}

let classifierPromise: Promise<AudioClassifier> | null = null;

function loadClassifier() {
  if (!classifierPromise) {
    classifierPromise = (async () => {
      const { AudioClassifier, FilesetResolver } = await import("@mediapipe/tasks-audio");
      const fileset = await FilesetResolver.forAudioTasks(MEDIAPIPE_WASM_URL);
      return AudioClassifier.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: YAMNET_MODEL_URL },
      });
    })();
    classifierPromise.catch(() => {
      classifierPromise = null;
    });
  }
  return classifierPromise;
}

/**
 * Two-stage cough detector: a cheap loudness gate (relative to an adaptive
 * noise floor) finds candidate sounds, and YAMNet classifies each candidate.
 */
export class CoughEngine {
  /** Current loudness in dB above the noise floor (for display) */
  level = 0;
  noiseFloor = -100;
  minCoughScore = 0.2;

  private callbacks: CoughEngineCallbacks;
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private classifier: AudioClassifier | null = null;
  private wakeLock: WakeLockSentinel | null = null;

  private sampleRate = 48000;
  private frameSize = 480;
  private ring = new Float32Array(0);
  private written = 0; // Total samples received (absolute sample index)
  private frameSum = 0;
  private frameFill = 0;
  private framesSeen = 0;

  private floorHistory: number[] = [];
  private floorCursor = 0;

  private inEvent = false;
  private eventStart = 0;
  private quietFrames = 0;
  private lastOnset = -Infinity;
  private pending: number[] = [];
  private nextId = 1;

  constructor(callbacks: CoughEngineCallbacks) {
    this.callbacks = callbacks;
  }

  get audioContext() {
    return this.ctx;
  }

  /** Must be called from a user gesture (iOS requires it for audio). */
  async start() {
    // Create the context synchronously inside the gesture so iOS allows playback/capture
    const ctx = new AudioContext();
    this.ctx = ctx;
    ctx.resume().catch(() => {});

    const [stream, classifier] = await Promise.all([
      navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: false,
          noiseSuppression: false,
          echoCancellation: false,
        },
      }),
      loadClassifier(),
      ctx.audioWorklet.addModule("/cough-worklet.js"),
    ]);
    if (this.ctx !== ctx) {
      // stop() was called while loading
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    this.stream = stream;
    this.classifier = classifier;

    this.sampleRate = ctx.sampleRate;
    this.frameSize = Math.round((this.sampleRate * FRAME_MS) / 1000);
    this.ring = new Float32Array(this.sampleRate * RING_SECONDS);

    const source = ctx.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(ctx, "capture-processor");
    node.port.onmessage = (e: MessageEvent<Float32Array>) => this.handleSamples(e.data);
    // The worklet must be pulled by the graph to run; route it to a muted output
    const mute = ctx.createGain();
    mute.gain.value = 0;
    source.connect(node).connect(mute).connect(ctx.destination);
    this.node = node;

    stream.getAudioTracks()[0]?.addEventListener("ended", () => {
      this.callbacks.onError("Microphone stopped. Tap Stop & Save and start again.");
    });
    ctx.onstatechange = () => this.resumeIfNeeded();
    document.addEventListener("visibilitychange", this.handleVisibility);

    await ctx.resume();
    await this.requestWakeLock();
  }

  stop() {
    document.removeEventListener("visibilitychange", this.handleVisibility);
    this.node?.port.close();
    this.node?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    if (this.ctx) {
      this.ctx.onstatechange = null;
      this.ctx.close();
    }
    this.wakeLock?.release().catch(() => {});
    this.node = null;
    this.stream = null;
    this.ctx = null;
    this.wakeLock = null;
    this.level = 0;
  }

  playClip(clip: Float32Array, sampleRate: number) {
    if (!this.ctx) return;
    const buffer = this.ctx.createBuffer(1, clip.length, sampleRate);
    buffer.copyToChannel(new Float32Array(clip), 0);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.ctx.destination);
    source.start();
  }

  private handleVisibility = () => {
    if (document.visibilityState === "visible") {
      this.resumeIfNeeded();
      // Wake locks are released automatically when the page is hidden
      this.requestWakeLock();
    }
  };

  private resumeIfNeeded() {
    const ctx = this.ctx;
    // iOS uses a non-standard "interrupted" state after calls, Siri, etc.
    if (ctx && (ctx.state as string) !== "running" && ctx.state !== "closed") {
      ctx.resume().catch(() => {});
    }
  }

  private async requestWakeLock() {
    try {
      if (!("wakeLock" in navigator) || (this.wakeLock && !this.wakeLock.released)) return;
      this.wakeLock = await navigator.wakeLock.request("screen");
    } catch {
      // Not supported or not allowed; counting still works while the screen is on
    }
  }

  private handleSamples(samples: Float32Array) {
    const ringLength = this.ring.length;
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      this.ring[this.written % ringLength] = s;
      this.written++;
      this.frameSum += s * s;
      if (++this.frameFill === this.frameSize) {
        this.processFrame(10 * Math.log10(this.frameSum / this.frameSize + 1e-12));
        this.frameSum = 0;
        this.frameFill = 0;
      }
    }
    this.processPending();
  }

  private processFrame(db: number) {
    this.framesSeen++;
    this.updateNoiseFloor(db);

    const above = db - this.noiseFloor;
    this.level = Math.max(0, above);
    if (this.framesSeen < WARMUP_FRAMES) return;

    const msToSamples = (ms: number) => (ms * this.sampleRate) / 1000;

    if (!this.inEvent) {
      if (above > START_DB) {
        this.inEvent = true;
        this.eventStart = this.written - this.frameSize;
        this.quietFrames = 0;
      }
      return;
    }

    this.quietFrames = above < END_DB ? this.quietFrames + 1 : 0;
    const duration = this.written - this.eventStart;
    if (this.quietFrames * FRAME_MS >= END_HOLD_MS || duration > msToSamples(MAX_EVENT_MS)) {
      this.inEvent = false;
      const activeDuration = duration - this.quietFrames * this.frameSize;
      if (
        activeDuration >= msToSamples(MIN_EVENT_MS) &&
        this.eventStart - this.lastOnset >= msToSamples(MIN_ONSET_GAP_MS)
      ) {
        this.lastOnset = this.eventStart;
        this.pending.push(this.eventStart);
      }
    }
  }

  private updateNoiseFloor(db: number) {
    // Track a low percentile of recent loudness: robust to short loud sounds,
    // but follows the room if it gets permanently louder or quieter
    if (this.floorHistory.length < FLOOR_WINDOW_FRAMES) {
      this.floorHistory.push(db);
    } else {
      this.floorHistory[this.floorCursor] = db;
      this.floorCursor = (this.floorCursor + 1) % FLOOR_WINDOW_FRAMES;
    }
    if (this.framesSeen % FLOOR_UPDATE_EVERY === 0 || this.framesSeen === 1) {
      const sorted = [...this.floorHistory].sort((a, b) => a - b);
      this.noiseFloor = Math.max(MIN_FLOOR_DB, sorted[Math.floor(sorted.length * FLOOR_PERCENTILE)]);
    }
  }

  private processPending() {
    const pre = Math.round((CLIP_PRE_MS * this.sampleRate) / 1000);
    const post = Math.round((CLIP_POST_MS * this.sampleRate) / 1000);
    while (this.pending.length > 0 && this.written >= this.pending[0] + post) {
      const onset = this.pending.shift()!;
      const start = Math.max(onset - pre, this.written - this.ring.length);
      this.classify(onset, this.readRing(start, onset + post));
    }
  }

  private readRing(start: number, end: number) {
    const clip = new Float32Array(end - start);
    for (let i = 0; i < clip.length; i++) {
      clip[i] = this.ring[(start + i) % this.ring.length];
    }
    return clip;
  }

  private classify(onset: number, clip: Float32Array) {
    if (!this.classifier) return;

    let coughScore = -1;
    let topLabel = "";
    let topScore = 0;
    const windowLength = Math.round((YAMNET_WINDOW_MS * this.sampleRate) / 1000);
    try {
      for (const offsetMs of WINDOW_OFFSETS_MS) {
        const offset = Math.round((offsetMs * this.sampleRate) / 1000);
        const window = clip.subarray(offset, offset + windowLength);
        const categories = this.classifier.classify(window, this.sampleRate)[0]?.classifications[0]?.categories ?? [];
        const cough = categories.find((c) => (c.categoryName || c.displayName).toLowerCase() === "cough");
        // Report the window that looks most like a cough
        if ((cough?.score ?? 0) > coughScore) {
          coughScore = cough?.score ?? 0;
          topLabel = categories[0] ? categories[0].categoryName || categories[0].displayName : "";
          topScore = categories[0]?.score ?? 0;
        }
      }
    } catch (err) {
      console.error("Classification failed:", err);
      return;
    }

    const ageMs = ((this.written - onset) / this.sampleRate) * 1000;
    this.callbacks.onEvent({
      id: this.nextId++,
      time: Date.now() - ageMs,
      coughScore,
      topLabel,
      topScore,
      isCough: coughScore >= this.minCoughScore,
      clip,
      sampleRate: this.sampleRate,
    });
  }
}
