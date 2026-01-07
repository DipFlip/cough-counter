"use client";

import { useState } from "react";
import { CoughRecording } from "@/hooks/useRecordings";

interface ManualEntryFormProps {
  onSubmit: (recording: Omit<CoughRecording, "id">) => void;
  onCancel: () => void;
}

export function ManualEntryForm({ onSubmit, onCancel }: ManualEntryFormProps) {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("12:00");
  const [totalCoughs, setTotalCoughs] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [note, setNote] = useState("");

  const coughs = parseInt(totalCoughs) || 0;
  const minutes = parseFloat(durationMinutes) || 0;
  const calculatedCPH = minutes > 0 ? (coughs / minutes) * 60 : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (coughs <= 0 || minutes <= 0) {
      alert("Please enter valid coughs and duration");
      return;
    }

    const dateTime = new Date(`${date}T${time}`);

    onSubmit({
      date: dateTime.toISOString(),
      totalCoughs: coughs,
      totalTime: Math.round(minutes * 60),
      avgCPH: calculatedCPH,
      note,
      isManual: true,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-800 rounded-xl p-4 space-y-4">
      <h3 className="text-lg font-semibold text-white">Add Manual Entry</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-gray-400 text-sm block mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-gray-700 text-white rounded-lg p-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="text-gray-400 text-sm block mb-1">Time</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full bg-gray-700 text-white rounded-lg p-2 text-sm"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-gray-400 text-sm block mb-1">Total Coughs</label>
          <input
            type="number"
            value={totalCoughs}
            onChange={(e) => setTotalCoughs(e.target.value)}
            placeholder="e.g., 15"
            min="0"
            className="w-full bg-gray-700 text-white rounded-lg p-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="text-gray-400 text-sm block mb-1">Duration (minutes)</label>
          <input
            type="number"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            placeholder="e.g., 10"
            min="0.1"
            step="0.1"
            className="w-full bg-gray-700 text-white rounded-lg p-2 text-sm"
            required
          />
        </div>
      </div>

      {/* Calculated CPH preview */}
      {coughs > 0 && minutes > 0 && (
        <div className="bg-gray-700 rounded-lg p-3 text-center">
          <div className="text-gray-400 text-sm">Calculated CPH (per hour)</div>
          <div className="text-2xl font-bold text-purple-400">{calculatedCPH.toFixed(1)}</div>
        </div>
      )}

      <div>
        <label className="text-gray-400 text-sm block mb-1">Note (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add any notes about this recording..."
          className="w-full bg-gray-700 text-white rounded-lg p-2 text-sm resize-none"
          rows={2}
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors"
        >
          Save Entry
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-xl transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
