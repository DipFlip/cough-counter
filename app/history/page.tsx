"use client";

import { useState } from "react";
import Link from "next/link";
import { useRecordings, CoughRecording } from "@/hooks/useRecordings";
import { RecordingCard } from "@/components/RecordingCard";
import { ManualEntryForm } from "@/components/ManualEntryForm";

export default function HistoryPage() {
  const { recordings, isLoaded, addRecording, updateRecording, deleteRecording } =
    useRecordings();
  const [showManualEntry, setShowManualEntry] = useState(false);

  const handleAddManual = (recording: Omit<CoughRecording, "id">) => {
    addRecording(recording);
    setShowManualEntry(false);
  };

  const handleUpdateNote = (id: string, note: string) => {
    updateRecording(id, { note });
  };

  // Sort recordings by date (newest first)
  const sortedRecordings = [...recordings].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="min-h-screen bg-gray-900 p-4 pb-24">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">History</h1>
          <button
            onClick={() => setShowManualEntry(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            + Add Entry
          </button>
        </div>

        {/* Manual entry form */}
        {showManualEntry && (
          <ManualEntryForm
            onSubmit={handleAddManual}
            onCancel={() => setShowManualEntry(false)}
          />
        )}

        {/* Recordings list */}
        {!isLoaded ? (
          <div className="text-center text-gray-400 py-8">Loading...</div>
        ) : sortedRecordings.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <div className="text-4xl mb-2">📊</div>
            <div>No recordings yet</div>
            <div className="text-sm mt-1">
              Start a counting session or add a manual entry
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedRecordings.map((recording) => (
              <RecordingCard
                key={recording.id}
                recording={recording}
                onUpdateNote={handleUpdateNote}
                onDelete={deleteRecording}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700">
        <div className="max-w-2xl mx-auto flex">
          <Link
            href="/"
            className="flex-1 pt-3 pb-8 text-center text-gray-400 hover:text-white transition-colors"
          >
            <div className="text-xl">🎤</div>
            <div className="text-xs">Counter</div>
          </Link>
          <Link
            href="/history"
            className="flex-1 pt-3 pb-8 text-center text-white bg-gray-700"
          >
            <div className="text-xl">📊</div>
            <div className="text-xs">History</div>
          </Link>
        </div>
      </nav>
    </div>
  );
}
