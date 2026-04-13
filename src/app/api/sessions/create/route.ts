import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/sessionStore";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  const { name, phone, email } = await req.json();

  if (!name || !phone || !email) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const link = `${appUrl}/join/${id}`;

  createSession({
    id,
    name,
    phone,
    email,
    status: "pending",
    createdAt: new Date().toISOString(),
  });

  // Send email using same Gmail credentials as your Python setup
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
    return NextResponse.json({ error: "Email failed to send" }, { status: 500 });
  }

  return NextResponse.json({ message: "Session created", link });
}