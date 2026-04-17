// src\api\agent\route.ts
import { NextRequest, NextResponse } from "next/server";
import { calculateLoanDecision } from "@/lib/underwriter";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const SYSTEM_PROMPT = `You are a warm KYC Loan Assistant for an Indian fintech app. 
Your goal is to extract 20 data points across 4 sections through a natural conversation.

SECTIONS:
1. Identity: fullName, dateOfBirth (DD/MM/YYYY), aadhaarOrPan (12 digits), currentAddress, consentGiven.
2. Employment: employmentType (Salaried/Self-Employed), employerOrBusiness, workTenureYears, monthlyNetIncome.
3. Obligations: hasExistingLoans, totalMonthlyEmi, usesCreditCards, hasMissedEmi, missedEmiCount, lastMissedEmiMonthsAgo, creditHistoryYears.
4. Needs: loanAmountNeeded, loanPurpose, loanUrgencyDays, preferredTenureMonths.

RULES:
- Ask ONLY ONE question at a time.
- Be friendly but professional.
- Use the 'Current State' provided to see what is missing.
- Validation: Reject invalid ages (<18), negative income, or non-12-digit Aadhaar.
- PRIVACY: NEVER repeat the full Aadhaar/PAN digits back to the user.
- Response must be ONLY valid JSON.

JSON SCHEMA:
{
  "reply": "Your next question or response",
  "extractedData": { 
    "fullName": null, 
    "dateOfBirth": null, 
    ... include all 20 keys ... 
  },
  "currentSection": 1,
  "isComplete": false
}`;
export async function POST(req: NextRequest) {
  let currentDataState = {};

  try {
    const { messages, currentData } = await req.json();
    currentDataState = currentData || {};

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: SYSTEM_PROMPT }, // Use your existing prompt
          ...messages.map((m: any) => ({
            role: m.role,
            content: m.text || m.content || "",
          })),
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);

    if (result.isComplete && result.extractedData) {
      result.loanDecision = calculateLoanDecision(result.extractedData);
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Groq Error:", error);
    return NextResponse.json({
      reply: "I'm having a quick connection hiccup. Can you repeat that?",
      extractedData: currentDataState,
      isComplete: false
    }, { status: 200 });
  }
}