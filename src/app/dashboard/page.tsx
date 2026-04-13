"use client";

import { UserButton } from "@clerk/nextjs";
import VideoSession from "@/components/VideoSession";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/10">
        <span className="text-lg font-semibold tracking-tight">LoanLens AI</span>
        <UserButton />
      </nav>

      <div className="w-full px-8 py-10 space-y-8">
        <div className="px-1">
          <h1 className="text-3xl font-semibold">Video Verification</h1>
          <p className="text-white/40 text-sm mt-2">
            Complete your video verification to proceed.
          </p>
        </div>

        <VideoSession />
      </div>
    </main>
  );
}