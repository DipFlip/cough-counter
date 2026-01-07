"use client";

import { useServiceWorker } from "@/hooks/useServiceWorker";

export function UpdatePrompt() {
  const { showUpdatePrompt, updateApp, dismissUpdate } = useServiceWorker();

  if (!showUpdatePrompt) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-50 max-w-md mx-auto">
      <div className="bg-blue-600 text-white rounded-xl p-4 shadow-lg flex items-center justify-between gap-3">
        <div className="flex-1">
          <div className="font-semibold">Update Available</div>
          <div className="text-sm text-blue-100">A new version is ready</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={dismissUpdate}
            className="px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-400 rounded-lg transition-colors"
          >
            Later
          </button>
          <button
            onClick={updateApp}
            className="px-3 py-1.5 text-sm bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors"
          >
            Update
          </button>
        </div>
      </div>
    </div>
  );
}
