"use client";

import { useEffect, useRef, useState } from "react";
import { useMediaPermissions } from "@/hooks/useMediaPermissions";
import { Button } from "@/components/ui/button";

type SessionState = "idle" | "active" | "stopped";

function VideoSession() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const blobsRef = useRef<Blob[]>([]);

  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [recordingTime, setRecordingTime] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const {
    cameraStatus,
    micStatus,
    locationStatus,
    stream,
    location,
    error,
    requestAll,
    stopAll,
  } = useMediaPermissions();

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (sessionState === "active") {
      interval = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [sessionState]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  useEffect(() => {
    if (!stream || sessionState !== "idle") return;
    if (cameraStatus !== "granted" || micStatus !== "granted") return;

    blobsRef.current = [];
    setDownloadUrl(null);
    setRecordingTime(0);

    const recorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp9,opus",
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) blobsRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(blobsRef.current, { type: "video/webm" });
      setDownloadUrl(URL.createObjectURL(blob));
    };

    recorder.start(1000);
    mediaRecorderRef.current = recorder;
    setSessionState("active");
  }, [stream, cameraStatus, micStatus, sessionState]);

  const stopSession = () => {
    mediaRecorderRef.current?.stop();
    stopAll();
    setSessionState("stopped");
  };

  const statusColor = (s: string) => {
    if (s === "granted") return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    if (s === "requesting") return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    if (s === "denied") return "bg-red-500/20 text-red-400 border-red-500/30";
    return "bg-white/10 text-white/40 border-white/10";
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      <div className="flex gap-2 flex-wrap">
        {[
          { label: "Camera", status: cameraStatus },
          { label: "Microphone", status: micStatus },
          { label: "Location", status: locationStatus },
        ].map(({ label, status }) => (
          <span
            key={label}
            className={`text-xs px-3 py-1 rounded-full border font-medium ${statusColor(status)}`}
          >
            {label}: {status}
          </span>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-white/5 border border-white/10">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
        />

        {sessionState === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
            <div className="w-16 h-16 rounded-full border-2 border-white/20 flex items-center justify-center">
              <svg className="w-7 h-7 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M15 10l4.553-2.277A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
              </svg>
            </div>
            <p className="text-white/40 text-sm">Camera not started</p>
          </div>
        )}

        {sessionState === "active" && (
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/50 rounded-full px-3 py-1.5 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white text-xs font-mono">{formatTime(recordingTime)}</span>
          </div>
        )}

        {sessionState === "stopped" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <p className="text-white/60 text-sm">Session ended</p>
          </div>
        )}
      </div>

      {location !== null && (
        <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/50 font-mono space-y-1">
          <p className="text-white/30 text-[10px] uppercase tracking-widest mb-1">Location captured</p>
          <p>Lat: {location.latitude.toFixed(6)}</p>
          <p>Lng: {location.longitude.toFixed(6)}</p>
          <p>Accuracy: ±{location.accuracy.toFixed(0)}m</p>
        </div>
      )}

      <div className="flex gap-3 items-center">
        {sessionState === "idle" && (
          <Button
            onClick={requestAll}
            className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-6"
          >
            Start Session
          </Button>
        )}

        {sessionState === "active" && (
          <Button
            onClick={stopSession}
            variant="destructive"
            className="rounded-xl px-6"
          >
            End Session
          </Button>
        )}

        {sessionState === "stopped" && downloadUrl !== null && (
          <a
            href={downloadUrl}
            download="session.webm"
            className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 underline underline-offset-4"
          >
            Download recording
          </a>
        )}
      </div>
    </div>
  ); 
    
}

export default VideoSession;