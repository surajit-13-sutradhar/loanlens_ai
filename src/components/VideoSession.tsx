"use client";

import { useEffect, useRef, useState, useCallback, FormEvent } from "react";
import { useMediaPermissions } from "@/hooks/useMediaPermissions";
import { useTranscription } from "@/hooks/useTranscription";
import { useFaceMonitor } from "@/hooks/useFaceMonitor";

// ─── Types ────────────────────────────────────────────────────────────────────

type SessionState = "idle" | "active" | "stopped" | "completed";
type VerificationStep = "idle" | "analyzing" | "completed";

interface ExtractedKYCData {
  fullName?: string;
  dateOfBirth?: string;
  aadhaarOrPan?: string;
  currentAddress?: string;
  consentGiven?: boolean;
  employmentType?: "Salaried" | "Self-Employed" | "Unemployed";
  employerOrBusiness?: string;
  workTenureYears?: number;
  monthlyNetIncome?: number;
  hasExistingLoans?: boolean;
  totalMonthlyEmi?: number;
  usesCreditCards?: boolean;
  hasMissedEmi?: boolean;
  missedEmiCount?: number;
  lastMissedEmiMonthsAgo?: number | null;
  creditHistoryYears?: number;
  loanAmountNeeded?: number;
  loanPurpose?: string;
  loanUrgencyDays?: number;
  preferredTenureMonths?: number;
}

interface LoanOption {
  plan: "Safe" | "Balanced" | "Max";
  principalAmount: number;
  tenureMonths: number;
  annualInterestRate: number;
  monthlyEmi: number;
}

interface LoanDecision {
  decision: "APPROVE" | "REVIEW" | "REJECT";
  proxyScore: number;
  foir: number;
  foirStatus: "safe" | "moderate" | "risky";
  loanOptions: LoanOption[] | null;
  rejectionReasons?: string[];
}

