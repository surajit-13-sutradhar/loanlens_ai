import { NextResponse } from "next/server";
import { getSessions } from "@/lib/sessionStore";

export async function GET() {
  const sessions = getSessions();
  return NextResponse.json(sessions);
}