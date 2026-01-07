"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const CALIBRATION_DURATION = 3000; // 3 seconds
const COUGH_DEBOUNCE = 300; // 300ms debounce
const DEFAULT_THRESHOLD_MULTIPLIER = 0.75; // 75% of calibration volume
const THRESHOLD_STEP = 2; // Amount to adjust threshold by

interface UseCoughDetectorProps {
  volume: number;
  isListening: boolean;
}

export function useCoughDetector({ volume, isListening }: UseCoughDetectorProps) {
  const [state, setState] = useState<"idle" | "calibrating" | "counting">("idle");
  const [calibrationVolume, setCalibrationVolume] = useState(0);
  const [threshold, setThreshold] = useState(0);
  const [coughCount, setCoughCount] = useState(0);
  const [coughsPerMinute, setCoughsPerMinute] = useState(0);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const peakVolumeRef = useRef(0);
  const coughTimestampsRef = useRef<number[]>([]);
  const lastCoughTimeRef = useRef(0);
  const calibrationStartRef = useRef(0);
  const countingStartRef = useRef(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const calculateCPM = useCallback((currentCoughCount: number, currentElapsedSeconds: number) => {
    if (currentElapsedSeconds <= 0) {
      setCoughsPerMinute(0);
      return;
    }
    const elapsedMinutes = currentElapsedSeconds / 60;
    const cpm = currentCoughCount / elapsedMinutes;
    setCoughsPerMinute(cpm);
  }, []);

  const startCalibration = useCallback(() => {
    setState("calibrating");
    peakVolumeRef.current = 0;
    calibrationStartRef.current = Date.now();
    setCalibrationProgress(0);

    // Update progress during calibration
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - calibrationStartRef.current;
      const progress = Math.min(100, (elapsed / CALIBRATION_DURATION) * 100);
      setCalibrationProgress(progress);

      if (elapsed >= CALIBRATION_DURATION) {
        clearInterval(progressInterval);
      }
    }, 50);

    // End calibration after duration
    setTimeout(() => {
      clearInterval(progressInterval);
      setCalibrationProgress(100);

      if (peakVolumeRef.current > 0) {
        setCalibrationVolume(peakVolumeRef.current);
        setThreshold(peakVolumeRef.current * DEFAULT_THRESHOLD_MULTIPLIER);
        setState("counting");
        countingStartRef.current = Date.now();
        setElapsedSeconds(0);

        // Start timer interval (update every second)
        timerIntervalRef.current = setInterval(() => {
          const elapsed = Math.floor((Date.now() - countingStartRef.current) / 1000);
          setElapsedSeconds(elapsed);
        }, 1000);
      } else {
        // No sound detected, reset
        setState("idle");
        setCalibrationProgress(0);
      }
    }, CALIBRATION_DURATION);
  }, [calculateCPM]);

  const reset = useCallback(() => {
    setState("idle");
    setCalibrationVolume(0);
    setThreshold(0);
    setCoughCount(0);
    setCoughsPerMinute(0);
    setCalibrationProgress(0);
    setElapsedSeconds(0);
    peakVolumeRef.current = 0;
    coughTimestampsRef.current = [];
    lastCoughTimeRef.current = 0;
    countingStartRef.current = 0;

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const addManualCough = useCallback(() => {
    setCoughCount((prev) => {
      const newCount = prev + 1;
      const elapsed = Math.floor((Date.now() - countingStartRef.current) / 1000);
      calculateCPM(newCount, elapsed);
      return newCount;
    });
  }, [calculateCPM]);

  const raiseThreshold = useCallback(() => {
    setThreshold((prev) => Math.min(100, prev + THRESHOLD_STEP));
  }, []);

  const lowerThreshold = useCallback(() => {
    setThreshold((prev) => Math.max(1, prev - THRESHOLD_STEP));
  }, []);

  // Track peak volume during calibration
  useEffect(() => {
    if (state === "calibrating" && volume > peakVolumeRef.current) {
      peakVolumeRef.current = volume;
    }
  }, [state, volume]);

  // Detect coughs during counting
  useEffect(() => {
    if (state !== "counting" || !isListening) return;

    const now = Date.now();

    if (volume > threshold && now - lastCoughTimeRef.current > COUGH_DEBOUNCE) {
      lastCoughTimeRef.current = now;
      setCoughCount((prev) => {
        const newCount = prev + 1;
        const elapsed = Math.floor((Date.now() - countingStartRef.current) / 1000);
        calculateCPM(newCount, elapsed);
        return newCount;
      });
    }
  }, [state, volume, threshold, isListening, calculateCPM]);

  // Update CPM every 10 seconds even without new coughs
  useEffect(() => {
    if (state === "counting" && elapsedSeconds > 0) {
      calculateCPM(coughCount, elapsedSeconds);
    }
  }, [state, elapsedSeconds, coughCount, calculateCPM]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  return {
    state,
    calibrationVolume,
    threshold,
    coughCount,
    coughsPerMinute,
    calibrationProgress,
    elapsedSeconds,
    startCalibration,
    reset,
    addManualCough,
    raiseThreshold,
    lowerThreshold,
  };
}
