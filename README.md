# LoanLens AI
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

LoanLens AI is an MVP for a video-based loan origination system. The core idea is to replace traditional form-based loan applications with a live video session that:

- Captures the customer's face, voice, and location in real time
- Transcribes speech to text for consent and data capture
- Records the session as a video blob for audit and compliance
- Uses AI to assess risk and generate a personalised loan offer

This repository now covers the **admin panel, session management, email delivery, authentication, media permissions, and video capture layer**.

---

## Tech Stack

| Layer | Technology | Purpose | Cost |
|---|---|---|---|
| Frontend | Next.js 15 (App Router) | UI + API routes | Free |
| Styling | Tailwind CSS + ShadCN | Component library | Free |
| Auth | Clerk | User sessions, sign-in/sign-up | Free tier |
| Email | Nodemailer + Gmail | Session link delivery | Free |
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
│   │   ├── layout.tsx                    # Root layout with ClerkProvider
│   │   ├── page.tsx                      # Landing page (public)
│   │   ├── globals.css
│   │   ├── favicon.ico
│   │   ├── admin/
│   │   │   └── page.tsx                  # Admin panel — create sessions, view all sessions
│   │   ├── api/
│   │   │   └── sessions/
│   │   │       ├── route.ts              # GET /api/sessions — returns all sessions
│   │   │       └── create/
│   │   │           └── route.ts          # POST /api/sessions/create — creates session + sends email
│   │   ├── dashboard/
│   │   │   └── page.tsx                  # Video verification shell (protected)
│   │   ├── join/
│   │   │   └── [token]/
│   │   │       └── page.tsx              # Token validation + redirect to sign-in or dashboard
│   │   ├── sign-in/
│   │   │   └── [[...sign-in]]/
│   │   │       └── page.tsx              # Clerk sign-in page
│   │   └── sign-up/
│   │       └── [[...sign-up]]/
│   │           └── page.tsx              # Clerk sign-up page
│   ├── components/
│   │   ├── ui/                           # ShadCN auto-generated components
│   │   └── VideoSession.tsx              # Core video capture component
│   ├── hooks/
│   │   └── useMediaPermissions.ts        # Camera, mic, location access hook
│   ├── lib/
│   │   ├── sessionStore.ts               # In-memory session store (CRUD helpers)
│   │   └── utils.ts                      # Shared utilities
│   └── middleware.ts                     # Clerk route protection
├── .env.local                            # API keys (never commit this)
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

# App URL (used for generating onboarding links)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Gmail (for sending session links via Nodemailer)
GMAIL_USER=your@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx

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

---

### 2. Session Store — `sessionStore.ts`

**File:** `src/lib/sessionStore.ts`

A lightweight in-memory store that holds all loan sessions for the duration of the server process. Provides the following helpers:

| Function | Description |
|---|---|
| `createSession(session)` | Adds a new session to the store |
| `getSession(id)` | Retrieves a single session by ID |
| `getSessions()` | Returns all sessions |
| `updateSessionStatus(id, status)` | Updates a session's status |

Sessions follow this shape:

```typescript
interface Session {
  id: string;         // UUID
  name: string;
  phone: string;
  email: string;
  status: "pending" | "opened" | "submitted";
  createdAt: string;  // ISO string
}
```

> **Note:** This is intentionally in-memory for the MVP. Sessions are lost on server restart. Supabase Postgres replaces this in the next phase.

---

### 3. API Routes — Sessions

**Files:** `src/app/api/sessions/route.ts`, `src/app/api/sessions/create/route.ts`

#### `GET /api/sessions`
Returns the full list of all sessions as JSON. Used by the admin panel to populate the sessions table.

#### `POST /api/sessions/create`
Accepts `{ name, phone, email }` in the request body. Does the following in order:
1. Generates a UUID as the session token
2. Constructs a unique onboarding link: `${NEXT_PUBLIC_APP_URL}/join/${id}`
3. Persists the session to the in-memory store with status `"pending"`
4. Sends the link to the customer's email via Nodemailer + Gmail
5. Returns `{ message, link }` on success

