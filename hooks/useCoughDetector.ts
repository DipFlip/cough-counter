"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { CoughEngine } from "@/lib/coughEngine";


export function useCoughDetector() {
  const [state, setState] = useState<"idle" | "loading" | "counting">("idle");
  const [recovering, setRecovering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [coughCount, setCoughCount] = useState(0);
  const [flash, setFlash] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const engineRef = useRef<CoughEngine | null>(null);
  const activeRef = useRef(false);
  const recoveringRef = useRef(false);
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

  const connect = useCallback(async (recovery: boolean) => {
    if (recoveringRef.current) return;
    recoveringRef.current = true;
    activeRef.current = true;
    setError(null);
    setRecovering(recovery);
    if (!recovery) setState("loading");
    engineRef.current?.stop();

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
      // Some mobile browsers leave resume() pending until another user gesture.
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          engine.start(),
          new Promise<never>((_, reject) => {
            timeout = setTimeout(() => reject(new Error("Microphone startup timed out")), 15000);
          }),
        ]);
      } finally {
        clearTimeout(timeout);
      }
    } catch (err) {
      if (engineRef.current !== engine) return;
      console.error("Failed to start cough detection:", err);
      engine.stop();
      engineRef.current = null;
      recoveringRef.current = false;
      setRecovering(false);
      if (!recovery) {
        activeRef.current = false;
        setState("idle");
      }
      setError(recovery ? "Microphone paused. Tap Resume Listening to reconnect." : (
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone access denied. Please allow microphone access."
          : "Could not start cough detection. Check your connection (the model is downloaded on first use) and try again."
      ));
      return;
    }
    if (engineRef.current !== engine) return; // Reset while loading

    recoveringRef.current = false;
    setRecovering(false);
    setState("counting");
    if (recovery) return;
    countingStartRef.current = Date.now();
    setElapsedSeconds(0);

    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - countingStartRef.current) / 1000));
    }, 1000);

    const pollLevel = () => {
      setLevel(engineRef.current?.level ?? 0);
      animationFrameRef.current = requestAnimationFrame(pollLevel);
    };
    pollLevel();
  }, []);

  const start = useCallback(() => connect(false), [connect]);
  const resume = useCallback(() => connect(true), [connect]);

  useEffect(() => {
    let wasHidden = document.visibilityState === "hidden";
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        wasHidden = true;
      } else if (wasHidden) {
        wasHidden = false;
        if (activeRef.current) void connect(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [connect]);

  const reset = useCallback(() => {
    activeRef.current = false;
    recoveringRef.current = false;
    setRecovering(false);
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
      activeRef.current = false;
      engineRef.current?.stop();
      engineRef.current = null;
    };
  }, []);

  const coughsPerHour = elapsedSeconds > 0 ? coughCount / (elapsedSeconds / 3600) : 0;

  return {
    state,
    error,
    recovering,
    resume,
    level,
    coughCount,
    coughsPerHour,
    flash,
    elapsedSeconds,
    start,
    reset,
  };
}
