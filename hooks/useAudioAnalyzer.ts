"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export function useAudioAnalyzer() {
  const [volume, setVolume] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  const calculateVolume = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current) return;

    analyserRef.current.getByteTimeDomainData(dataArrayRef.current);

    // Calculate RMS (Root Mean Square) for volume
    let sum = 0;
    for (let i = 0; i < dataArrayRef.current.length; i++) {
      const value = (dataArrayRef.current[i] - 128) / 128;
      sum += value * value;
    }
    const rms = Math.sqrt(sum / dataArrayRef.current.length);

    // Normalize to 0-100 range
    const normalizedVolume = Math.min(100, rms * 200);
    setVolume(normalizedVolume);

    animationFrameRef.current = requestAnimationFrame(calculateVolume);
  }, []);

  const start = useCallback(async () => {
    try {
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

      setIsListening(true);
      calculateVolume();
    } catch (err) {
      setError("Microphone access denied. Please allow microphone access.");
      console.error("Error accessing microphone:", err);
    }
  }, [calculateVolume]);

  const stop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsListening(false);
    setVolume(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { volume, isListening, error, start, stop };
}
