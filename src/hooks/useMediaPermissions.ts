"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export type PermissionStatus = "idle" | "requesting" | "granted" | "denied" | "error";

export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface MediaPermissionsState {
  // Statuses
  cameraStatus: PermissionStatus;
  micStatus: PermissionStatus;
  locationStatus: PermissionStatus;

  // Data
  stream: MediaStream | null;       // combined video + audio stream
  videoStream: MediaStream | null;  // video only
  audioStream: MediaStream | null;  // audio only
  location: GeoLocation | null;
  error: string | null;

  // Actions
  requestAll: () => Promise<void>;
  requestCamera: () => Promise<void>;
  requestMic: () => Promise<void>;
  requestLocation: () => Promise<void>;
  stopAll: () => void;
}

export function useMediaPermissions(): MediaPermissionsState {
  const [cameraStatus, setCameraStatus] = useState<PermissionStatus>("idle");
  const [micStatus, setMicStatus] = useState<PermissionStatus>("idle");
  const [locationStatus, setLocationStatus] = useState<PermissionStatus>("idle");

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Keep refs so stopAll() always has the latest streams
  const streamRef = useRef<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  const requestCamera = useCallback(async () => {
    try {
      setCameraStatus("requesting");
      setError(null);
      const vs = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
      });
      videoStreamRef.current = vs;
      setVideoStream(vs);
      setCameraStatus("granted");
    } catch (err) {
      setCameraStatus("denied");
      setError("Camera access denied. Please allow camera access and try again.");
      console.error("Camera error:", err);
    }
  }, []);

  const requestMic = useCallback(async () => {
    try {
      setMicStatus("requesting");
      setError(null);
      const as = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000, // Deepgram works best at 16kHz
        },
      });
      audioStreamRef.current = as;
      setAudioStream(as);
      setMicStatus("granted");
    } catch (err) {
      setMicStatus("denied");
      setError("Microphone access denied. Please allow microphone access and try again.");
      console.error("Mic error:", err);
    }
  }, []);

  const requestLocation = useCallback(async () => {
    try {
      setLocationStatus("requesting");
      setError(null);

      if (!navigator.geolocation) {
        throw new Error("Geolocation is not supported by this browser.");
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      });
      setLocationStatus("granted");
    } catch (err) {
      setLocationStatus("denied");
      setError("Location access denied. Location is required for compliance verification.");
      console.error("Location error:", err);
    }
  }, []);

  const requestAll = useCallback(async () => {
    try {
      setError(null);

      // Request camera + mic together (single browser prompt)
      setCameraStatus("requesting");
      setMicStatus("requesting");

      const combinedStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });

      // Split into separate streams for modular use
      const videoTracks = combinedStream.getVideoTracks();
      const audioTracks = combinedStream.getAudioTracks();

      const vs = new MediaStream(videoTracks);
      const as = new MediaStream(audioTracks);

      streamRef.current = combinedStream;
      videoStreamRef.current = vs;
      audioStreamRef.current = as;

      setStream(combinedStream);
      setVideoStream(vs);
      setAudioStream(as);

      setCameraStatus("granted");
      setMicStatus("granted");

      // Location separately (different browser prompt)
      await requestLocation();

    } catch (err) {
      setCameraStatus("denied");
      setMicStatus("denied");
      setError("Could not access camera or microphone. Please check browser permissions.");
      console.error("Media error:", err);
    }
  }, [requestLocation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      videoStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stopAll = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    videoStreamRef.current?.getTracks().forEach((t) => t.stop());
    audioStreamRef.current?.getTracks().forEach((t) => t.stop());

    streamRef.current = null;
    videoStreamRef.current = null;
    audioStreamRef.current = null;

    setStream(null);
    setVideoStream(null);
    setAudioStream(null);
    setLocation(null);

    setCameraStatus("idle");
    setMicStatus("idle");
    setLocationStatus("idle");
  }, []);

  return {
    cameraStatus,
    micStatus,
    locationStatus,
    stream,
    videoStream,
    audioStream,
    location,
    error,
    requestAll,
    requestCamera,
    requestMic,
    requestLocation,
    stopAll,
  };
}