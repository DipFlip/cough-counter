"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCoughDetector } from "@/hooks/useCoughDetector";
import { START_DB } from "@/lib/coughEngine";
import { useRecordings } from "@/hooks/useRecordings";
import { EKGDisplay } from "@/components/EKGDisplay";
import { APP_VERSION } from "@/lib/version";

const AUTO_SAVE_INTERVAL = 60000; // 60 seconds

export default function Home() {
  const {
    state,
    error,
    level,
    minCoughScore,
    events,
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
  } = useCoughDetector();

  const { upsertRecording } = useRecordings();
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
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
      note: "",
      isManual: false,
    });

    if (!currentSessionId) {
      setCurrentSessionId(id);
    }
    setLastSaved(new Date());
  };

  // Start auto-save when counting starts
  useEffect(() => {
    if (state === "counting") {
      sessionStartRef.current = new Date();

      // Start auto-save interval
      autoSaveIntervalRef.current = setInterval(() => {
        saveSession();
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
          <EKGDisplay volume={level} threshold={START_DB} showThreshold />
        )}

        {/* Stats */}
        {state === "counting" && (
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-gray-800 rounded-xl text-center">
              <div className="text-4xl font-bold text-blue-400">{coughCount}</div>
              <div className="mt-2 text-gray-400 text-sm">Total Coughs</div>
            </div>
            <div className="p-4 bg-gray-800 rounded-xl text-center">
              <div className="text-4xl font-bold text-purple-400">
                {coughsPerHour.toFixed(1)}
              </div>
              <div className="mt-2 text-gray-400 text-sm">Per Hour</div>
            </div>
            <div className="p-4 bg-gray-800 rounded-xl text-center">
              <div className="text-4xl font-bold text-green-400 font-mono">
                {formatTime(elapsedSeconds)}
              </div>
              <div className="mt-2 text-gray-400 text-sm">Total Time</div>
            </div>
          </div>
        )}

        {/* Auto-save indicator */}
        {state === "counting" && lastSaved && (
          <div className="text-center text-gray-500 text-sm">
            ✓ Auto-saved at {lastSaved.toLocaleTimeString()}
          </div>
        )}

        {/* Sensitivity controls */}
        {state === "counting" && (
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={raiseMinScore}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
            >
              − Sensitivity
            </button>
            <span className="text-gray-300 font-mono text-center">
              {Math.round(minCoughScore * 100)}%
              <span className="block text-xs text-gray-500">min confidence</span>
            </span>
            <button
              onClick={lowerMinScore}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
            >
              + Sensitivity
            </button>
          </div>
        )}

        {/* Detected sounds: tap to correct, ▶ to listen */}
        {state === "counting" && events.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm text-gray-400">
              Recent sounds <span className="text-gray-600">· tap to mark cough / not cough</span>
            </div>
            <ul className="space-y-1">
              {events.map((event) => (
                <li
                  key={event.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                    event.counted ? "bg-red-950/60 text-red-200" : "bg-gray-800 text-gray-400"
                  }`}
                >
                  <button
                    onClick={() => toggleEvent(event.id)}
                    className="flex-1 flex items-center gap-3 text-left"
                  >
                    <span className="w-5">{event.counted ? "✓" : "✗"}</span>
                    <span className="font-mono text-gray-500">
                      {new Date(event.time).toLocaleTimeString()}
                    </span>
                    <span className="flex-1 truncate">
                      {event.counted ? "Cough" : event.topLabel || "Unknown"}
                      {event.corrected && <span className="text-gray-500"> (edited)</span>}
                    </span>
                    <span className="font-mono text-gray-500">
                      cough {Math.round(event.coughScore * 100)}%
                    </span>
                  </button>
                  {hasClip(event.id) && (
                    <button
                      onClick={() => playEvent(event)}
                      className="px-2 text-gray-300 hover:text-white"
                      aria-label="Play clip"
                    >
                      ▶
                    </button>
                  )}
                </li>
              ))}
            </ul>
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
            <div className="flex gap-4">
              <button
                onClick={addManualCough}
                className="flex-1 py-4 px-6 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl transition-colors"
              >
                + Add Cough
              </button>
              <button
                onClick={handleReset}
                className="flex-1 py-4 px-6 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-xl transition-colors"
              >
                Stop & Save
              </button>
            </div>
          )}
        </div>

        {/* Instructions */}
        {state === "idle" && (
          <div className="text-center text-sm text-gray-500 space-y-1">
            <p>1. Tap &quot;Start Listening&quot; and allow microphone access</p>
            <p>2. Sounds louder than the background are checked by an AI cough classifier</p>
            <p>3. Tap any detected sound to correct it, or ▶ to hear it</p>
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
