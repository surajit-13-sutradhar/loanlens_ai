"use client";

import { useRef, useState, useCallback, useEffect } from "react";

const HF_API = "https://tanmoy-116-loanlens.hf.space/analyze";
const FRAME_INTERVAL_MS = 1500; // 1 frame per 1.5s — less hammering
const MAX_CONSECUTIVE_ERRORS = 3; // pause polling after this many 500s in a row

export interface FaceMonitorStats {
  totalSecs: number;
  noFaceSecs: number;
  multiFaceSecs: number;
  notLiveSecs: number;
  warning: string | null;
  apiStatus: "ok" | "error" | "idle"; // exposed for debug badge
}

export interface FaceMonitorResult {
  stats: FaceMonitorStats;
  isAnalyzing: boolean;
  startMonitoring: (videoEl: HTMLVideoElement) => void;
  stopMonitoring: () => void;
  triggerAgeDetection: () => Promise<string | null>;
}

export function useFaceMonitor(): FaceMonitorResult {
  const [stats, setStats] = useState<FaceMonitorStats>({
    totalSecs: 0,
    noFaceSecs: 0,
    multiFaceSecs: 0,
    notLiveSecs: 0,
    warning: null,
    apiStatus: "idle",
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const consecutiveErrorsRef = useRef(0);
  const pausedRef = useRef(false);

  // ── Capture a frame as base64 JPEG ────────────────────────────────────────
  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) return null;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    const canvas = canvasRef.current;
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, 320, 240);

    // Return full data URL — backend strips the prefix with split(",")[-1]
    return canvas.toDataURL("image/jpeg", 0.8);
  }, []);

  // ── Single frame analysis ─────────────────────────────────────────────────
  const analyzeFrame = useCallback(async (detectAge = false) => {
    const frame = captureFrame();
    if (!frame) {
      console.warn("[FaceMonitor] captureFrame returned null — video not ready?");
      return null;
    }

    try {
      const res = await fetch(HF_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: frame, detect_age: detectAge }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[FaceMonitor] API ${res.status}:`, errText);
        return null;
      }

      const data = await res.json();
      console.debug("[FaceMonitor] response:", data); // remove after debugging
      return data;
    } catch (err) {
      console.error("[FaceMonitor] fetch error:", err);
      return null;
    }
  }, [captureFrame]);

  // ── Main monitoring loop ──────────────────────────────────────────────────
  const startMonitoring = useCallback((videoEl: HTMLVideoElement) => {
    if (intervalRef.current) return;
    videoRef.current = videoEl;
    consecutiveErrorsRef.current = 0;
    pausedRef.current = false;
    setIsAnalyzing(true);

    intervalRef.current = setInterval(async () => {
      // Back off if Space keeps 500ing
      if (pausedRef.current) return;

      const data = await analyzeFrame(false);

      setStats((prev) => {
        const next: FaceMonitorStats = {
          ...prev,
          totalSecs: prev.totalSecs + Math.round(FRAME_INTERVAL_MS / 1000),
        };

        // ── API error ──
        if (!data || data.error) {
          consecutiveErrorsRef.current += 1;
          console.warn(`[FaceMonitor] consecutive errors: ${consecutiveErrorsRef.current}`);

          if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
            pausedRef.current = true;
            // Auto-resume after 10s to handle HF cold starts
            setTimeout(() => {
              pausedRef.current = false;
              consecutiveErrorsRef.current = 0;
              console.info("[FaceMonitor] resuming after backoff");
            }, 10_000);
            next.warning = "⚠️ Face analysis unavailable — retrying…";
          }

          next.apiStatus = "error";
          return next;
        }

        // ── Successful response ──
        consecutiveErrorsRef.current = 0;
        next.apiStatus = "ok";

        if (data.face_count === 0) {
          next.noFaceSecs = prev.noFaceSecs + Math.round(FRAME_INTERVAL_MS / 1000);
          next.warning = "⚠️ No face detected — please look at the camera";
        } else if (data.face_count > 1) {
          next.multiFaceSecs = prev.multiFaceSecs + Math.round(FRAME_INTERVAL_MS / 1000);
          next.warning = "⚠️ Multiple faces detected — only you should be visible";
        } else if (!data.is_live) {
          next.notLiveSecs = prev.notLiveSecs + Math.round(FRAME_INTERVAL_MS / 1000);
          next.warning = "⚠️ Liveness check failed — please move closer";
        } else {
          next.warning = null;
        }

        return next;
      });
    }, FRAME_INTERVAL_MS);
  }, [analyzeFrame]);

  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    videoRef.current = null;
    setIsAnalyzing(false);
  }, []);

  // ── On-demand age detection ───────────────────────────────────────────────
  const triggerAgeDetection = useCallback(async (): Promise<string | null> => {
    const data = await analyzeFrame(true);
    if (!data || data.error) return null;
    return data.age_range ?? null;
  }, [analyzeFrame]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { stats, isAnalyzing, startMonitoring, stopMonitoring, triggerAgeDetection };
}