"use client";

interface VolumeMeterProps {
  volume: number;
  threshold?: number;
  showThreshold?: boolean;
}

export function VolumeMeter({ volume, threshold = 0, showThreshold = false }: VolumeMeterProps) {
  const isAboveThreshold = showThreshold && volume > threshold;

  return (
    <div className="w-full max-w-md">
      <div className="relative h-8 bg-gray-200 rounded-full overflow-hidden">
        {/* Volume bar */}
        <div
          className={`h-full transition-all duration-75 ${
            isAboveThreshold ? "bg-red-500" : "bg-green-500"
          }`}
          style={{ width: `${Math.min(100, volume)}%` }}
        />

        {/* Threshold marker */}
        {showThreshold && threshold > 0 && (
          <div
            className="absolute top-0 bottom-0 w-1 bg-yellow-500"
            style={{ left: `${Math.min(100, threshold)}%` }}
          />
        )}
      </div>

      {/* Labels */}
      <div className="flex justify-between mt-1 text-sm text-gray-500">
        <span>0</span>
        {showThreshold && threshold > 0 && (
          <span className="text-yellow-600">Threshold: {threshold.toFixed(1)}</span>
        )}
        <span>100</span>
      </div>
    </div>
  );
}
