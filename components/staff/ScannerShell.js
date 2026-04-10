"use client";

import { useState } from "react";
import Scanner from "./Scanner";

export default function ScannerShell({ staffName, staffRole, events }) {
  const [selectedEventId, setSelectedEventId] = useState(
    events.length === 1 ? events[0].id : ""
  );
  const [selectedVenueId, setSelectedVenueId] = useState(
    events.length === 1 ? events[0].venue_id : ""
  );
  const [started, setStarted] = useState(events.length === 1);

  function handleSelectEvent(e) {
    const eventId = e.target.value;
    setSelectedEventId(eventId);
    const event = events.find((ev) => ev.id === eventId);
    setSelectedVenueId(event?.venue_id || "");
  }

  function handleStart() {
    if (!selectedEventId) return;
    setStarted(true);
  }

  if (!started) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
        <div className="text-center">
          <div className="text-4xl mb-3">⚽</div>
          <h2 className="text-xl font-bold text-white mb-1">Select Event</h2>
          <p className="text-sm text-[#888888]">Choose the event you're scanning for tonight.</p>
        </div>

        <div className="w-full max-w-sm flex flex-col gap-4">
          {events.length === 0 ? (
            <div className="bg-[#111] border border-white/5 rounded-sm p-6 text-center">
              <p className="text-[#888888] text-sm">No active events found.</p>
              <p className="text-xs text-[#555] mt-1">Contact your administrator.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono tracking-widest text-[#888888] uppercase">
                  Event
                </label>
                <select
                  value={selectedEventId}
                  onChange={handleSelectEvent}
                  className="bg-[#111] border border-white/10 text-white text-sm px-4 py-3 rounded-sm focus:outline-none focus:border-[#39FF14]/50 transition-colors"
                >
                  <option value="">— Select event —</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name}
                      {ev.match_label ? ` · ${ev.match_label}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleStart}
                disabled={!selectedEventId}
                className="btn-green w-full py-4 text-base disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Start Scanning →
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Event info bar */}
      <div className="bg-[#0d0d0d] border-b border-white/5 px-4 py-2 flex items-center justify-between gap-3 flex-shrink-0">
        <div className="min-w-0">
          <p className="text-xs font-mono text-[#888888] uppercase tracking-widest truncate">
            Active Event
          </p>
          <p className="text-sm text-white font-semibold truncate">
            {events.find((e) => e.id === selectedEventId)?.name || "Unknown"}
          </p>
        </div>
        <button
          onClick={() => setStarted(false)}
          className="text-xs text-[#888888] hover:text-white transition-colors font-mono tracking-wider px-2 py-1 border border-white/10 rounded-sm flex-shrink-0"
        >
          Change
        </button>
      </div>

      {/* Scanner component */}
      <Scanner
        staffName={staffName}
        eventId={selectedEventId}
        venueId={selectedVenueId}
      />
    </div>
  );
}
