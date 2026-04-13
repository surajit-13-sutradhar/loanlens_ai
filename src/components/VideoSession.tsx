"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useMediaPermissions } from "@/hooks/useMediaPermissions";
import { useTranscription } from "@/hooks/useTranscription";

// ─── Types ───────────────────────────────────────────────────────────────────

type SessionState = "idle" | "active" | "stopped";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({
  label,
  status,
}: {
  label: string;
  status: "granted" | "denied" | "pending" | "idle";
}) {
  const colors: Record<string, string> = {
    granted: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    denied: "bg-red-500/20 text-red-400 border-red-500/30",
    pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    idle: "bg-white/10 text-white/30 border-white/10",
  };
  const dots: Record<string, string> = {
    granted: "bg-emerald-400",
    denied: "bg-red-400",
    pending: "bg-yellow-400 animate-pulse",
    idle: "bg-white/20",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${colors[status]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dots[status]}`} />
      {label}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function VideoSession() {
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const blobChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Permissions hook
  const {
    stream,
    audioStream,
    videoStream,
    cameraStatus,
    micStatus,
    location,
    locationStatus,
    requestAll,
    requestLocation,
    stopAll,
  } = useMediaPermissions();

  // Transcription hook
  const {
    transcript,
    isListening,
    isTranscribing,
    startListening,
    stopListening,
    clearTranscript,
  } = useTranscription({
    silenceThreshold: 0.012,
    silenceDurationMs: 1400,
    maxChunkMs: 600,
  });

  // Auto-scroll transcript to bottom
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Attach video stream to <video> element
  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
    }
  }, [videoStream]);

  // ── Start session ────────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    const gotMedia = await requestAll();
    if (!gotMedia) return;

    // Location (non-blocking)
    requestLocation();

    setSessionState("active");
    setElapsed(0);
    setDownloadUrl(null);
    clearTranscript();

    // Timer
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  }, [requestAll, requestLocation, clearTranscript]);

  // Start recorders once stream is ready
  useEffect(() => {
    if (sessionState !== "active" || !stream || !audioStream) return;

    // ── Video MediaRecorder (for audit blob) ──
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";

    const mr = new MediaRecorder(stream, { mimeType });
    blobChunksRef.current = [];
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) blobChunksRef.current.push(e.data);
    };
    mr.start(1000);
    mediaRecorderRef.current = mr;

    // ── STT on audio stream ──
    startListening(audioStream);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionState, stream, audioStream]);

  // ── End session ─────────────────────────────────────────────────────────────
  const handleStop = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);

    // Stop video recorder
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      mr.stop();
      await new Promise<void>((res) => setTimeout(res, 200));
    }

    // Stop STT
    await stopListening();

    // Assemble video blob
    const blob = new Blob(blobChunksRef.current, { type: "video/webm" });
    if (blob.size > 0) {
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
    }

    stopAll();
    setSessionState("stopped");
  }, [stopListening, stopAll]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">

      {/* ── Permission badges ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <StatusBadge
          label="Camera"
          status={cameraStatus === "granted" ? "granted" : cameraStatus === "denied" ? "denied" : sessionState === "idle" ? "idle" : "pending"}
        />
        <StatusBadge
          label="Microphone"
          status={micStatus === "granted" ? "granted" : micStatus === "denied" ? "denied" : sessionState === "idle" ? "idle" : "pending"}
        />
        <StatusBadge
          label="Location"
          status={locationStatus === "granted" ? "granted" : locationStatus === "denied" ? "denied" : sessionState === "idle" ? "idle" : "pending"}
        />
        {isListening && (
          <StatusBadge label="STT Active" status="granted" />
        )}
        {isTranscribing && (
          <StatusBadge label="Transcribing…" status="pending" />
        )}
      </div>

      {/* ── Main two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 items-start">

        {/* ── Left: Video ── */}
        <div className="flex flex-col gap-4">
          <div className="relative rounded-2xl overflow-hidden bg-white/5 border border-white/10 aspect-video">

            {/* Live video feed */}
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover transition-opacity duration-500 ${
                sessionState === "active" ? "opacity-100" : "opacity-0"
              }`}
            />

            {/* Idle / stopped placeholder */}
            {sessionState !== "active" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <svg className="w-7 h-7 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
                    />
                  </svg>
                </div>
                <p className="text-white/30 text-sm">
                  {sessionState === "stopped" ? "Session ended" : "Camera inactive"}
                </p>
              </div>
            )}

            {/* Recording indicator + timer */}
            {sessionState === "active" && (
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-xl px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-white text-xs font-mono font-medium">
                  {formatTime(elapsed)}
                </span>
              </div>
            )}

            {/* GPS overlay */}
            {location && sessionState === "active" && (
              <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm rounded-xl px-3 py-1.5">
                <p className="text-white/50 text-xs font-mono">
                  {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                </p>
              </div>
            )}
          </div>

          {/* ── Controls ── */}
          <div className="flex items-center gap-3">
            {sessionState === "idle" && (
              <button
                onClick={handleStart}
                className="bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-white text-sm font-medium rounded-xl px-6 py-2.5"
              >
                Start Session
              </button>
            )}
            {sessionState === "active" && (
              <button
                onClick={handleStop}
                className="bg-red-600 hover:bg-red-500 active:scale-95 transition-all text-white text-sm font-medium rounded-xl px-6 py-2.5 flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                End Session
              </button>
            )}
            {sessionState === "stopped" && (
              <>
                <button
                  onClick={() => {
                    setSessionState("idle");
                    setElapsed(0);
                    clearTranscript();
                    setDownloadUrl(null);
                  }}
                  className="bg-white/10 hover:bg-white/15 active:scale-95 transition-all text-white text-sm font-medium rounded-xl px-6 py-2.5"
                >
                  New Session
                </button>
                {downloadUrl && (
                  <a
                    href={downloadUrl}
                    download="session.webm"
                    className="text-sm text-white/50 hover:text-white/80 border border-white/10 rounded-xl px-4 py-2.5 transition-colors"
                  >
                    Download Recording
                  </a>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Right: Transcript Panel ── */}
        <div className="rounded-2xl border border-white/10 bg-white/5 flex flex-col h-[460px]">

          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
              <span className="text-sm font-medium text-white/70">Live Transcript</span>
            </div>
            <div className="flex items-center gap-2">
              {isTranscribing && (
                <span className="text-xs text-yellow-400/80 animate-pulse">processing…</span>
              )}
              {transcript.length > 0 && sessionState === "stopped" && (
                <button
                  onClick={clearTranscript}
                  className="text-xs text-white/30 hover:text-white/60 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Transcript body */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
            {transcript.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                </div>
                <p className="text-white/20 text-xs leading-relaxed max-w-[180px]">
                  {sessionState === "idle"
                    ? "Start a session — your speech will appear here automatically."
                    : sessionState === "active"
                    ? "Listening… speak clearly and Whisper will transcribe your words."
                    : "No speech was captured in this session."}
                </p>
              </div>
            ) : (
              transcript.map((entry) => (
                <div key={entry.id} className="group flex flex-col gap-0.5">
                  <span className="text-[10px] text-white/20 font-mono">
                    {entry.timestamp.toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                  <p className="text-sm text-white/80 leading-relaxed">{entry.text}</p>
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>

          {/* Panel footer */}
          <div className="px-4 py-2.5 border-t border-white/10 shrink-0">
            <p className="text-[10px] text-white/20 text-center">
              {transcript.length === 0
                ? "Powered by Groq Whisper"
                : `${transcript.length} segment${transcript.length !== 1 ? "s" : ""} captured · Groq Whisper`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}