Email is sent using a Gmail account configured with an App Password (same pattern as a standard Python/SMTP setup). The `mip_opt_out` principle applies — no customer data is used for any third-party model training.

---

### 4. Admin Panel

**File:** `src/app/admin/page.tsx`

A protected internal page for loan officers to manage onboarding sessions.

**Create Session section:**
- Input fields for customer name, phone number, and email address
- On submit, calls `POST /api/sessions/create`, which generates a UUID link and emails it to the customer
- The generated link is displayed inline with a one-click copy button
- Toast notifications confirm success or surface errors

**All Sessions table:**
- Fetches and displays all sessions via `GET /api/sessions`
- Columns: Name, Phone, Email, Status, Created At
- Status badges are colour-coded:
  - 🟡 `PENDING` — link sent, not yet opened
  - 🔵 `OPENED` — customer has clicked the link
  - 🟢 `SUBMITTED` — customer has completed the session
- Manual refresh button; auto-refreshes after each new session is created

---

### 5. Join Page — Token Validation

**File:** `src/app/join/[token]/page.tsx`

The landing page for customers who click their unique onboarding link.

- Validates the token against the session store
- If invalid or not found: renders a clear error screen ("Invalid or expired link")
- If valid and status is `"pending"`: updates status to `"opened"` immediately
- Checks Clerk auth state:
  - Already signed in → `redirect("/dashboard")`
  - Not signed in → `redirect("/sign-in?redirect_url=/dashboard")`

This is a **server component** — it runs `auth()` server-side and performs all redirects before anything renders in the browser.

---

### 6. Dashboard Shell

**File:** `src/app/dashboard/page.tsx`

The protected main application page for customers.

- Only accessible when signed in — middleware redirects to sign-in otherwise
- Top navigation bar with the LoanLens AI logo and Clerk `UserButton`
- Hosts the `VideoSession` component as the primary interaction surface

---

### 7. Media Permissions Hook — `useMediaPermissions`

**File:** `src/hooks/useMediaPermissions.ts`

A custom React hook that acts as the single source of truth for all hardware access.

**What it manages:**

| Resource | Browser API Used | What it returns |
|---|---|---|
| Camera | `navigator.mediaDevices.getUserMedia` | `videoStream`, `cameraStatus` |
| Microphone | `navigator.mediaDevices.getUserMedia` | `audioStream`, `micStatus` |
| Combined | `getUserMedia` with both constraints | `stream` (used for recording) |
| Location | `navigator.geolocation.getCurrentPosition` | `location` (lat, lng, accuracy) |

**Key design decisions:**

- Camera and microphone are requested together in a single browser prompt via `requestAll()` — better UX than two separate popups
- The combined stream is split into separate video and audio streams so the STT layer (Deepgram) can consume just the audio track independently
- Streams are stored in both refs (for `stopAll()` reliability) and state (for React re-renders)
- Location is requested separately since it triggers a different browser permission prompt
- Full cleanup on component unmount — all tracks are stopped, camera light turns off
- `sampleRate: 16000` is set on the audio constraint because Deepgram's Nova-3 model performs best at 16kHz

---

### 8. Video Session Component

**File:** `src/components/VideoSession.tsx`

The primary UI component that the customer interacts with. Consumes `useMediaPermissions` and orchestrates the full session lifecycle.

**Session states:** `idle → active → stopped`

- Displays real-time permission status badges (Camera, Microphone, Location)
- Renders a live `<video>` element fed by the camera stream
- On session start, initialises a `MediaRecorder` chunking the combined stream into `video/webm` blobs every second
- Displays a live recording timer (MM:SS)
- On session end, assembles all chunks into a single Blob and generates a temporary `blob://` download URL
- Shows captured GPS coordinates (lat, lng, accuracy) once location is granted

