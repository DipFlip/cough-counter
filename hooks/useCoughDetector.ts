"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { CoughEngine } from "@/lib/coughEngine";


export function useCoughDetector() {
  const [state, setState] = useState<"idle" | "loading" | "counting">("idle");
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [coughCount, setCoughCount] = useState(0);
  const [flash, setFlash] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const engineRef = useRef<CoughEngine | null>(null);
  const countingStartRef = useRef(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
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
      onCough: () => {
        setCoughCount((prev) => prev + 1);
        // Flash the screen briefly when a cough is counted
        setFlash(true);
        if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
        flashTimeoutRef.current = setTimeout(() => setFlash(false), 300);
      },
      onError: setError,
    });
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
    setCoughCount(0);
    setFlash(false);
    setElapsedSeconds(0);
    countingStartRef.current = 0;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopLoops();
      engineRef.current?.stop();
    };
  }, []);

  const coughsPerHour = elapsedSeconds > 0 ? coughCount / (elapsedSeconds / 3600) : 0;

  return {
    state,
    error,
    level,
    coughCount,
    coughsPerHour,
    flash,
    elapsedSeconds,
    start,
    reset,
  };
}
