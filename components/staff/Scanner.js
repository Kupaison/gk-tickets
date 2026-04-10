"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// Result display duration before auto-resetting
const RESET_DELAY_MS = 3500;

const RESULT_CONFIG = {
  valid: {
    bg: "bg-[#39FF14]",
    textColor: "text-black",
    border: "border-[#39FF14]",
    icon: "✅",
    label: "ENTRY GRANTED",
  },
  already_used: {
    bg: "bg-red-600",
    textColor: "text-white",
    border: "border-red-500",
    icon: "🚫",
    label: "ALREADY USED",
  },
  invalid: {
    bg: "bg-red-900",
    textColor: "text-white",
    border: "border-red-700",
    icon: "❌",
    label: "INVALID TICKET",
  },
  refunded: {
    bg: "bg-yellow-600",
    textColor: "text-black",
    border: "border-yellow-500",
    icon: "💰",
    label: "TICKET REFUNDED",
  },
  void: {
    bg: "bg-gray-700",
    textColor: "text-white",
    border: "border-gray-600",
    icon: "⛔",
    label: "TICKET VOID",
  },
  cancelled: {
    bg: "bg-gray-700",
    textColor: "text-white",
    border: "border-gray-600",
    icon: "⛔",
    label: "TICKET CANCELLED",
  },
};

