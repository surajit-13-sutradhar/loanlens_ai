import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audio = formData.get("audio") as Blob | null;

    if (!audio) {
      return NextResponse.json({ error: "No audio provided" }, { status: 400 });
    }

    // Keep as webm/opus — Whisper handles it fine
    const mimeType = audio.type || "audio/webm;codecs=opus";
    const file = new File([audio], "audio.webm", { type: mimeType });

    const groqForm = new FormData();
    groqForm.append("file", file);
    groqForm.append("model", "whisper-large-v3");       // ← turbo is worse at Hindi
    groqForm.append("response_format", "json");  
    groqForm.append("language", "hi");                // ← tells Whisper to expect Hindi/Hinglish
    groqForm.append(
  "prompt",
  "Acha, theek hai."
);

    const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: groqForm,
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      console.error("Groq error:", err);
      return NextResponse.json(
        { error: "Groq transcription failed", detail: err },
        { status: 500 }
      );
    }

    const result = await groqRes.json();
    return NextResponse.json({ text: result.text ?? "" });
  } catch (err) {
    console.error("Transcribe route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}