> **Note:** The `blob://` download link is for testing only. It lives in RAM and is lost on refresh. Supabase storage replaces this in the next phase.

---

## How It Works — Full Flow

```
1. Loan officer visits /admin
         ↓
2. Enters customer name, phone, email → clicks "Generate & Send Link"
         ↓
3. API creates a UUID session, stores it (status: "pending"), emails the link
         ↓
4. Customer receives email, clicks their unique /join/[token] link
         ↓
5. Server validates token, marks session "opened", checks Clerk auth
         ↓
   Not signed in → /sign-in → after auth → /dashboard
   Already signed in → /dashboard directly
         ↓
6. Customer clicks "Start Session"
         ↓
7. Browser prompts: Allow camera + microphone? → Allow
         ↓
8. Browser prompts: Allow location? → Allow
         ↓
9. Live video feed appears, recording timer starts
   MediaRecorder begins collecting blob chunks every 1s
   GPS coordinates displayed
         ↓
10. Customer clicks "End Session"
         ↓
11. MediaRecorder stops, all tracks stopped
    Blob assembled from chunks
    Download link appears (temporary, for testing)
```

---

## Team Split

| Person | Ownership | Files |
|---|---|---|
| **P1 — Frontend** | UI shell, admin panel, video layer, media capture | `admin/page.tsx`, `dashboard/page.tsx`, `VideoSession.tsx`, `useMediaPermissions.ts` |
| **P2 — STT** | Deepgram WebSocket, real-time transcript UI | `hooks/useTranscription.ts` *(coming)*, `components/TranscriptPanel.tsx` *(coming)* |
| **P3 — Data** | Supabase schema, migrate session store, blob upload | `app/api/` *(expand)*, Supabase migrations *(coming)* |

Integration points:
- P1 produces the `stream` and `audioStream` objects
- P2 consumes `audioStream` for Deepgram
- P3 consumes the final video `Blob` and transcript for storage, and takes over from `sessionStore.ts`

---

## Roadmap

### Done ✅
- [x] Next.js + Tailwind + ShadCN scaffold
- [x] Clerk authentication (sign up, sign in, sign out, route protection)
- [x] In-memory session store (`sessionStore.ts`)
- [x] `GET /api/sessions` — list all sessions
- [x] `POST /api/sessions/create` — create session + send email via Nodemailer/Gmail
- [x] Admin panel — create sessions, view all sessions with status badges
- [x] Join page — token validation, status update to `"opened"`, Clerk auth redirect
- [x] Dashboard shell
- [x] Camera access
- [x] Microphone access
- [x] Location access
- [x] Video recording with MediaRecorder (in-memory blob)
- [x] Session lifecycle (idle → active → stopped)
- [x] Permission status UI

### Next — Session 3
- [ ] Deepgram real-time STT via WebSocket
- [ ] Live transcript panel alongside video
- [ ] Supabase project setup
- [ ] Migrate `sessionStore.ts` → Supabase Postgres
- [ ] Video blob upload to Supabase Storage
- [ ] Session metadata saved to Supabase Postgres
- [ ] Transcript saved to database
- [ ] Location saved to database
- [ ] Session status updated to `"submitted"` on completion

### Future
- [ ] LLM intelligence layer (Claude API) for customer classification
- [ ] Risk scoring engine
- [ ] Loan offer generation
- [ ] Vercel deployment

---

## Important Notes

- **Never commit `.env.local`** — it contains secret keys. It is already in `.gitignore` by default with Next.js.
- **Gmail App Password** — use a Google App Password, not your account password. Generate one at myaccount.google.com → Security → App Passwords.
- **`sessionStore.ts` is ephemeral** — all sessions are lost when the dev server restarts. This is intentional for the MVP.
- **Deepgram `mip_opt_out=true`** must be passed in all API calls. This is a financial data application — audio must not be used for Deepgram's model training.
- The `blob://` download URL in the current MVP is for **testing only**. Real storage via Supabase comes in the next session.