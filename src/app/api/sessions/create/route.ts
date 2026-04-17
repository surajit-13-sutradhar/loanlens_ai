import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  const { name, phone, email } = await req.json();

  if (!name || !phone || !email) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const link = `${appUrl}/join/${id}`;

  // Insert into Supabase
  const { error: dbError } = await supabase
    .from('loan_sessions')
    .insert([{ id, name, phone, email, status: 'pending' }]);

  if (dbError) {
    console.error("DB Error:", dbError);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }

  // Send email
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: email,
      subject: "Your Loan Onboarding Link — Veridian",
      text: `Hi ${name},\n\nComplete your loan onboarding using the link below:\n\n${link}\n\nThis link is unique to you. Please do not share it.\n\nRegards,\nVeridian Team`,
    });
  } catch (err) {
    console.error("Email error:", err);
    // Even if email fails, DB record was created. You might want to handle this edge case.
    return NextResponse.json({ error: "Email failed to send" }, { status: 500 });
  }

  return NextResponse.json({ message: "Session created", link });
}