export default function Scanner({ staffName, eventId, venueId }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const lastTokenRef = useRef(null);
  const resetTimerRef = useRef(null);

  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null); // { result, message, ticket }
  const [manualToken, setManualToken] = useState("");
  const [processing, setProcessing] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [scanCount, setScanCount] = useState(0);
  const [tab, setTab] = useState("camera"); // "camera" | "manual"

  // ── Camera setup ──────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" }, // rear camera
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setScanning(true);
        startFrameLoop();
      }
    } catch (err) {
      console.error("[scanner] Camera error:", err);
      setCameraError(
        err.name === "NotAllowedError"
          ? "Camera permission denied. Please allow camera access and reload."
          : "Could not access camera. Use manual entry below."
      );
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setScanning(false);
  }, []);

  // ── Frame scanning loop using BarcodeDetector API ─────────
  const startFrameLoop = useCallback(() => {
    if (!("BarcodeDetector" in window)) {
      setCameraError(
        "Your browser doesn't support camera scanning. Use the Manual Entry tab."
      );
      return;
    }

    const detector = new window.BarcodeDetector({ formats: ["qr_code"] });

    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current || processing) return;

      const video = videoRef.current;
      if (video.readyState < 2) return;

      try {
        const barcodes = await detector.detect(video);
        if (barcodes.length > 0) {
          const rawValue = barcodes[0].rawValue;

          // Extract token from URL if it's a full URL
          let token = rawValue;
          try {
            const url = new URL(rawValue);
            const t = url.searchParams.get("token");
            if (t) token = t;
          } catch {
            // rawValue is the token directly
          }

          if (token && token !== lastTokenRef.current) {
            lastTokenRef.current = token;
            await submitToken(token);
          }
        }
      } catch {
        // BarcodeDetector errors are usually transient — ignore
      }
    }, 400);
  }, [processing]);

  // ── Cleanup on unmount ────────────────────────────────────
  useEffect(() => {
    return () => {
      stopCamera();
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, [stopCamera]);

  // ── Auto-start camera on camera tab ───────────────────────
  useEffect(() => {
    if (tab === "camera") {
      startCamera();
    } else {
      stopCamera();
    }
  }, [tab]);

  // ── Submit token to check-in API ─────────────────────────
  const submitToken = useCallback(async (token) => {
    if (processing) return;
    setProcessing(true);

    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, eventId, venueId }),
      });

      const data = await res.json();

      if (res.status === 401) {
        window.location.href = "/staff/login";
        return;
      }

      setScanResult(data);
      setScanCount((c) => c + 1);

      // Vibrate on mobile
      if ("vibrate" in navigator) {
        navigator.vibrate(data.result === "valid" ? [100] : [100, 50, 100]);
      }

      // Auto-reset after delay
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        setScanResult(null);
        lastTokenRef.current = null;
        setProcessing(false);
      }, RESET_DELAY_MS);
    } catch (err) {
      console.error("[scanner] Submit error:", err);
      setScanResult({ result: "invalid", message: "Network error. Try again." });
      setTimeout(() => {
        setScanResult(null);
        lastTokenRef.current = null;
        setProcessing(false);
      }, 2000);
    }
  }, [processing, eventId, venueId]);

  // ── Manual entry submit ───────────────────────────────────
  async function handleManualSubmit(e) {
    e.preventDefault();
    const token = manualToken.trim();
    if (!token) return;
    await submitToken(token);
    setManualToken("");
  }

  const cfg = scanResult ? RESULT_CONFIG[scanResult.result] || RESULT_CONFIG.invalid : null;

  return (
    <div className="flex flex-col h-full">
      {/* Staff bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-[#0d0d0d]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#39FF14] animate-pulse" />
          <span className="text-xs font-mono text-[#888888]">{staffName}</span>
        </div>
        <span className="text-xs font-mono text-[#888888]">
          Scans: <span className="text-white">{scanCount}</span>
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5">
        {["camera", "manual"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-mono tracking-wider uppercase transition-colors ${
              tab === t
                ? "text-[#39FF14] border-b-2 border-[#39FF14] bg-[#39FF14]/5"
                : "text-[#888888] hover:text-white"
            }`}
          >
            {t === "camera" ? "📷 Camera" : "⌨️ Manual"}
          </button>
        ))}
      </div>

      {/* ── Result overlay ── */}
      {scanResult && cfg && (
        <div className={`${cfg.bg} px-6 py-5 flex items-center gap-4 transition-all`}>
          <span className="text-3xl">{cfg.icon}</span>
          <div className="flex-1 min-w-0">
            <p className={`font-bold text-lg tracking-wider ${cfg.textColor}`}>
              {cfg.label}
            </p>
            <p className={`text-sm ${cfg.textColor} opacity-80`}>
              {scanResult.message}
            </p>
            {scanResult.ticket && (
              <p className={`text-xs mt-1 ${cfg.textColor} opacity-70 font-mono`}>
                {scanResult.ticket.ticketNumber}
                {scanResult.ticket.attendeeName ? ` · ${scanResult.ticket.attendeeName}` : ""}
                {" · "}{scanResult.ticket.ticketTypeName}
              </p>
            )}
          </div>
          <div className={`text-xs ${cfg.textColor} opacity-60 font-mono flex-shrink-0`}>
            {(RESET_DELAY_MS / 1000).toFixed(0)}s
          </div>
        </div>
      )}

      {/* ── Camera tab ── */}
      {tab === "camera" && (
        <div className="flex-1 flex flex-col">
          {cameraError ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4 text-center">
              <span className="text-4xl">📷</span>
              <p className="text-[#888888] text-sm">{cameraError}</p>
              <button onClick={startCamera} className="btn-green text-sm">
                Try Again
              </button>
            </div>
          ) : (
            <div className="relative flex-1 bg-black">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
                autoPlay
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Scanning frame overlay */}
              {!scanResult && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative w-56 h-56">
                    {/* Corner brackets */}
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#39FF14]" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#39FF14]" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[#39FF14]" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#39FF14]" />
                    {/* Scan line animation */}
                    <div className="absolute left-1 right-1 h-0.5 bg-[#39FF14]/70 animate-[scanline_2s_ease-in-out_infinite]" />
                  </div>
                </div>
              )}

              {/* Status bar */}
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-4 py-3 text-center">
                {processing && !scanResult ? (
                  <p className="text-xs text-[#39FF14] font-mono animate-pulse">
                    Processing…
                  </p>
                ) : (
                  <p className="text-xs text-[#888888] font-mono">
                    {scanning ? "Point camera at QR code" : "Starting camera…"}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Manual entry tab ── */}
      {tab === "manual" && (
        <div className="flex-1 flex flex-col p-6 gap-6">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-mono text-[#888888] tracking-widest uppercase">
              Enter QR Token or Ticket Number
            </p>
            <p className="text-sm text-[#666]">
              Use this if the camera isn't working or for manual lookups.
            </p>
          </div>

          <form onSubmit={handleManualSubmit} className="flex flex-col gap-3">
            <input
              type="text"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="Paste QR token or ticket number…"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className="bg-[#0d0d0d] border border-white/10 text-white font-mono text-sm px-4 py-4 rounded-sm focus:outline-none focus:border-[#39FF14]/50 transition-colors placeholder:text-[#444]"
            />
            <button
              type="submit"
              disabled={processing || !manualToken.trim()}
              className="btn-green w-full py-4 text-base disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {processing ? "Checking…" : "Check Ticket →"}
            </button>
          </form>

          {/* Recent scan history placeholder */}
          <div className="border-t border-white/5 pt-4">
            <p className="text-xs font-mono text-[#444] tracking-widest uppercase text-center">
              Recent scans appear on camera tab
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