type Message = { id: string; role: "bot" | "user"; text: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAN_ACCENT: Record<string, string> = {
  Safe:     "hover:border-emerald-500/40",
  Balanced: "hover:border-blue-500/40",
  Max:      "hover:border-amber-500/40",
};

const PLAN_LABEL_COLOR: Record<string, string> = {
  Safe:     "text-emerald-400",
  Balanced: "text-blue-400",
  Max:      "text-amber-400",
};

const PLAN_SELECTED_RING: Record<string, string> = {
  Safe:     "border-emerald-500/60 shadow-[0_0_24px_-6px_rgba(52,211,153,0.35)]",
  Balanced: "border-blue-500/60 shadow-[0_0_24px_-6px_rgba(96,165,250,0.35)]",
  Max:      "border-amber-500/60 shadow-[0_0_24px_-6px_rgba(251,191,36,0.35)]",
};

const PLAN_DOT: Record<string, string> = {
  Safe:     "bg-emerald-500",
  Balanced: "bg-blue-500",
  Max:      "bg-amber-500",
};

const FOIR_COLOR: Record<string, string> = {
  safe:     "bg-emerald-400",
  moderate: "bg-amber-400",
  risky:    "bg-red-400",
};

const FOIR_TEXT_COLOR: Record<string, string> = {
  safe:     "text-emerald-400",
  moderate: "text-amber-400",
  risky:    "text-red-400",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function inr(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
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
    denied:  "bg-red-500/20 text-red-400 border-red-500/30",
    pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    idle:    "bg-white/10 text-white/30 border-white/10",
  };
  const dots: Record<string, string> = {
    granted: "bg-emerald-400",
    denied:  "bg-red-400",
    pending: "bg-yellow-400 animate-pulse",
    idle:    "bg-white/20",
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

function MonitorStat({
  label,
  value,
  warn,
}: {
  label: string;
  value: number;
  warn: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-white/40">{label}</span>
      <span
        className={
          warn && value > 0
            ? "text-red-400 font-mono font-semibold"
            : "text-white/50 font-mono"
        }
      >
        {formatTime(value)}
      </span>
    </div>
  );
}

// ─── LoanOfferCard ────────────────────────────────────────────────────────────
// Receives selectedPlan + onSelect as props — no closure over external state

function LoanOfferCard({
  option,
  selectedPlan,
  onSelect,
}: {
  option: LoanOption;
  selectedPlan: string | null;
  onSelect: (opt: LoanOption) => void;
}) {
  const isSelected = selectedPlan === option.plan;

  return (
    <div
      onClick={() => onSelect(option)}
      className={`relative group p-6 rounded-2xl border transition-all cursor-pointer overflow-hidden ${
        PLAN_ACCENT[option.plan]
      } ${
        isSelected
          ? `bg-white/10 ${PLAN_SELECTED_RING[option.plan]}`
          : "bg-white/5 border-white/10"
      }`}
    >
      {/* Selection indicator */}
      <div
        className={`absolute top-5 left-5 w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center ${
          isSelected
            ? `border-current ${PLAN_DOT[option.plan].replace("bg-", "border-").replace("-500", "-500")}`
            : "border-white/20 group-hover:border-white/40"
        }`}
      >
        <div
          className={`w-2.5 h-2.5 rounded-full transition-all ${
            isSelected ? PLAN_DOT[option.plan] : "bg-transparent"
          }`}
        />
      </div>

      {/* Plan header */}
      <div className="flex justify-end items-center mb-8 pl-8">
        <span
          className={`text-[11px] font-bold uppercase tracking-widest ${PLAN_LABEL_COLOR[option.plan]}`}
        >
          {option.plan} Plan
        </span>
        <span className="text-xs font-bold text-white/50 bg-white/5 border border-white/10 px-3 py-1 rounded-md ml-3">
          {option.annualInterestRate}% APR
        </span>
      </div>

      {/* Principal amount */}
      <p className="text-3xl font-mono font-bold text-white mb-2">
        {inr(option.principalAmount)}
      </p>

      {/* EMI description */}
      <p className="text-white/50 text-xs mb-2">
        Pay{" "}
        <span className="text-white/80 font-mono font-medium">
          {inr(option.monthlyEmi)}
        </span>{" "}
        per month over{" "}
        <span className="text-white/80 font-medium">
          {option.tenureMonths} months
        </span>
        .
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function VideoSession() {
  const [sessionState, setSessionState]         = useState<SessionState>("idle");
  const [elapsed, setElapsed]                   = useState(0);
  const [downloadUrl, setDownloadUrl]           = useState<string | null>(null);
  const [messages, setMessages]                 = useState<Message[]>([]);
  const [chatInput, setChatInput]               = useState("");
  const [formData, setFormData]                 = useState<ExtractedKYCData>({});
  const [currentSection, setCurrentSection]     = useState(1);
  const [decision, setDecision]                 = useState<LoanDecision | null>(null);
  const [isComplete, setIsComplete]             = useState(false);
  const [isBotTyping, setIsBotTyping]           = useState(false);
  const [isVideoVerified, setIsVideoVerified]   = useState(false);
  const [isConsentOpen, setIsConsentOpen]       = useState(false);
  const [verificationStep, setVerificationStep] = useState<VerificationStep>("idle");
  const [detectedAge, setDetectedAge]           = useState<string | null>(null);
  const [offers, setOffers]                     = useState<LoanOption[] | null>(null);
  const [showOfferModal, setShowOfferModal]     = useState(false);
  // ✅ selectedOffer lives here in the parent — passed down as props to LoanOfferCard
  const [selectedOffer, setSelectedOffer]       = useState<LoanOption | null>(null);

  const videoRef         = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const blobChunksRef    = useRef<Blob[]>([]);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesEndRef   = useRef<HTMLDivElement>(null);
  const inputRef         = useRef<HTMLInputElement>(null);
  const triggerBotRef    = useRef<(msgs: Message[]) => Promise<void>>(async () => {});

  const {
    stream, audioStream, videoStream,
    cameraStatus, micStatus, location, locationStatus,
    requestAll, requestLocation, stopAll,
  } = useMediaPermissions();

  const {
    transcript, isListening, isTranscribing,
    startListening, stopListening, clearTranscript,
  } = useTranscription({ silenceThreshold: 0.012, silenceDurationMs: 1400 });

  const {
    stats: faceStats,
    startMonitoring,
    stopMonitoring,
    triggerAgeDetection,
  } = useFaceMonitor();

  // ── Derived ───────────────────────────────────────────────────────────────────
  const fieldsCaptured = Object.values(formData).filter(
    (v) => v !== null && v !== undefined
  ).length;
  const isRejected = isComplete && decision?.decision === "REJECT";
  // ✅ isApproved defined here — used in the offer modal condition
  const isApproved =
    isComplete &&
    (decision?.decision === "APPROVE" || decision?.decision === "REVIEW");

  // ── Video stream → <video> ────────────────────────────────────────────────────
  useEffect(() => {
    if (videoRef.current && videoStream)
      videoRef.current.srcObject = videoStream;
  }, [videoStream]);

  // ── Face monitor ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (sessionState === "active" && videoRef.current && videoStream) {
      const t = setTimeout(() => {
        if (videoRef.current) startMonitoring(videoRef.current);
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [sessionState, videoStream, startMonitoring]);

  // ── Video MediaRecorder ───────────────────────────────────────────────────────
  useEffect(() => {
    if (sessionState !== "active" || !stream || !audioStream) return;
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
  }, [sessionState, stream, audioStream]);

  // ── Declarative mic: ON when bot is idle ──────────────────────────────────────
  useEffect(() => {
    if (
      sessionState === "active" &&
      isVideoVerified &&
      !isComplete &&
      !isBotTyping
    ) {
      if (!isListening && audioStream) {
        const t = setTimeout(() => startListening(audioStream), 100);
        return () => clearTimeout(t);
      }
    }
  }, [sessionState, isVideoVerified, isComplete, isBotTyping, isListening, audioStream]);

  // ── STT → input box only (no auto-submit) ────────────────────────────────────
  useEffect(() => {
    if (!isListening || isBotTyping || transcript.length === 0) return;
    const latest = transcript[transcript.length - 1].text;
    setChatInput((prev) => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed} ${latest}` : latest;
    });
    inputRef.current?.focus();
  }, [transcript, isListening, isBotTyping]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isBotTyping]);

  // ── Agent API ──────────────────────────────────────────────────────────────────
  const triggerBotResponse = useCallback(
    async (currentMessages: Message[]) => {
      setIsBotTyping(true);
      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: currentMessages.map((m) => ({
              role: m.role === "bot" ? "assistant" : "user",
              content: m.text,
            })),
            currentData: formData,
          }),
        });
        if (!res.ok) throw new Error("API failed");
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          { id: Date.now().toString(), role: "bot", text: data.reply },
        ]);
        if (data.extractedData) setFormData(data.extractedData);
        if (data.currentSection) setCurrentSection(data.currentSection);
        if (data.isComplete) {
          setIsComplete(true);
          if (data.loanDecision) {
            setDecision(data.loanDecision);
            if (
              data.loanDecision.decision !== "REJECT" &&
              data.loanDecision.loanOptions?.length
            ) {
              setOffers(data.loanDecision.loanOptions);
              setSelectedOffer(null); // reset selection on new offers
              setShowOfferModal(true);
            }
          }
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "bot",
            text: "I'm having trouble connecting. Could you repeat that?",
          },
        ]);
      } finally {
        setIsBotTyping(false);
      }
    },
    [formData]
  );

  useEffect(() => {
    triggerBotRef.current = triggerBotResponse;
  }, [triggerBotResponse]);

  // ── Verification flow ─────────────────────────────────────────────────────────
  const runVerification = async () => {
    setVerificationStep("analyzing");
    let verified = false;
    let attempts = 0;

    while (!verified && attempts < 5) {
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const data = await triggerAgeDetection();
      if (data && data.face_count === 1 && data.is_live && data.age_range) {
        setDetectedAge(data.age_range);
        verified = true;
      } else {
        console.warn(`[Verification] Attempt ${attempts} failed`);
      }
    }

    if (verified) {
      setVerificationStep("completed");
      setIsVideoVerified(true);
      triggerBotResponse([]);
    } else {
      setVerificationStep("idle");
      alert(
        "Verification timed out. Please ensure you are in a well-lit area and try again."
      );
    }
  };

  // ── Submit handler ────────────────────────────────────────────────────────────
  const processUserResponse = async (userText: string) => {
    if (isComplete || sessionState !== "active" || isBotTyping) return;
    await stopListening();
    clearTranscript();
    setChatInput("");
    const newMessages: Message[] = [
      ...messages,
      { id: Date.now().toString(), role: "user", text: userText },
    ];
    setMessages(newMessages);
    await triggerBotResponse(newMessages);
  };

  const handleManualSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (text) await processUserResponse(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const text = chatInput.trim();
      if (text) processUserResponse(text);
    }
  };

  // ── Offer selection ───────────────────────────────────────────────────────────
  // ✅ Uses formData (not undefined extractedData)
  const handleSelection = async (
    offer: LoanOption | null,
    status: "accepted" | "rejected"
  ) => {
    console.log(`User ${status} the offer:`, offer);
    stopMonitoring();
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
    }
    const finalPayload = {
      userData: formData,
      selection: offer,
      status,
      timestamp: new Date().toISOString(),
    };
    console.log("Final payload for admin:", finalPayload);
    setShowOfferModal(false);
    setSessionState("completed");
  };

  // ── Session controls ──────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    const gotMedia = await requestAll();
    if (!gotMedia) return;
    requestLocation();
    setMessages([]);
    setChatInput("");
    setFormData({});
    setCurrentSection(1);
    setDecision(null);
    setIsComplete(false);
    setIsVideoVerified(false);
    setVerificationStep("idle");
    setDetectedAge(null);
    clearTranscript();
    setSessionState("active");
    setElapsed(0);
    setDownloadUrl(null);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  }, [requestAll, requestLocation, clearTranscript]);

  const handleStop = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    stopMonitoring();
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      mr.stop();
      await new Promise<void>((res) => setTimeout(res, 200));
    }
    await stopListening();
    const blob = new Blob(blobChunksRef.current, { type: "video/webm" });
    if (blob.size > 0) setDownloadUrl(URL.createObjectURL(blob));
    stopAll();
    setSessionState("stopped");
  }, [stopListening, stopAll, stopMonitoring]);

  const handleNewSession = useCallback(() => {
    setSessionState("idle");
    setElapsed(0);
    clearTranscript();
    setDownloadUrl(null);
    setDecision(null);
    setOffers(null);
    setSelectedOffer(null);
    setShowOfferModal(false);
    setVerificationStep("idle");
    setDetectedAge(null);
    setIsConsentOpen(true);
  }, [clearTranscript]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopAll();
      stopMonitoring();
    };
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">

      {/* ── Consent modal ─────────────────────────────────────────────────────── */}
      {isConsentOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#121212] border border-white/10 rounded-3xl max-w-md w-full p-8 shadow-2xl">
            <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20">
              <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-white mb-3">Video KYC Consent</h2>
            <p className="text-white/60 text-sm leading-relaxed mb-4">
              To proceed with your loan application, we need to record a short
              video session for identity verification. By clicking "I Agree," you
              consent to:
            </p>
            <ul className="list-disc list-inside mb-8 space-y-2 text-white/50 text-sm">
              <li>Recording of video and audio</li>
              <li>Real-time face liveness monitoring</li>
              <li>Collection of your current GPS location</li>
              <li>Processing of personal identity data</li>
            </ul>
            <div className="flex flex-col gap-3">
              <button
                onClick={async () => {
                  setIsConsentOpen(false);
                  await handleStart();
                  runVerification();
                }}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-4 rounded-2xl transition-all active:scale-95"
              >
                I Agree — Start Session
              </button>
              <button
                onClick={() => setIsConsentOpen(false)}
                className="w-full bg-white/5 hover:bg-white/10 text-white/40 text-sm py-3 rounded-2xl transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Offer modal — horizontal 3-card layout ─────────────────────────────── */}
      {showOfferModal && isApproved && offers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
          <div className="bg-[#1c1c1e] border border-white/10 w-full max-w-5xl rounded-[32px] overflow-hidden shadow-2xl p-10">

            {/* Header row */}
            <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-6">
              <div>
                <h2 className="text-3xl font-bold text-white mb-1">
                  Exclusive Offers For You
                </h2>
                <p className="text-white/50 text-sm">
                  Select a plan to proceed with documentation.
                </p>
              </div>

              {/* FOIR badge in header */}
              {decision && (
                <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-5 py-3">
                  <div
                    className={`w-2 h-2 rounded-full animate-pulse ${FOIR_COLOR[decision.foirStatus]}`}
                  />
                  <div className="text-sm font-medium">
                    <span className="text-white/40">FOIR</span>
                    <span
                      className={`ml-2 font-mono ${FOIR_TEXT_COLOR[decision.foirStatus]}`}
                    >
                      {decision.foir.toFixed(1)}% —{" "}
                      {decision.foirStatus.toUpperCase()}
                    </span>
                  </div>
                  <span className="text-xs text-white/30 font-mono border-l border-white/10 pl-3">
                    Score: {decision.proxyScore}
                  </span>
                </div>
              )}
            </div>

            {/* ✅ 3 horizontal cards — selectedOffer + onSelect passed as props */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              {offers.map((opt) => (
                <LoanOfferCard
                  key={opt.plan}
                  option={opt}
                  selectedPlan={selectedOffer?.plan ?? null}
                  onSelect={setSelectedOffer}
                />
              ))}
            </div>

            {/* Bottom actions */}
            <div className="flex items-center justify-end gap-4 border-t border-white/10 pt-8">
              <button
                onClick={() => handleSelection(null, "rejected")}
                className="bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors text-sm font-medium rounded-xl px-8 py-3.5"
              >
                Decline Offers
              </button>

              <button
                disabled={selectedOffer === null}
                onClick={() =>
                  selectedOffer && handleSelection(selectedOffer, "accepted")
                }
                className="bg-green-600 disabled:bg-white/10 disabled:text-white/20 disabled:border-white/5 text-white transition-all text-sm font-medium rounded-xl px-12 py-3.5 flex items-center gap-2 group border border-green-500/50 disabled:border-transparent disabled:cursor-not-allowed"
              >
                {selectedOffer === null ? (
                  "Select an Offer to Accept"
                ) : (
                  <>
                    Accept{" "}
                    <span className="text-green-200 font-mono group-hover:scale-105 transition-transform">
                      {inr(selectedOffer.principalAmount)}
                    </span>{" "}
                    Offer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Application submitted screen ───────────────────────────────────────── */}
      {sessionState === "completed" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="bg-[#121212] border border-white/10 rounded-3xl max-w-sm w-full p-10 text-center shadow-2xl">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
              <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-white mb-3">
              Application Submitted
            </h2>
            <p className="text-white/50 text-sm leading-relaxed mb-8">
              Your loan application has been received. Our team will review your
              KYC details and reach out within 24–48 hours.
            </p>
            <button
              onClick={() => {
                setSessionState("idle");
                setIsComplete(false);
                setDecision(null);
                setOffers(null);
                setSelectedOffer(null);
                setMessages([]);
                setFormData({});
              }}
              className="w-full bg-white/10 hover:bg-white/15 text-white text-sm font-medium py-3 rounded-2xl transition-all active:scale-95"
            >
              Back to Home
            </button>
          </div>
        </div>
      )}

      {/* ── Permission badges ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <StatusBadge
          label="Camera"
          status={
            cameraStatus === "granted" ? "granted"
            : cameraStatus === "denied" ? "denied"
            : sessionState === "idle" ? "idle"
            : "pending"
          }
        />
        <StatusBadge
          label="Microphone"
          status={
            micStatus === "granted" ? "granted"
            : micStatus === "denied" ? "denied"
            : sessionState === "idle" ? "idle"
            : "pending"
          }
        />
        <StatusBadge
          label="Location"
          status={
            locationStatus === "granted" ? "granted"
            : locationStatus === "denied" ? "denied"
            : sessionState === "idle" ? "idle"
            : "pending"
          }
        />
        {isListening    && <StatusBadge label="Listening…"       status="granted" />}
        {isTranscribing && <StatusBadge label="Transcribing…"    status="pending" />}
        {isBotTyping    && <StatusBadge label="Agent Processing" status="pending" />}
        {verificationStep === "analyzing" && (
          <StatusBadge label="Verifying Identity…" status="pending" />
        )}
        {sessionState === "active" && faceStats.warning && (
          <StatusBadge label={faceStats.warning} status="denied" />
        )}
      </div>

      {/* ── Main two-column layout ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4 items-start">

        {/* ── Left: Video + stats + controls ────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="relative rounded-2xl overflow-hidden bg-white/5 border border-white/10 aspect-video">
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                  </svg>
                </div>
                <p className="text-white/30 text-sm">
                  {sessionState === "stopped" ? "Session ended" : "Camera inactive"}
                </p>
              </div>
            )}

            {/* Recording timer */}
            {sessionState === "active" && (
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-xl px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-white text-xs font-mono font-medium">
                  {formatTime(elapsed)}
                </span>
              </div>
            )}

            {/* Age verification overlay */}
            {sessionState === "active" && verificationStep === "analyzing" && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center z-30 p-6 text-center">
                <div className="w-20 h-20 mb-4 relative">
                  <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full" />
                  <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">
                  Verifying Identity
                </h3>
                <p className="text-white/60 text-sm">
                  Please stay still and look directly into the camera…
                </p>
                {faceStats.warning && (
                  <p className="mt-4 text-red-400 text-xs font-medium bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20">
                    {faceStats.warning}
                  </p>
                )}
                {detectedAge && (
                  <p className="mt-3 text-emerald-400 text-xs font-mono">
                    Age group: {detectedAge}
                  </p>
                )}
              </div>
            )}

            {/* Presence verification overlay */}
            {sessionState === "active" &&
              verificationStep === "idle" &&
              !faceStats.warning && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-10">
                  <p className="text-white font-medium text-sm animate-pulse">
                    Verifying presence…
                  </p>
                </div>
              )}

            {/* Face warning banner */}
            {sessionState === "active" &&
              verificationStep !== "analyzing" &&
              faceStats.warning && (
                <div className="absolute bottom-14 left-0 right-0 flex justify-center z-20">
                  <div className="bg-red-500/90 backdrop-blur-sm text-white text-xs font-medium px-4 py-2 rounded-xl">
                    {faceStats.warning}
                  </div>
                </div>
              )}

            {/* GPS */}
            {location && sessionState === "active" && (
              <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm rounded-xl px-3 py-1.5 z-10">
                <p className="text-white/50 text-xs font-mono">
                  {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                </p>
              </div>
            )}
          </div>

          {/* Face monitor stats */}
          {(sessionState === "active" || sessionState === "stopped") && (
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 flex flex-col gap-2">
              <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1">
                Face Monitor
              </p>
              <MonitorStat label="No face detected" value={faceStats.noFaceSecs}    warn={true} />
              <MonitorStat label="Multiple faces"    value={faceStats.multiFaceSecs} warn={true} />
              <MonitorStat label="Liveness failed"   value={faceStats.notLiveSecs}   warn={true} />
              {detectedAge && (
                <div className="flex items-center justify-between text-xs border-t border-white/5 pt-2 mt-1">
                  <span className="text-white/40">Detected age group</span>
                  <span className="text-emerald-400 font-mono">{detectedAge}</span>
                </div>
              )}
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-3">
            {sessionState === "idle" && (
              <button
                onClick={() => setIsConsentOpen(true)}
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
                  onClick={handleNewSession}
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

        {/* ── Right: Agent panel ─────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-white/10 bg-white/5 flex flex-col h-[520px] overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0 bg-black/20">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span
                  className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    sessionState === "active" && !isComplete
                      ? "animate-ping bg-emerald-400"
                      : "bg-white/30"
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    sessionState === "active" && !isComplete
                      ? "bg-emerald-500"
                      : "bg-white/40"
                  }`}
                />
              </span>
              <span className="text-sm font-medium text-white/70">
                {isComplete ? "Application Review" : `Section ${currentSection} of 4`}
              </span>
            </div>
            <span className="text-xs text-emerald-400 font-mono">
              {fieldsCaptured} fields captured
            </span>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">

            {/* Rejected state */}
            {isRejected && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 gap-4">
                <div className="w-14 h-14 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-medium mb-1">
                    Application Declined
                  </h3>
                  <p className="text-white/40 text-xs leading-relaxed max-w-[240px]">
                    {decision?.rejectionReasons?.join(" ") ||
                      "Based on your FOIR and credit profile, we cannot proceed at this time."}
                  </p>
                </div>
                {decision && (
                  <p className="text-[10px] text-white/20 font-mono">
                    Proxy score: {decision.proxyScore} · FOIR:{" "}
                    {decision.foir.toFixed(1)}%
                  </p>
                )}
              </div>
            )}

            {/* Chat messages */}
            {!isRejected && (
              <>
                {messages.length === 0 && sessionState === "idle" && (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <p className="text-white/30 text-sm">
                      Start the session to begin the automated interview.
                    </p>
                  </div>
                )}
                {messages.length === 0 &&
                  sessionState === "active" &&
                  !isVideoVerified && (
                    <div className="h-full flex flex-col items-center justify-center text-center gap-2">
                      <p className="text-white/30 text-sm animate-pulse">
                        Verifying your identity…
                      </p>
                    </div>
                  )}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex w-full ${msg.role === "bot" ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`max-w-[85%] px-4 py-2.5 text-sm leading-relaxed ${
                        msg.role === "bot"
                          ? "bg-white/10 text-white/80 rounded-2xl rounded-tl-sm border border-white/5"
                          : "bg-blue-600 text-white rounded-2xl rounded-tr-sm shadow-md"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isBotTyping && (
                  <div className="flex w-full justify-start">
                    <div className="px-4 py-3 bg-white/5 rounded-2xl rounded-tl-sm border border-white/5 flex gap-1.5 items-center">
                      <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "0.15s" }} />
                      <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "0.3s" }} />
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {!isComplete && (
            <form
              onSubmit={handleManualSubmit}
              className="p-3 border-t border-white/10 bg-black/20 flex gap-2 shrink-0 items-center relative"
            >
              {isListening && !isBotTyping && (
                <div className="absolute -top-6 left-4 text-[10px] text-white/40 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  Speech filling box — edit if needed, then press Send
                </div>
              )}
              <input
                ref={inputRef}
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={
                  sessionState !== "active" ||
                  !isVideoVerified ||
                  isBotTyping
                }
                placeholder={
                  sessionState === "idle"
                    ? "Waiting to start…"
                    : verificationStep === "analyzing"
                    ? "Verifying identity…"
                    : !isVideoVerified
                    ? "Verifying video…"
                    : isBotTyping
                    ? "Agent is typing…"
                    : isListening
                    ? "Speak — text appears here…"
                    : "Type your answer…"
                }
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/30 focus:bg-white/10 transition-all disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={
                  !chatInput.trim() ||
                  sessionState !== "active" ||
                  !isVideoVerified ||
                  isBotTyping
                }
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 active:scale-95 transition-all text-white p-2.5 rounded-xl flex items-center justify-center"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}