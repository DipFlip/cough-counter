"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { CoughEngine, CoughEvent } from "@/lib/coughEngine";

const DEFAULT_MIN_COUGH_SCORE = 0.2; // YAMNet "Cough" probability needed to count
const SCORE_STEP = 0.05;
const MAX_EVENTS_SHOWN = 20;
const MAX_CLIPS_KEPT = 20; // ~200KB each, so only keep recent ones for playback

export interface DetectedEvent extends Omit<CoughEvent, "clip"> {
  /** Whether this event is included in the count (after any user correction) */
  counted: boolean;
  corrected: boolean;
}

export function useCoughDetector() {
  const [state, setState] = useState<"idle" | "loading" | "counting">("idle");
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [minCoughScore, setMinCoughScore] = useState(DEFAULT_MIN_COUGH_SCORE);
  const [events, setEvents] = useState<DetectedEvent[]>([]);
  const [manualCoughs, setManualCoughs] = useState(0);
  const [flash, setFlash] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const engineRef = useRef<CoughEngine | null>(null);
  const countingStartRef = useRef(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const clipsRef = useRef(new Map<number, Float32Array>());
  const flashTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const stopLoops = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (flashTimeoutRef.current) {
      clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = null;
    }
  };

  const start = useCallback(async () => {
    setError(null);
    setState("loading");

    const engine = new CoughEngine({
      onEvent: ({ clip, ...event }) => {
        const clips = clipsRef.current;
        clips.set(event.id, clip);
        if (clips.size > MAX_CLIPS_KEPT) clips.delete(clips.keys().next().value!);
        setEvents((prev) => [{ ...event, counted: event.isCough, corrected: false }, ...prev]);
        if (event.isCough) {
          // Flash the screen briefly when a cough is counted
          setFlash(true);
          if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
          flashTimeoutRef.current = setTimeout(() => setFlash(false), 300);
        }
      },
      onError: setError,
    });
    engine.minCoughScore = DEFAULT_MIN_COUGH_SCORE;
    engineRef.current = engine;

    try {
      await engine.start();
    } catch (err) {
      console.error("Failed to start cough detection:", err);
      engine.stop();
      engineRef.current = null;
      setState("idle");
      setError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone access denied. Please allow microphone access."
          : "Could not start cough detection. Check your connection (the model is downloaded on first use) and try again."
      );
      return;
    }
    if (engineRef.current !== engine) return; // Reset while loading

    setState("counting");
    countingStartRef.current = Date.now();
    setElapsedSeconds(0);
    setMinCoughScore(DEFAULT_MIN_COUGH_SCORE);

    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - countingStartRef.current) / 1000));
    }, 1000);

    const pollLevel = () => {
      setLevel(engine.level);
      animationFrameRef.current = requestAnimationFrame(pollLevel);
    };
    pollLevel();
  }, []);

  const reset = useCallback(() => {
    stopLoops();
    engineRef.current?.stop();
    engineRef.current = null;
    setState("idle");
    setLevel(0);
    setEvents([]);
    clipsRef.current.clear();
    setManualCoughs(0);
    setFlash(false);
    setElapsedSeconds(0);
    countingStartRef.current = 0;
  }, []);

  const addManualCough = useCallback(() => {
    setManualCoughs((prev) => prev + 1);
  }, []);

  /** Flip whether an event counts as a cough (fixes false positives / misses) */
  const toggleEvent = useCallback((id: number) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, counted: !e.counted, corrected: true } : e))
    );
  }, []);

  const playEvent = useCallback((event: DetectedEvent) => {
    const clip = clipsRef.current.get(event.id);
    if (clip) engineRef.current?.playClip(clip, event.sampleRate);
  }, []);

  const hasClip = useCallback((id: number) => clipsRef.current.has(id), []);

  const updateMinScore = useCallback((delta: number) => {
    setMinCoughScore((prev) => {
      const next = Math.round(Math.min(0.95, Math.max(0.05, prev + delta)) * 100) / 100;
      if (engineRef.current) engineRef.current.minCoughScore = next;
      // Re-evaluate past events the user hasn't corrected by hand
      setEvents((events) =>
        events.map((e) => (e.corrected ? e : { ...e, counted: e.coughScore >= next }))
      );
      return next;
    });
  }, []);

  const raiseMinScore = useCallback(() => updateMinScore(SCORE_STEP), [updateMinScore]);
  const lowerMinScore = useCallback(() => updateMinScore(-SCORE_STEP), [updateMinScore]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopLoops();
      engineRef.current?.stop();
    };
  }, []);

  const coughCount = events.filter((e) => e.counted).length + manualCoughs;
  const coughsPerHour = elapsedSeconds > 0 ? coughCount / (elapsedSeconds / 3600) : 0;

  return {
    state,
    error,
    level,
    minCoughScore,
    events: events.slice(0, MAX_EVENTS_SHOWN),
    coughCount,
    coughsPerHour,
    flash,
    elapsedSeconds,
    start,
    reset,
    addManualCough,
    toggleEvent,
    playEvent,
    hasClip,
    raiseMinScore,
    lowerMinScore,
  };
}
