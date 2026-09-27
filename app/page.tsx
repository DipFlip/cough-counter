"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCoughDetector } from "@/hooks/useCoughDetector";
import { useRecordings } from "@/hooks/useRecordings";
import { EKGDisplay } from "@/components/EKGDisplay";
import { APP_VERSION } from "@/lib/version";

const AUTO_SAVE_INTERVAL = 60000; // 60 seconds

export default function Home() {
  const {
    state,
    error,
    level,
    coughCount,
    coughsPerHour,
    flash,
    elapsedSeconds,
    start,
    reset,
  } = useCoughDetector();

  const { upsertRecording } = useRecordings();
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [note, setNote] = useState("");
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionStartRef = useRef<Date | null>(null);

  // Format elapsed time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Save current session
  const saveSession = () => {
    if (elapsedSeconds <= 0) return;

    const sessionDate = sessionStartRef.current || new Date();
    const id = upsertRecording(currentSessionId, {
      date: sessionDate.toISOString(),
      totalTime: elapsedSeconds,
      totalCoughs: coughCount,
      avgCPH: coughsPerHour,
      note,
      isManual: false,
    });

    if (!currentSessionId) {
      setCurrentSessionId(id);
    }
    setLastSaved(new Date());
  };

  // Keep a ref to the latest saveSession so the interval doesn't save stale values
  const saveSessionRef = useRef(saveSession);
  useEffect(() => {
    saveSessionRef.current = saveSession;
  });

  // Start auto-save when counting starts
  useEffect(() => {
    if (state === "counting") {
      sessionStartRef.current = new Date();

      // Start auto-save interval
      autoSaveIntervalRef.current = setInterval(() => {
        saveSessionRef.current();
      }, AUTO_SAVE_INTERVAL);

      return () => {
        if (autoSaveIntervalRef.current) {
          clearInterval(autoSaveIntervalRef.current);
        }
      };
    } else {
      // Clear interval when not counting
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
        autoSaveIntervalRef.current = null;
      }
    }
  }, [state]);

  // Save on cough count change (debounced via the auto-save)
  useEffect(() => {
    if (state === "counting" && coughCount > 0) {
      // Save immediately on first cough, then rely on interval
      if (!lastSaved) {
        saveSession();
      }
    }
  }, [coughCount]);

  const handleReset = () => {
    // Final save before reset
    if (state === "counting" && elapsedSeconds > 0) {
      saveSession();
    }

    // Clear session
    setCurrentSessionId(null);
    setLastSaved(null);
    setNote("");
    sessionStartRef.current = null;

    reset();
  };

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center p-8 pb-24 transition-colors duration-100 ${
        flash ? "bg-red-900" : "bg-gray-900"
      }`}
    >
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white">Cough Counter</h1>
          <p className="mt-2 text-gray-400">
            {state === "idle" && "Start listening to count coughs"}
            {state === "loading" && "Loading cough detection model..."}
            {state === "counting" && "Listening for coughs..."}
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* EKG Display */}
        {state === "counting" && (
          <EKGDisplay volume={level} />
        )}

        {/* Stats */}
        {state === "counting" && (
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="py-4 px-2 bg-gray-800 rounded-xl text-center">
              <div className="text-2xl sm:text-4xl font-bold text-blue-400 tabular-nums">{coughCount}</div>
              <div className="mt-2 text-gray-400 text-xs sm:text-sm">Total Coughs</div>
            </div>
            <div className="py-4 px-2 bg-gray-800 rounded-xl text-center">
              <div className="text-2xl sm:text-4xl font-bold text-purple-400 tabular-nums">
                {coughsPerHour.toFixed(coughsPerHour >= 100 ? 0 : 1)}
              </div>
              <div className="mt-2 text-gray-400 text-xs sm:text-sm">Per Hour</div>
            </div>
            <div className="py-4 px-2 bg-gray-800 rounded-xl text-center">
              <div className="text-2xl sm:text-4xl font-bold text-green-400 font-mono">
                {formatTime(elapsedSeconds)}
              </div>
              <div className="mt-2 text-gray-400 text-xs sm:text-sm">Total Time</div>
            </div>
          </div>
        )}

        {/* Note, saved with the recording (editable later in History) */}
        {state === "counting" && (
          <div>
            <label htmlFor="session-note" className="text-gray-400 text-sm block mb-1">
              Note
            </label>
            <textarea
              id="session-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-gray-800 text-white rounded-lg p-2 text-base resize-none"
              rows={2}
              placeholder="Add a note..."
            />
          </div>
        )}

        {/* Auto-save indicator */}
        {state === "counting" && lastSaved && (
          <div className="text-center text-gray-500 text-sm">
            ✓ Auto-saved at {lastSaved.toLocaleTimeString()}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-4">
          {state === "idle" && (
            <button
              onClick={start}
              className="w-full py-4 px-6 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors"
            >
              Start Listening
            </button>
          )}

          {state === "loading" && (
            <button
              disabled
              className="w-full py-4 px-6 bg-gray-700 text-gray-400 font-semibold rounded-xl"
            >
              Loading...
            </button>
          )}

          {state === "counting" && (
            <button
              onClick={handleReset}
              className="w-full py-4 px-6 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-xl transition-colors"
            >
              Stop & Save
            </button>
          )}
        </div>

        {/* Instructions */}
        {state === "idle" && (
          <div className="text-center text-sm text-gray-500 space-y-1">
            <p>1. Tap &quot;Start Listening&quot; and allow microphone access</p>
            <p>2. Keep the phone nearby – coughs are counted automatically</p>
            <p>3. Tap &quot;Stop &amp; Save&quot; when done – find it later under History</p>
            <p>Keep the screen on – iOS stops the microphone when it locks</p>
            <p className="mt-4 text-gray-600">v{APP_VERSION}</p>
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700">
        <div className="max-w-2xl mx-auto flex">
          <Link
            href="/"
            className="flex-1 pt-3 pb-15 text-center text-white bg-gray-700"
          >
            <div className="text-xl">🎤</div>
            <div className="text-xs">Counter</div>
          </Link>
          <Link
            href="/history"
            className="flex-1 pt-3 pb-15 text-center text-gray-400 hover:text-white transition-colors"
          >
            <div className="text-xl">📊</div>
            <div className="text-xs">History</div>
          </Link>
        </div>
      </nav>
    </div>
  );
}
