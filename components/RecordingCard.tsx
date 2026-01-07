"use client";

import { useState } from "react";
import { CoughRecording } from "@/hooks/useRecordings";

interface RecordingCardProps {
  recording: CoughRecording;
  onUpdateNote: (id: string, note: string) => void;
  onDelete: (id: string) => void;
}

export function RecordingCard({ recording, onUpdateNote, onDelete }: RecordingCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState(recording.note);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleSaveNote = () => {
    onUpdateNote(recording.id, noteValue);
    setEditingNote(false);
  };

  return (
    <div className="bg-gray-800 rounded-xl p-4 space-y-3">
      {/* Header row - clickable to expand */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{recording.isManual ? "✏️" : "🎤"}</span>
          <div>
            <div className="text-white font-medium">{formatDate(recording.date)}</div>
            <div className="text-gray-400 text-sm">
              {recording.totalCoughs} coughs • {formatTime(recording.totalTime)}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-purple-400">
            {recording.avgCPH.toFixed(1)}
          </div>
          <div className="text-gray-400 text-xs">CPH</div>
        </div>
      </div>

      {/* Note preview (if has note and not expanded) */}
      {recording.note && !isExpanded && (
        <div className="text-gray-400 text-sm truncate pl-11">
          📝 {recording.note}
        </div>
      )}

      {/* Expanded content */}
      {isExpanded && (
        <div className="pt-3 border-t border-gray-700 space-y-3">
          {/* Note section */}
          <div>
            <label className="text-gray-400 text-sm block mb-1">Note</label>
            {editingNote ? (
              <div className="space-y-2">
                <textarea
                  value={noteValue}
                  onChange={(e) => setNoteValue(e.target.value)}
                  className="w-full bg-gray-700 text-white rounded-lg p-2 text-sm resize-none"
                  rows={3}
                  placeholder="Add a note..."
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveNote}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setNoteValue(recording.note);
                      setEditingNote(false);
                    }}
                    className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingNote(true);
                }}
                className="bg-gray-700 rounded-lg p-2 text-sm text-gray-300 cursor-pointer hover:bg-gray-600 min-h-[60px]"
              >
                {recording.note || "Click to add a note..."}
              </div>
            )}
          </div>

          {/* Delete button */}
          <div className="flex justify-end">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm("Delete this recording?")) {
                  onDelete(recording.id);
                }
              }}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
