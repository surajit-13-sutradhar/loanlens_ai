"use client";

import { useRef, useState, useCallback } from "react";

export interface TranscriptEntry {
  id: string;
  text: string;
  timestamp: Date;
}

interface UseTranscriptionOptions {
  silenceThreshold?: number;
  silenceDurationMs?: number;
  maxChunkMs?: number;
}

export function useTranscription({
  silenceThreshold = 0.06,
  silenceDurationMs = 1200,
  maxChunkMs = 8000,
}: UseTranscriptionOptions = {}) {
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxChunkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vadFrameRef = useRef<number | null>(null);
  const chunkStartRef = useRef<number>(0);
  const isRecordingSegmentRef = useRef(false);

  // ─── Send current chunks to Groq Whisper ──────────────────────────────────
  const flushChunks = useCallback(async (mimeType: string) => {
    if (chunksRef.current.length === 0) return;

    const blob = new Blob(chunksRef.current, { type: mimeType });
    chunksRef.current = [];

    const chunkDuration = Date.now() - chunkStartRef.current;
    if (chunkDuration < 300 || blob.size < 500) return;

    // Noise gate: decode and check average energy before sending
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new AudioContext({ sampleRate: 16000 });
    try {
      const decoded = await audioContext.decodeAudioData(arrayBuffer);
      const pcm = decoded.getChannelData(0);
      let sumSq = 0;
      for (let i = 0; i < pcm.length; i++) sumSq += pcm[i] * pcm[i];
      const rms = Math.sqrt(sumSq / pcm.length);
      if (rms < 0.02) return;
    } catch {
      // decode failed — let it through
    } finally {
      await audioContext.close();
    }

    setIsTranscribing(true);
    try {
      const form = new FormData();
      form.append("audio", blob);

      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const data = await res.json();

      if (data.text && data.text.trim().length > 0) {
        setTranscript((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            text: data.text.trim(),
            timestamp: new Date(),
          },
        ]);
      }
    } catch (err) {
      console.error("Transcription error:", err);
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  // ─── VAD loop ─────────────────────────────────────────────────────────────
  const startVADLoop = useCallback(
    (mediaRecorder: MediaRecorder, mimeType: string) => {
      const analyser = analyserRef.current;
      if (!analyser) return;

      const dataArray = new Float32Array(analyser.fftSize);

      const loop = () => {
        analyser.getFloatTimeDomainData(dataArray);

        let sumSq = 0;
        for (let i = 0; i < dataArray.length; i++) sumSq += dataArray[i] * dataArray[i];
        const rms = Math.sqrt(sumSq / dataArray.length);
        const isSpeaking = rms > silenceThreshold;

        if (isSpeaking) {
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }

          if (!isRecordingSegmentRef.current) {
            isRecordingSegmentRef.current = true;
            chunkStartRef.current = Date.now();
            if (mediaRecorder.state === "inactive") {
              mediaRecorder.start();
            }

            maxChunkTimerRef.current = setTimeout(() => {
              if (mediaRecorder.state === "recording") mediaRecorder.stop();
              isRecordingSegmentRef.current = false;
              if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
              }
              setTimeout(() => flushChunks(mimeType), 100);
            }, maxChunkMs);
          }
        } else {
          if (isRecordingSegmentRef.current && !silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              if (mediaRecorder.state === "recording") mediaRecorder.stop();
              isRecordingSegmentRef.current = false;
              silenceTimerRef.current = null;
              if (maxChunkTimerRef.current) {
                clearTimeout(maxChunkTimerRef.current);
                maxChunkTimerRef.current = null;
              }
              setTimeout(() => flushChunks(mimeType), 100);
            }, silenceDurationMs);
          }
        }

        vadFrameRef.current = requestAnimationFrame(loop);
      };

      vadFrameRef.current = requestAnimationFrame(loop);
    },
    [silenceThreshold, silenceDurationMs, maxChunkMs, flushChunks]
  );

  // ─── Start listening ───────────────────────────────────────────────────────
  const startListening = useCallback(
    async (audioStream: MediaStream) => {
      if (isListening) return;

      const audioContext = new AudioContext({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(audioStream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg;codecs=opus";

      const mediaRecorder = new MediaRecorder(audioStream, { mimeType });
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      setIsListening(true);
      startVADLoop(mediaRecorder, mimeType);
    },
    [isListening, startVADLoop]
  );

  // ─── Stop listening ────────────────────────────────────────────────────────
  const stopListening = useCallback(async () => {
    if (!isListening) return;

    if (vadFrameRef.current) {
      cancelAnimationFrame(vadFrameRef.current);
      vadFrameRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (maxChunkTimerRef.current) {
      clearTimeout(maxChunkTimerRef.current);
      maxChunkTimerRef.current = null;
    }

    const mr = mediaRecorderRef.current;
    const mimeType = mr?.mimeType ?? "audio/webm";
    if (mr && mr.state !== "inactive") {
      mr.stop();
      await new Promise<void>((res) => setTimeout(res, 150));
    }
    await flushChunks(mimeType);

    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    mediaRecorderRef.current = null;
    isRecordingSegmentRef.current = false;
    setIsListening(false);
  }, [isListening, flushChunks]);

  const clearTranscript = useCallback(() => setTranscript([]), []);

  return {
    transcript,
    isListening,
    isTranscribing,
    startListening,
    stopListening,
    clearTranscript,
  };
}