"use client";

import { useAudioAnalyzer } from "@/hooks/useAudioAnalyzer";
import { useCoughDetector } from "@/hooks/useCoughDetector";
import { EKGDisplay } from "@/components/EKGDisplay";

export default function Home() {
  const { volume, isListening, error, start, stop } = useAudioAnalyzer();
  const {
    state,
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
  } = useCoughDetector({ volume, isListening });

  // Format elapsed time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStart = async () => {
    await start();
  };

  const handleCalibrate = () => {
    if (isListening) {
      startCalibration();
    }
  };

  const handleReset = () => {
    reset();
    stop();
  };

  // Flash effect when cough detected
  const showCoughFlash = state === "counting" && volume > threshold;

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center p-8 transition-colors duration-100 ${
        showCoughFlash ? "bg-red-900" : "bg-gray-900"
      }`}
    >
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white">Cough Counter</h1>
          <p className="mt-2 text-gray-400">
            {state === "idle" && "Calibrate your microphone to start counting"}
            {state === "calibrating" && "Cough now to calibrate!"}
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
        {isListening && (
          <EKGDisplay
            volume={volume}
            threshold={threshold}
            showThreshold={state === "counting"}
          />
        )}

        {/* Calibration progress */}
        {state === "calibrating" && (
          <div className="space-y-2">
            <div className="text-center text-lg font-medium text-gray-300">
              Calibrating... {Math.round(calibrationProgress)}%
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-100"
                style={{ width: `${calibrationProgress}%` }}
              />
            </div>
          </div>
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
                {coughsPerMinute.toFixed(2)}
              </div>
              <div className="mt-2 text-gray-400 text-sm">Per Minute</div>
            </div>
            <div className="p-4 bg-gray-800 rounded-xl text-center">
              <div className="text-4xl font-bold text-green-400 font-mono">
                {formatTime(elapsedSeconds)}
              </div>
              <div className="mt-2 text-gray-400 text-sm">Total Time</div>
            </div>
          </div>
        )}

        {/* Threshold controls */}
        {state === "counting" && (
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={lowerThreshold}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
            >
              − Threshold
            </button>
            <span className="text-gray-300 font-mono">
              {threshold.toFixed(1)}
            </span>
            <button
              onClick={raiseThreshold}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
            >
              + Threshold
            </button>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-4">
          {state === "idle" && !isListening && (
            <button
              onClick={handleStart}
              className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
            >
              Enable Microphone
            </button>
          )}

          {state === "idle" && isListening && (
            <button
              onClick={handleCalibrate}
              className="w-full py-4 px-6 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors"
            >
              Start Calibration
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
                Reset
              </button>
            </div>
          )}
        </div>

        {/* Instructions */}
        {state === "idle" && (
          <div className="text-center text-sm text-gray-500 space-y-1">
            <p>1. Click &quot;Enable Microphone&quot; to allow access</p>
            <p>2. Click &quot;Start Calibration&quot; and cough once</p>
            <p>3. The app will detect coughs at 75% of your calibration volume</p>
          </div>
        )}
      </div>
    </div>
  );
}
