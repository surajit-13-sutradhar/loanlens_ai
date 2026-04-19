// hooks/useTTS.ts
import { useRef, useState, useCallback, useEffect } from "react";

export function useTTS() {
  const [isSpeaking, setIsSpeaking]         = useState(false);
  const [voices, setVoices]                 = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef                        = useRef<SpeechSynthesisUtterance | null>(null);

  // ── Load voices async — Chrome fires voiceschanged after page load ────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    const load = () => setVoices(window.speechSynthesis.getVoices());

    load(); // Firefox has them immediately
    window.speechSynthesis.addEventListener("voiceschanged", load); // Chrome needs this
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  const speak = useCallback((text: string) => {
    if (!text.trim() || typeof window === "undefined") return;

    window.speechSynthesis.cancel();
    setIsSpeaking(false);

    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;

    // Best Indian English voice → British → any English → system default
    const preferred =
      voices.find((v) => v.lang === "en-IN") ??
      voices.find((v) => v.lang === "en-GB") ??
      voices.find((v) => v.lang.startsWith("en")) ??
      null;

    if (preferred) utterance.voice = preferred;

    utterance.lang  = "en-IN";
    utterance.rate  = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend   = () => setIsSpeaking(false);
    utterance.onerror = (e) => {
      console.error("TTS error:", e.error);
      setIsSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  }, [voices]); // re-memoises once voices array is populated

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return { speak, stop, isSpeaking };
}