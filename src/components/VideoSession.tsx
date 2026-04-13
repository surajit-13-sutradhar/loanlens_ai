"use client";

import { useEffect, useRef, useState } from "react";
import { useMediaPermissions } from "@/hooks/useMediaPermissions";

// ─── Types ────────────────────────────────────────────────────────────────────

type SessionState = "idle" | "active" | "stopped";
type PermStatus = "idle" | "requesting" | "granted" | "denied" | "error";
type MessageRole = "ai" | "user";

interface Message {
  id: string;
  role: MessageRole;
  text: string;
  ts: Date;
}

// ─── Demo script ──────────────────────────────────────────────────────────────
// Replace these with real Deepgram STT and LLM/TTS calls in the next phase.

const AI_SCRIPT: { delay: number; text: string }[] = [
  {
    delay: 800,
    text: "Hello! I'm your LoanLens AI assistant. I'll be guiding you through the verification process today. Could you please start by stating your full name?",
  },
  {
    delay: 9000,
    text: "Thank you. And can you confirm the last four digits of your Aadhaar number for our records?",
  },
  {
    delay: 18000,
    text: "Perfect. Now I'd like to ask about your monthly income. Please speak clearly and take your time.",
  },
  {
    delay: 27000,
    text: "Great. Based on what you've shared, I'll be generating your preliminary loan offer shortly. Is there anything you'd like to clarify before we proceed?",
  },
];

