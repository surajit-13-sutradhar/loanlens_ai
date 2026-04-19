import { NextRequest, NextResponse } from "next/server";
import { calculateLoanDecision } from "@/lib/underwriter";

const GROQ_API_KEY = process.env.GROQ_API_KEY;

const SYSTEM_PROMPT = `You are a KYC Loan Assistant for an Indian fintech app.
Consent is already given. Extract these fields through friendly conversation:

FIELDS (collect in order):
1. fullName, dateOfBirth (DD/MM/YYYY), aadhaarOrPan (12-digit), currentAddress
2. employmentType (Salaried/Self-Employed), employerOrBusiness, workTenureYears, monthlyNetIncome
3. hasExistingLoans, totalMonthlyEmi, usesCreditCards, hasMissedEmi, missedEmiCount, lastMissedEmiMonthsAgo, creditHistoryYears
4. loanAmountNeeded, loanPurpose, loanUrgencyDays, preferredTenureMonths

RULES:
- consentGiven is always true — never ask for it
- Ask ONE question per reply — include the question IN the reply, never say "Next question"
- Skip any field already non-null in extractedData
- Numbers must be numbers, not strings
- Never repeat Aadhaar/PAN back to user
- Return ONLY JSON, no extra text

{"reply":"...","extractedData":{"fullName":null,"dateOfBirth":null,"aadhaarOrPan":null,"currentAddress":null,"consentGiven":true,"employmentType":null,"employerOrBusiness":null,"workTenureYears":null,"monthlyNetIncome":null,"hasExistingLoans":null,"totalMonthlyEmi":null,"usesCreditCards":null,"hasMissedEmi":null,"missedEmiCount":null,"lastMissedEmiMonthsAgo":null,"creditHistoryYears":null,"loanAmountNeeded":null,"loanPurpose":null,"loanUrgencyDays":null,"preferredTenureMonths":null},"currentSection":1,"isComplete":false}`;

export async function POST(req: NextRequest) {
  let currentDataState = {};

  try {
    const { messages, currentData } = await req.json();

    // ✅ Always inject consentGiven=true — was already captured via video KYC
    currentDataState = { consentGiven: true, ...(currentData || {}) };

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "meta-llama/llama-4-scout-17b-16e-instruct", // ✅ better JSON compliance than 8b-instant
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            // ✅ Inject current state so model knows what's already collected
            {
              role: "system",
              content: `Current extracted data: ${JSON.stringify(currentDataState)}. Do NOT re-ask any field that already has a non-null value.`,
            },
            ...messages.map((m: any) => ({
              role: m.role === "bot" ? "assistant" : m.role,
              content: m.text || m.content || "",
            })),
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_tokens: 1024,
        }),
      }
    );

    // ✅ Fix 3 — check response.ok BEFORE parsing to catch Groq error responses
    if (!response.ok) {
      const errText = await response.text();
      console.error("Groq API error:", response.status, errText);
      throw new Error(`Groq returned ${response.status}: ${errText}`);
    }

    const data = await response.json();

    // ✅ Guard: log and throw if choices is missing
    if (!data.choices?.[0]?.message?.content) {
      console.error("Unexpected Groq response shape:", JSON.stringify(data));
      throw new Error("Groq response missing choices");
    }

    const result = JSON.parse(data.choices[0].message.content);

    // ✅ Always carry consentGiven forward
    if (result.extractedData) {
      result.extractedData.consentGiven = true;
    }

    if (result.isComplete && result.extractedData) {
      result.loanDecision = calculateLoanDecision(result.extractedData);
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Agent Error:", error.message);
    return NextResponse.json(
      {
        reply:
          "I'm having a quick connection hiccup. Could you repeat that?",
        extractedData: currentDataState,
        currentSection: 1,
        isComplete: false,
      },
      { status: 200 }
    );
  }
}