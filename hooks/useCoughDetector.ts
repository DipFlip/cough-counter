"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const CALIBRATION_DURATION = 3000; // 3 seconds
const COUGH_DEBOUNCE = 300; // 300ms debounce
const DEFAULT_THRESHOLD_MULTIPLIER = 0.75; // 75% of calibration volume
const CPM_UPDATE_INTERVAL = 10000; // 10 seconds
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

  const peakVolumeRef = useRef(0);
  const coughTimestampsRef = useRef<number[]>([]);
  const lastCoughTimeRef = useRef(0);
  const calibrationStartRef = useRef(0);
  const cpmIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const calculateCPM = useCallback(() => {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Filter coughs from last 60 seconds
    const recentCoughs = coughTimestampsRef.current.filter((t) => t > oneMinuteAgo);
    coughTimestampsRef.current = recentCoughs;

    setCoughsPerMinute(recentCoughs.length);
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

        // Start CPM update interval
        cpmIntervalRef.current = setInterval(calculateCPM, CPM_UPDATE_INTERVAL);
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
    peakVolumeRef.current = 0;
    coughTimestampsRef.current = [];
    lastCoughTimeRef.current = 0;

    if (cpmIntervalRef.current) {
      clearInterval(cpmIntervalRef.current);
      cpmIntervalRef.current = null;
    }
  }, []);

  const addManualCough = useCallback(() => {
    const now = Date.now();
    coughTimestampsRef.current.push(now);
    setCoughCount((prev) => prev + 1);
    calculateCPM();
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
      coughTimestampsRef.current.push(now);
      setCoughCount((prev) => prev + 1);
      calculateCPM();
    }
  }, [state, volume, threshold, isListening, calculateCPM]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cpmIntervalRef.current) {
        clearInterval(cpmIntervalRef.current);
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
    startCalibration,
    reset,
    addManualCough,
    raiseThreshold,
    lowerThreshold,
  };
}
