"use client";

import { useState, useEffect, useCallback } from "react";

export interface CoughRecording {
  id: string;
  date: string;
  totalTime: number;
  totalCoughs: number;
  avgCPH: number;
  note: string;
  isManual: boolean;
}

const STORAGE_KEY = "cough-recordings";

export function useRecordings() {
  const [recordings, setRecordings] = useState<CoughRecording[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load recordings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setRecordings(parsed);
      }
    } catch (error) {
      console.error("Failed to load recordings:", error);
    }
    setIsLoaded(true);
  }, []);

  // Save recordings to localStorage whenever they change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(recordings));
      } catch (error) {
        console.error("Failed to save recordings:", error);
      }
    }
  }, [recordings, isLoaded]);

  const addRecording = useCallback((recording: Omit<CoughRecording, "id">) => {
    const newRecording: CoughRecording = {
      ...recording,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    setRecordings((prev) => [newRecording, ...prev]);
    return newRecording.id;
  }, []);

  const updateRecording = useCallback(
    (id: string, updates: Partial<Omit<CoughRecording, "id">>) => {
      setRecordings((prev) =>
        prev.map((rec) => (rec.id === id ? { ...rec, ...updates } : rec))
      );
    },
    []
  );

  const deleteRecording = useCallback((id: string) => {
    setRecordings((prev) => prev.filter((rec) => rec.id !== id));
  }, []);

  const getRecording = useCallback(
    (id: string) => {
      return recordings.find((rec) => rec.id === id);
    },
    [recordings]
  );

  // Upsert: update if exists, add if not
  const upsertRecording = useCallback(
    (id: string | null, recording: Omit<CoughRecording, "id">) => {
      if (id) {
        const exists = recordings.some((rec) => rec.id === id);
        if (exists) {
          updateRecording(id, recording);
          return id;
        }
      }
      return addRecording(recording);
    },
    [recordings, updateRecording, addRecording]
  );

  return {
    recordings,
    isLoaded,
    addRecording,
    updateRecording,
    deleteRecording,
    getRecording,
    upsertRecording,
  };
}
