// app/api/agent/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const SYSTEM_PROMPT = `You are a conversational KYC Onboarding Assistant. Your goal is to collect exactly the following 7 pieces of information from the user:
- name (Full legal name)
- age (Numeric)
- citizenship (Country)
- employmentStatus (Employed, Self-Employed, Unemployed)
- workLocation (Company name or location)
- jobDescription (Brief role summary)
- salary (Approximate annual salary)

CURRENT STATE:
You will receive the current chat history and the data extracted so far.

YOUR RULES:
1. Review the user's latest response.
2. Validate their answer. If it does not make sense or fails to answer the question, DO NOT extract the data. Instead, politely explain the issue and ask them to rephrase.
3. If the answer is valid, update the extractedData object.
4. Ask for ONLY ONE missing piece of information at a time in a friendly, conversational tone.
5. If all 7 fields have been successfully extracted, set "isComplete" to true and thank the user.

You MUST respond strictly in JSON format matching this schema:
{
  "reply": "Your next conversational message to the user",
  "extractedData": { 
     // Include ALL previously extracted fields, plus any new ones you just validated
  },
  "isComplete": boolean
}`;

export async function POST(req: NextRequest) {
  try {
    const { messages, currentData } = await req.json();

    const payload = {
      model: "llama-3.1-8b-instant", // Exceptionally fast, perfect for chat
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        // Inject current data state into the context
        { role: "system", content: `Data extracted so far: ${JSON.stringify(currentData)}` },
        ...messages
      ],
      response_format: { type: "json_object" },
      temperature: 0.3, // Low temperature for consistent JSON and strict extraction
    };

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Groq API Error: ${await res.text()}`);
    }

    const data = await res.json();
    const result = JSON.parse(data.choices[0].message.content);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Agent API Error:", error);
    return NextResponse.json({ error: "Failed to process message" }, { status: 500 });
  }
}