const USER_SCRIPT: { delay: number; text: string }[] = [
  { delay: 4500,  text: "My name is Arjun Sharma." },
  { delay: 13500, text: "The last four digits are 7 7 4 2." },
  { delay: 22500, text: "My monthly income is approximately eighty thousand rupees." },
  { delay: 31500, text: "No, I think that covers everything. Thank you." },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number) {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function PermBadge({ label, status }: { label: string; status: PermStatus }) {
  const colors: Record<PermStatus, string> = {
    idle:       "text-white/30 border-white/10",
    requesting: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
    granted:    "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
    denied:     "text-red-400 border-red-500/30 bg-red-500/10",
    error:      "text-red-400 border-red-500/30 bg-red-500/10",
  };
  const dot: Record<PermStatus, string> = {
    idle:       "bg-white/20",
    requesting: "bg-yellow-400 animate-pulse",
    granted:    "bg-emerald-400",
    denied:     "bg-red-400",
    error:      "bg-red-400",
  };
  return (
    <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${colors[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot[status]}`} />
      {label}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function VideoSession() {
  const {
    cameraStatus, micStatus, locationStatus,
    stream, videoStream, location, error,
    requestAll, stopAll,
  } = useMediaPermissions();

  const videoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scriptRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [aiTyping, setAiTyping] = useState(false);
  const [userTyping, setUserTyping] = useState(false);
  const [input, setInput] = useState("");

  // Attach camera stream to video element
  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
    }
  }, [videoStream]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, aiTyping, userTyping]);

  // ── Session start ────────────────────────────────────────────────────────

  const startSession = async () => {
    await requestAll();
    if (!stream) return;

    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.start(1000);
    recorderRef.current = recorder;

    setSessionState("active");
    setElapsed(0);
    setMessages([]);
    setDownloadUrl(null);

    timerRef.current = setInterval(() => setElapsed((t) => t + 1), 1000);

    // Schedule demo AI + user messages
    scheduleDemo();
  };

  // ── Session end ──────────────────────────────────────────────────────────

  const endSession = () => {
    recorderRef.current?.stop();
    stopAll();

    if (timerRef.current) clearInterval(timerRef.current);
    scriptRefs.current.forEach(clearTimeout);
    scriptRefs.current = [];
    setAiTyping(false);
    setUserTyping(false);

    setSessionState("stopped");

    setTimeout(() => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      setDownloadUrl(URL.createObjectURL(blob));
    }, 200);
  };

  // ── Demo script scheduler ────────────────────────────────────────────────

  const scheduleDemo = () => {
    const refs: ReturnType<typeof setTimeout>[] = [];

    AI_SCRIPT.forEach(({ delay, text }) => {
      // Show typing indicator 1.5s before message
      refs.push(setTimeout(() => setAiTyping(true),  delay - 1500 < 0 ? 0 : delay - 1500));
      refs.push(setTimeout(() => {
        setAiTyping(false);
        setMessages((prev) => [...prev, {
          id: crypto.randomUUID(), role: "ai", text, ts: new Date(),
        }]);
      }, delay));
    });

    USER_SCRIPT.forEach(({ delay, text }) => {
      refs.push(setTimeout(() => setUserTyping(true),  delay - 1200 < 0 ? 0 : delay - 1200));
      refs.push(setTimeout(() => {
        setUserTyping(false);
        setMessages((prev) => [...prev, {
          id: crypto.randomUUID(), role: "user", text, ts: new Date(),
        }]);
      }, delay));
    });

    scriptRefs.current = refs;
  };

  // Send message handler
  const sendMessage = () => {
    if (!input.trim()) return;

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "user",
        text: input,
        ts: new Date(),
      },
    ]);

    setInput("");
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Permission badges */}
      <div className="flex flex-wrap gap-2">
        <PermBadge label="Camera"      status={cameraStatus} />
        <PermBadge label="Microphone"  status={micStatus} />
        <PermBadge label="Location"    status={locationStatus} />
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
          {error}
        </p>
      )}

      {/* ── Split panel ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4 items-start">

        {/* Left — Video */}
        <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/5 relative aspect-video self-start">
          {/* Camera feed */}
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />

          {/* Idle overlay */}
          {sessionState === "idle" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 backdrop-blur-sm">
              <div className="w-14 h-14 rounded-full border border-white/20 flex items-center justify-center text-2xl">
                🎥
              </div>
              <p className="text-white/50 text-sm">Camera preview will appear here</p>
            </div>
          )}

          {/* Stopped overlay */}
          {sessionState === "stopped" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 backdrop-blur-sm">
              <p className="text-white/60 text-sm">Session ended</p>
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  download="session.webm"
                  className="text-xs text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 rounded-xl hover:bg-emerald-500/20 transition-colors"
                >
                  ↓ Download recording
                </a>
              )}
            </div>
          )}

          {/* Recording badge */}
          {sessionState === "active" && (
            <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-sm border border-white/10 rounded-full px-3 py-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-mono text-white/70">{formatTime(elapsed)}</span>
            </div>
          )}

          {/* GPS chip */}
          {location && sessionState === "active" && (
            <div className="absolute bottom-3 left-3 text-xs text-white/40 bg-black/50 backdrop-blur-sm border border-white/10 rounded-xl px-3 py-1.5 font-mono">
              {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
            </div>
          )}
        </div>

        {/* Right — Chat */}
        <div className="rounded-2xl border border-white/10 bg-white/5 flex flex-col h-full max-h-130">

          {/* Chat header */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10 shrink-0">
            <div className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-sm">
              🤖
            </div>
            <div>
              <p className="text-sm font-medium leading-none">LoanLens AI</p>
              <p className="text-xs text-white/30 mt-0.5">
                {sessionState === "active" ? (
                  <span className="text-emerald-400">● Live session</span>
                ) : sessionState === "stopped" ? (
                  <span className="text-white/30">Session ended</span>
                ) : (
                  "Start session to begin"
                )}
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin">
            {messages.length === 0 && !aiTyping && (
              <div className="h-full flex items-center justify-center">
                <p className="text-white/20 text-sm text-center">
                  The conversation will appear here once the session begins.
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <ChatBubble key={msg.id} message={msg} />
            ))}

            {/* AI typing indicator */}
            {aiTyping && (
              <div className="flex items-end gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/20 flex items-center justify-center text-xs shrink-0">
                  🤖
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3">
                  <TypingDots />
                </div>
              </div>
            )}

            {/* User transcribing indicator */}
            {userTyping && (
              <div className="flex items-end justify-end gap-2">
                <div className="bg-blue-600/20 border border-blue-500/20 rounded-2xl rounded-br-sm px-4 py-3">
                  <p className="text-xs text-blue-300/60 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    Transcribing…
                  </p>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input area */}
          <div className="px-3 py-3 border-t border-white/10 shrink-0">
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
              
              {/* Mic indicator */}
              <span
                className={`w-2 h-2 rounded-full ${
                  sessionState === "active" ? "bg-red-400 animate-pulse" : "bg-white/20"
                }`}
              />

              {/* Input */}
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder={
                  sessionState === "active"
                    ? "Type a message or speak..."
                    : "Start session to chat"
                }
                disabled={sessionState !== "active"}
                className="flex-1 bg-transparent outline-none text-sm text-white/80 placeholder:text-white/30"
              />

                  {/* Send button */}
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() || sessionState !== "active"}
                    className="text-xs px-3 py-1.5 rounded-lg bg-blue-600/80 hover:bg-blue-500 disabled:opacity-30 transition"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>

      {/* ── Controls ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {sessionState === "idle" && (
          <button
            onClick={startSession}
            className="bg-blue-600 hover:bg-blue-500 active:scale-[0.97] transition-all text-white text-sm font-medium rounded-xl px-6 py-2.5"
          >
            Start Session
          </button>
        )}
        {sessionState === "active" && (
          <button
            onClick={endSession}
            className="bg-red-600/80 hover:bg-red-500 active:scale-[0.97] transition-all text-white text-sm font-medium rounded-xl px-6 py-2.5 flex items-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            End Session
          </button>
        )}
        {sessionState === "stopped" && (
          <button
            onClick={() => { setSessionState("idle"); setMessages([]); setElapsed(0); }}
            className="bg-white/10 hover:bg-white/15 active:scale-[0.97] transition-all text-white text-sm font-medium rounded-xl px-6 py-2.5"
          >
            New Session
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ChatBubble({ message }: { message: Message }) {
  const isAI = message.role === "ai";

  return (
    <div className={`flex items-end gap-2 ${isAI ? "" : "flex-row-reverse"}`}>
      {/* Avatar */}
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
        isAI
          ? "bg-blue-500/20 border border-blue-500/20"
          : "bg-white/10 border border-white/10"
      }`}>
        {isAI ? "🤖" : "🧑"}
      </div>

      {/* Bubble */}
      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
        isAI
          ? "bg-white/5 border border-white/10 rounded-bl-sm"
          : "bg-blue-600/25 border border-blue-500/20 rounded-br-sm"
      }`}>
        <p className={`text-sm leading-relaxed ${isAI ? "text-white/80" : "text-blue-100/80"}`}>
          {message.text}
        </p>
        <p className="text-[10px] text-white/20 mt-1 text-right">
          {message.ts.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 h-4">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce"
          style={{ animationDelay: `${i * 150}ms`, animationDuration: "800ms" }}
        />
      ))}
    </div>
  );
}