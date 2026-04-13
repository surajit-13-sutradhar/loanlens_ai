# LoanLens Ai
### Video-Based Digital Loan Origination System — MVP

A real-time, video-first loan onboarding system built for a hackathon. Customers complete their loan application through a live video session — no paper forms, no manual KYC, no branch visits.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [What's Been Built](#whats-been-built)
- [How It Works](#how-it-works)
- [Team Split](#team-split)
- [Roadmap](#roadmap)

---

## Project Overview

LoanLens Ai is an MVP for a video-based loan origination system. The core idea is to replace traditional form-based loan applications with a live video session that:

- Captures the customer's face, voice, and location in real time
- Transcribes speech to text for consent and data capture
- Records the session as a video blob for audit and compliance
- Uses AI to assess risk and generate a personalised loan offer

This repository covers the **frontend shell, authentication, media permissions, and video capture layer** — the foundation that the ML and data layers will plug into.

---

## Tech Stack

| Layer | Technology | Purpose | Cost |
|---|---|---|---|
| Frontend | Next.js 15 (App Router) | UI + API routes | Free |
| Styling | Tailwind CSS + ShadCN | Component library | Free |
| Auth | Clerk | User sessions, sign-in/sign-up | Free tier |
| Speech-to-Text | Deepgram Nova-3 | Real-time streaming STT | $200 free credit |
| Database | Supabase Postgres | Structured data storage | Free tier (500MB) |
| Blob Storage | Supabase Storage | Video/audio blob storage | Free tier (1GB) |
| Deployment | Vercel | Hosting + serverless functions | Free tier |

**Total cost to run the MVP: $0**

---

## Project Structure

```
loan-mvp/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout with ClerkProvider
│   │   ├── page.tsx                # Landing page (public)
│   │   ├── dashboard/
│   │   │   └── page.tsx            # Main app shell (protected)
│   │   ├── sign-in/
│   │   │   └── [[...sign-in]]/
│   │   │       └── page.tsx        # Clerk sign-in page
│   │   └── sign-up/
│   │       └── [[...sign-up]]/
│   │           └── page.tsx        # Clerk sign-up page
│   ├── components/
│   │   ├── ui/                     # ShadCN auto-generated components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── badge.tsx
│   │   │   └── ...
│   │   └── VideoSession.tsx        # Core video capture component
│   ├── hooks/
│   │   └── useMediaPermissions.ts  # Camera, mic, location access hook
│   └── middleware.ts               # Clerk route protection
├── .env.local                      # API keys (never commit this)
├── tailwind.config.ts
├── next.config.ts
└── package.json
```

---

## Environment Variables

Create a `.env.local` file in the project root. Never commit this file.

```env
# Clerk — https://clerk.com/dashboard
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxxxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL=/

# Deepgram — https://console.deepgram.com
DEEPGRAM_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

```

---

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm
- Git

### Installation

```powershell
# Clone the repo
git clone <your-repo-url>
cd loan-mvp

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## What's Been Built

### 1. Authentication — Clerk

**Files:** `src/middleware.ts`, `src/app/layout.tsx`, `src/app/sign-in/`, `src/app/sign-up/`

Full authentication flow using Clerk.

- Sign up and sign in with email
- Route protection via middleware — any route outside `/`, `/sign-in`, `/sign-up` requires authentication
- If an unauthenticated user hits `/dashboard`, they are automatically redirected to `/sign-in` with the original URL preserved as a redirect parameter
- `ClerkProvider` wraps the entire app in `layout.tsx` so session state is available everywhere
- `UserButton` in the nav handles sign out, profile, and session management

### 2. Dashboard Shell

**File:** `src/app/dashboard/page.tsx`

The protected main application page.

- Only accessible when signed in — middleware redirects to sign-in otherwise
- Top navigation bar with the LoanLens Ai logo and Clerk `UserButton`
- Hosts the `VideoSession` component as the primary interaction surface
- Client component (`"use client"`) to support browser APIs and interactivity

### 3. Media Permissions Hook — `useMediaPermissions`

**File:** `src/hooks/useMediaPermissions.ts`

A custom React hook that acts as the single source of truth for all hardware access. This is the most critical piece of the foundation — everything else (video recording, Deepgram STT, fraud detection) consumes from this hook.

**What it manages:**

| Resource | Browser API Used | What it returns |
|---|---|---|
| Camera | `navigator.mediaDevices.getUserMedia` | `videoStream`, `cameraStatus` |
| Microphone | `navigator.mediaDevices.getUserMedia` | `audioStream`, `micStatus` |
| Combined | `getUserMedia` with both constraints | `stream` (used for recording) |
| Location | `navigator.geolocation.getCurrentPosition` | `location` (lat, lng, accuracy) |

**Key design decisions:**

- Camera and microphone are requested **together** in a single browser prompt via `requestAll()` — better UX than two separate popups
- The combined stream is **split** into separate video and audio streams so the STT layer (Deepgram) can consume just the audio track independently
- Streams are stored in both **refs** (for `stopAll()` reliability) and **state** (for React re-renders)
- Location is requested separately since it triggers a different browser permission prompt
- Full cleanup on component unmount — all tracks are stopped, camera light turns off
- `sampleRate: 16000` is set on the audio constraint because Deepgram's Nova-3 model performs best at 16kHz

**Exported interface:**

```typescript
{
  // Permission statuses: "idle" | "requesting" | "granted" | "denied" | "error"
  cameraStatus, micStatus, locationStatus,

  // Live streams
  stream,       // combined — used for MediaRecorder
  videoStream,  // video only
  audioStream,  // audio only — will be fed to Deepgram

  // Location
  location,     // { latitude, longitude, accuracy, timestamp }

  // Error message if any permission was denied
  error,

  // Actions
  requestAll,      // requests everything at once (recommended)
  requestCamera,   // individual — for granular control
  requestMic,      // individual
  requestLocation, // individual
  stopAll,         // stops all tracks and resets state
}
```

### 4. Video Session Component

**File:** `src/components/VideoSession.tsx`

The primary UI component that the customer interacts with. Consumes `useMediaPermissions` and orchestrates the full session lifecycle.

**Session states:** `idle → active → stopped`

**What it does:**

- Displays real-time permission status badges (Camera, Microphone, Location) with colour coding — gray for idle, yellow for requesting, green for granted, red for denied
- Renders a live `<video>` element fed by the camera stream
- On session start, initialises a `MediaRecorder` that chunks the combined stream into `video/webm` blobs every second
- Displays a live recording timer (MM:SS) while the session is active
- On session end, assembles all chunks into a single Blob and generates a temporary `blob://` download URL
- Shows captured GPS coordinates (lat, lng, accuracy) once location is granted
- Provides a **Download recording** link after the session ends — for testing only; will be replaced by Supabase upload

**How video is stored (current MVP state):**

```
Camera hardware
      ↓
MediaStream (live pipe of raw frames)
      ↓
MediaRecorder (encodes to video/webm)
      ↓
Blob chunks[] in memory (collected every 1 second)
      ↓
Single Blob assembled on session stop
      ↓
blob:// URL (temporary, lives in RAM, gone on refresh)
```

No database or network calls are made yet. The blob lives only in the browser tab's memory until Supabase storage is wired up.

---

## How It Works — User Flow

```
1. User visits /dashboard
         ↓
2. Middleware checks Clerk session
         ↓
   Not signed in → redirect to /sign-in
   Signed in → load dashboard
         ↓
3. User clicks "Start Session"
         ↓
4. Browser prompts: Allow camera + microphone? → Allow
         ↓
5. Browser prompts: Allow location? → Allow
         ↓
6. Live video feed appears, recording timer starts
   MediaRecorder begins collecting blob chunks every 1s
   GPS coordinates displayed
         ↓
7. User clicks "End Session"
         ↓
8. MediaRecorder stops, all tracks stopped
   Blob assembled from chunks
   Download link appears (temporary, for testing)
```

---

## Team Split

This codebase is structured so three people can work in parallel with minimal conflicts.

| Person | Ownership | Files |
|---|---|---|
| **P1 — Frontend** | UI shell, video layer, media capture | `dashboard/page.tsx`, `VideoSession.tsx`, `useMediaPermissions.ts` |
| **P2 — STT** | Deepgram WebSocket, real-time transcript UI | `hooks/useTranscription.ts` *(coming)*, `components/TranscriptPanel.tsx` *(coming)* |
| **P3 — Data** | Supabase schema, API routes, blob upload | `app/api/` *(coming)*, Supabase migrations *(coming)* |

The integration point between all three is clean:
- P1 produces the `stream` and `audioStream` objects
- P2 consumes `audioStream` for Deepgram
- P3 consumes the final video `Blob` and transcript for storage

---

## Roadmap

### Done 
- [x] Next.js + Tailwind + ShadCN scaffold
- [x] Clerk authentication (sign up, sign in, sign out, route protection)
- [x] Dashboard shell
- [x] Camera access
- [x] Microphone access
- [x] Location access
- [x] Video recording with MediaRecorder (in-memory blob)
- [x] Session lifecycle (idle → active → stopped)
- [x] Permission status UI

### Next — Session 2 
- [ ] Deepgram real-time STT via WebSocket
- [ ] Live transcript panel alongside video
- [ ] Supabase project setup
- [ ] Video blob upload to Supabase Storage
- [ ] Session metadata saved to Supabase Postgres
- [ ] Transcript saved to database
- [ ] Location saved to database

### Future
- [ ] LLM intelligence layer (Claude API) for customer classification
- [ ] Risk scoring engine
- [ ] Loan offer generation
- [ ] Admin dashboard for reviewing sessions
- [ ] Vercel deployment

---

## Important Notes

- **Never commit `.env.local`** — it contains secret keys. It is already in `.gitignore` by default with Next.js.
- **Deepgram `mip_opt_out=true`** must be passed in all API calls. This is a financial data application — audio must not be used for Deepgram's model training.
- The `blob://` download URL in the current MVP is for **testing only**. It is not persistent. Real storage via Supabase comes in the next session.
- The dashboard is currently a `"use client"` component, so server-side `auth()` is not used. Route protection is handled entirely by the Clerk middleware, which is sufficient for the MVP.