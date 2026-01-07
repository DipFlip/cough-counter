"use client";

import { useAudioAnalyzer } from "@/hooks/useAudioAnalyzer";
import { useCoughDetector } from "@/hooks/useCoughDetector";
import { VolumeMeter } from "@/components/VolumeMeter";

export default function Home() {
  const { volume, isListening, error, start, stop } = useAudioAnalyzer();
  const {
    state,
    threshold,
    coughCount,
    coughsPerMinute,
    calibrationProgress,
    startCalibration,
    reset,
  } = useCoughDetector({ volume, isListening });

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
        showCoughFlash ? "bg-red-100" : "bg-gray-50"
      }`}
    >
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900">Cough Counter</h1>
          <p className="mt-2 text-gray-600">
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

        {/* Volume meter */}
        {isListening && (
          <div className="space-y-2">
            <VolumeMeter
              volume={volume}
              threshold={threshold}
              showThreshold={state === "counting"}
            />
          </div>
        )}

        {/* Calibration progress */}
        {state === "calibrating" && (
          <div className="space-y-2">
            <div className="text-center text-lg font-medium text-gray-700">
              Calibrating... {Math.round(calibrationProgress)}%
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-100"
                style={{ width: `${calibrationProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Stats */}
        {state === "counting" && (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-6 bg-white rounded-xl shadow-lg text-center">
              <div className="text-5xl font-bold text-blue-600">{coughCount}</div>
              <div className="mt-2 text-gray-500">Total Coughs</div>
            </div>
            <div className="p-6 bg-white rounded-xl shadow-lg text-center">
              <div className="text-5xl font-bold text-purple-600">
                {coughsPerMinute.toFixed(1)}
              </div>
              <div className="mt-2 text-gray-500">Per Minute</div>
            </div>
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
            <button
              onClick={handleReset}
              className="w-full py-4 px-6 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-xl transition-colors"
            >
              Reset
            </button>
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
