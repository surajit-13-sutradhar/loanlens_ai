import { Outfit } from "next/font/google";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

const outfit = Outfit({ subsets: ["latin"] });

export default async function Home() {
  const { userId } = await auth();

  return (
    <div
      className={`min-h-screen bg-[#050505] text-white overflow-hidden relative selection:bg-teal-500/30 ${outfit.className}`}
    >
      {/* --- Abstract Background Elements (Soft Orbs & Fluid Gradients) --- */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {/* Optical Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,#000_70%,transparent_100%)]" />

        {/* Glowing Orbs */}
        <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-teal-500/20 rounded-full blur-[120px] mix-blend-screen animate-pulse duration-1000" />
        <div className="absolute top-[20%] right-[-10%] w-[30vw] h-[30vw] bg-blue-600/20 rounded-full blur-[100px] mix-blend-screen" />
        <div className="absolute bottom-[-20%] left-[20%] w-[50vw] h-[50vw] bg-emerald-500/10 rounded-full blur-[150px] mix-blend-screen" />
      </div>

      {/* --- Navigation --- */}
      <nav className="relative z-50 w-full flex items-center justify-between px-6 md:px-12 py-6 border-b border-white/5 bg-black/10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          {/* Logo Lens Graphic */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-blue-500 p-0.5 shadow-[0_0_20px_rgba(45,212,191,0.4)]">
            <div className="w-full h-full bg-black/50 rounded-full backdrop-blur-sm flex items-center justify-center border border-white/20">
              <div className="w-3 h-3 bg-white rounded-full shadow-[0_0_10px_#fff]" />
            </div>
          </div>
          <span className="text-xl font-semibold tracking-tight text-white/90">
            LoanLens AI
          </span>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="text-sm font-medium text-white/50 hover:text-white transition-colors"
          >
            Admin Portal
          </Link>
          
          <div className="h-4 w-px bg-white/10 mx-2" />
          
          {userId ? (
            <Link
              href="/dashboard"
              className="px-5 py-2 text-sm font-medium text-black bg-white hover:bg-white/90 rounded-full transition-all duration-300 shadow-[0_0_15px_rgba(255,255,255,0.2)]"
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="px-4 py-2 text-sm font-medium text-white/70 hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className="px-5 py-2 text-sm font-medium text-white bg-white/10 hover:bg-white/20 border border-white/10 rounded-full transition-all duration-300"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </nav>

      <main className="relative z-10 flex flex-col items-center">
        
        {/* --- Hero Section: Futuristic Awe --- */}
        <section className="w-full max-w-6xl px-6 pt-32 pb-24 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5)]">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <span className="text-xs font-medium tracking-widest text-teal-200 uppercase">
              Video-Based Digital Loan Origination
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-light tracking-tight mb-8 leading-[1.1]">
            Financial clarity, <br />
            <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-teal-300 via-blue-200 to-emerald-300">
              rendered instantly.
            </span>
          </h1>

          <p className="max-w-2xl text-lg md:text-xl text-white/50 font-light leading-relaxed mb-12">
            No paper forms. No manual KYC. No branch visits. Experience the world's most frictionless loan approval through a secure, real-time video session powered by conversational AI.
          </p>

          <Link
            href="/sign-up"
            className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-white/10 hover:bg-white/15 border border-white/20 rounded-2xl backdrop-blur-xl transition-all duration-500 overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_32px_rgba(45,212,191,0.2)]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-teal-500/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <span className="relative text-white font-medium">Start the Future of Lending</span>
            <svg className="relative w-5 h-5 text-white/70 group-hover:text-white group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </section>

        {/* --- Features Section: Comforting Relief --- */}
        <section className="w-full max-w-6xl px-6 py-24">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Card 1 */}
            <div className="p-8 rounded-3xl bg-white/[0.03] border border-white/5 backdrop-blur-2xl transition-all duration-500 hover:bg-white/[0.05] hover:border-white/10 group">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                <svg className="w-6 h-6 text-teal-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                </svg>
              </div>
              <h3 className="text-xl font-medium text-white/90 mb-3">Live Identity Lens</h3>
              <p className="text-sm text-white/40 leading-relaxed font-light">
                Simply look into your camera. We capture your face, voice, and precise location in real-time, treating your biometric identity with the utmost security and compliance.
              </p>
            </div>

            {/* Card 2 */}
            <div className="p-8 rounded-3xl bg-white/[0.03] border border-white/5 backdrop-blur-2xl transition-all duration-500 hover:bg-white/[0.05] hover:border-white/10 group">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                <svg className="w-6 h-6 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-xl font-medium text-white/90 mb-3">Conversational Data Capture</h3>
              <p className="text-sm text-white/40 leading-relaxed font-light">
                Speak naturally with our AI. Powered by Deepgram Nova-3, we transcribe your speech to text instantly, extracting employment and obligation details through organic dialogue.
              </p>
            </div>

            {/* Card 3 */}
            <div className="p-8 rounded-3xl bg-white/[0.03] border border-white/5 backdrop-blur-2xl transition-all duration-500 hover:bg-white/[0.05] hover:border-white/10 group">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                <svg className="w-6 h-6 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-medium text-white/90 mb-3">Crystal Underwriting</h3>
              <p className="text-sm text-white/40 leading-relaxed font-light">
                Our intelligence layer assesses risk and generates a personalized loan offer. Instantaneous FOIR calculations appear like light through frosted glass, granting you total control.
              </p>
            </div>

          </div>
        </section>

        {/* --- CTA Section: Profound Empowerment --- */}
        <section className="w-full max-w-5xl px-6 pb-32">
          <div className="relative w-full rounded-[2.5rem] p-10 md:p-16 overflow-hidden border border-white/10 shadow-2xl shadow-black/50 text-center">
            
            {/* CTA Glass Background Layer */}
            <div className="absolute inset-0 bg-white/5 backdrop-blur-3xl z-0" />
            
            {/* Internal CTA Glow */}
            <div className="absolute inset-0 z-0 flex items-center justify-center opacity-50 pointer-events-none">
              <div className="w-full h-full bg-gradient-to-r from-teal-500/20 to-blue-600/20 blur-[80px]" />
            </div>

            <div className="relative z-10 flex flex-col items-center">
              <h2 className="text-3xl md:text-5xl font-light text-white mb-6">
                Ready to clear the path?
              </h2>
              <p className="text-white/50 text-base md:text-lg mb-10 max-w-xl font-light">
                Empower your customers with an onboarding experience defined by refined craftsmanship, zero-knowledge privacy protocols, and frictionless luxury.
              </p>
              
              <Link
                href="/admin"
                className="bg-white text-black px-10 py-4 rounded-2xl font-medium hover:bg-white/90 hover:scale-105 active:scale-95 transition-all duration-300 shadow-[0_0_30px_rgba(255,255,255,0.2)]"
              >
                Access Admin Portal
              </Link>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}