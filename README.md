# LoanLens AI
### Video-First Digital Loan Origination System — MVP

A real-time, automated video onboarding system engineered for rapid financial compliance. LoanLens AI eliminates paperwork, manual KYC, and branch visits by transforming the traditional loan application into a live, interactive, and AI-audited video interview.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [Project Structure](#project-structure)
- [Advanced Video Verification Microservice](#advanced-video-verification-microservice)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Core Application Flows](#core-application-flows)
- [Team Split](#team-split)
- [Roadmap](#roadmap)

---

## Project Overview

LoanLens AI replaces static online forms with an intelligent, live video session. The system monitors compliance, identity, and risk profiles simultaneously:

- **AI Face & Liveness Engine:** Tracks identity, detects deepfakes/spoofs, screens for multi-face fraud, and runs age-range validation.
- **Ultra-Low Latency Transcription:** Streams candidate speech directly to text to securely record legal consent.
- **Automated Text-to-Speech:** Uses the browser’s native voice engine to conduct an interactive interview without human staff overhead.
- **Admin Audit Control:** Aggregates real-time machine learning telemetry directly into a secure session-details dashboard for loan officers.

---

## Tech Stack

| Layer | Technology | Purpose | Cost |
|---|---|---|---|
| **Frontend** | Next.js 15 (App Router) | Core application UI + API orchestration | Free |
| **Styling** | Tailwind CSS + ShadCN UI | Component ecosystem & notifications | Free |
| **Auth** | Clerk | Secure user sessions & route protection | Free Tier |
| **Email Service** | Nodemailer + Gmail SMTP | Magic link generation and onboarding delivery | Free |
| **Speech-to-Text** | Groq Cloud (`whisper-large-v3`) | Sub-second, ultra-accurate transcription | Free Tier |
| **Text-to-Speech** | Native Browser Web Speech API | Client-side text vocalization | Free |
| **Database** | Supabase Postgres | Relational data persistence & session history | Free Tier |
| **Blob Storage** | Supabase Storage | Compliance video and audio storage | Free Tier |
| **ML Engine** | Python FastAPI + OpenCV + DeepFace | Hosted on **Hugging Face Spaces** for edge biometrics | Free |

---

## System Architecture
```
[ Admin Dashboard ] ──> Generates Tokenized Magic Link via Nodemailer
│
▼
[ Join Route ]       ──> Validates Token & Syncs State via Supabase Postgres
│
▼
[ User Dashboard ]   ──> Starts Session & Activates Local Media Streams
│
┌─────────────────────┴─────────────────────────────────────┐
▼                                                           ▼
[ Client Web Browser ]                                   [ Machine Learning Edge ]
• Audio: Captured & sent to Groq                        • Frame Payloads: Pushed via base64
via Whisper Large V3.                                   to Hugging Face Space.
• Voice: In-built Web Speech API                        • Computer Vision: Runs Face Check, Liveness
interviews applicant dynamically.                        Multi-Face Alert, and Age Profiling.
│                                                           │
└─────────────────────┬─────────────────────────────────────┘
▼
[ Session Completion ] ──> Video Blobs + ML Logs saved into Supabase for Admin Review
```
---

## Project Structure
```
loan-mvp/
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout with ClerkProvider
│   │   ├── page.tsx                   # Public landing page
│   │   ├── globals.css
│   │   ├── favicon.ico
│   │   ├── admin/
│   │   │   └── page.tsx               # Admin Panel — manages users & audits ML telemetry
│   │   ├── api/
│   │   │   ├── agent/                 # Backend LLM orchestration layer
│   │   │   ├── sessions/
│   │   │   │   ├── route.ts           # GET /api/sessions — returns all records
│   │   │   │   ├── create/
│   │   │   │   │   └── route.ts       # POST — generates tokenized link + emails user
│   │   │   │   └── update/
│   │   │   │       └── route.ts       # POST — updates live session checkpoints
│   │   │   └── transcribe/
│   │   │       └── route.ts           # Intermediary payload router for Groq Whisper
│   │   ├── dashboard/
│   │   │   └── page.tsx               # Video verification shell (Protected)
│   │   ├── join/
│   │   │   └── [token]/
│   │   │       └── page.tsx           # Server-side token validation & entry router
│   │   ├── sign-in/
│   │   │   └── [[...sign-in]]/
│   │   │       └── page.tsx           # Clerk login gate
│   │   └── sign-up/
│   │   │   └── [[...sign-up]]/
│   │   │       └── page.tsx           # Clerk registration gate
│   ├── components/
│   │   ├── ui/                        # Auto-generated ShadCN component primitives
│   │   └── VideoSession.tsx           # Core video controller & client loop canvas
│   ├── hooks/
│   │   ├── useFaceMonitor.ts          # Frames dispatcher to remote Hugging Face Space
│   │   ├── useMediaPermissions.ts     # Unified camera, microphone, and geolocation hook
│   │   ├── useTranscription.ts        # Handles Groq Whisper Large V3 execution
│   │   └── useTTS.ts                  # Orchestrates browser Web Speech audio queries
│   ├── lib/
│   │   ├── supabase.ts                # Production client connection mapping
│   │   ├── underwriter.ts             # Risk indexing & grading architecture
│   │   └── utils.ts                   # Formatting utilities
│   └── middleware.ts                  # Edge global application route protection
├── .env.local                         # Local environment configuration keys
├── package.json
└── next.config.ts
```
---

## Advanced Video Verification Microservice

The application utilizes a custom python computer vision stack running as an isolated microservice on **Hugging Face Spaces** via FastAPI. It ingests base64 frame arrays and applies mathematical validation rules alongside neural nets:

### Key Inspection Parameters
1. **Face Count Validation:** Asserves presence (`face_count == 1`). Flags instances of multiple occupants (`Multi-Face Check`) or if an applicant ducks out of view (`Face Check`).
2. **Physical Texture Evaluation:** Uses a Laplacian variance computation algorithm to index high-frequency structural loss. Differentiates true 3D skin from flat 2D high-resolution print paper or monitors.
3. **Specular Reflection Filtering:** Processes image matrices into HSV channels to check if luminance pixel concentrations spike over `240`. Prevents glare spoofing and monitors environmental integrity.
4. **Blink & EAR Tracking:** Integrates `dlib` 68-facial landmark predictive maps to determine Eye Aspect Ratio ($EAR$) using Euclidean distances across eye feature groups.
5. **Age Estimation Models:** References VGG-Face based `DeepFace` classification arrays to output runtime age approximations, preventing application fraud by minors.

---

## Environment Variables
Create a .env.local file in the project root directory:
```
# Clerk Authentication Configuration
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxxxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL=/

# Application Routing Url
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Nodemailer SMTP Gmail Authentication Config
GMAIL_USER=your-profile@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx

# Groq Cloud AI Engine API Integration
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxx

# Supabase Production Database Infrastructure Config 
NEXT_PUBLIC_SUPABASE_URL=[https://xxxxxxxxxxxxxxxxxxxx.supabase.co](https://xxxxxxxxxxxxxxxxxxxx.supabase.co)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Remote AI Engine Space Target URL
NEXT_PUBLIC_HF_SPACE_URL=[https://your-space-name.hf.space/analyze](https://your-space-name.hf.space/analyze)
```
---
## Getting Started
# Installation
```
# Clone the repository
git clone <your-repo-url>
cd loan-mvp

# Clean install project package configurations
npm install

# Initialize development runtime environment
npm run dev
```

Open http://localhost:3000 to view your local app instance.

## Core Application flows
```
1. Loan Officer Admin panel ──> Spawns unique applicant parameters & registers token.
2. Magic link arrives via secure SMTP email delivery context.
3. Customer loads token path ──> Token state upgrades from "pending" to "opened".
4. Clerk verifies user context ──> Redirects user onto /dashboard safely.
5. Interview begins ──> Camera, Mic, and GPS location locks parameters on user.
6. Audio files process through Groq Whisper Large V3 ──> Converts text responses.
7. Local video components stream capture buffers into Hugging Face AI Spaces.
8. Space analyzes frames ──> Computes Texture, Specular Refraction, EAR Blinks, & Age.
9. Web Speech synthesizes vocal questions based on dynamic system state.
10. Complete ──> High-definition video object targets Supabase Object Storage buckets.
11. Admin view aggregates ML telemetry inside dashboard panels for validation metrics.
```
---
## Roadmap
- [x] Next.js Core System Scaffolding with Tailwind and ShadCN UI components

- [x] Secure Clerk Route Protection Middleware implementations

- [x] Tokenized session management pipeline with active state monitors

- [x] SMTP Nodemailer automated delivery channels

- [x] Dynamic hardware abstraction hooks (Camera, Audio, and Location matrix)

- [x] Hugging Face Space setup hosting custom FastAPI Computer Vision stack

- [x] Face, Liveness, and Multi-Face detection checks via OpenCV & dlib

- [x] Age-range prediction layers utilizing DeepFace network evaluation

- [x] Groq Cloud Whisper Large V3 transcription pipeline integration

- [x] Browser-native Text-to-Speech synthesis interview flow

- [x] Supabase Postgres data migration from ephemeral memory state

- [x] Supabase Object Storage video block upload routines

- [x] Post-Session Intelligent Classification Engine using LLM pipelines

- [x] Automated risk engine decision tree analytics