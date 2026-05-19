# Conferly — Complete Product Description

**Version 1.0 — End-to-End Feature Specification**

---

## Product Overview

Conferly is a premium, browser-based conferencing and collaboration platform built to help people connect with purpose. It combines real-time video, live transcription, South African language translation, collaborative editing, AI meeting intelligence, presentation tools, and enterprise security into a single installable web application.

Conferly is rooted in the African philosophy of Ubuntu while meeting modern global expectations for professionalism, privacy, and reliability.

---

## Core Experience

### Public user journey
1. Visitor lands on the welcome page
2. Visitor explores features, business plans, and product value
3. Visitor signs up or signs in

### Authenticated user journey
1. User completes onboarding (individual or organization)
2. User lands on the dashboard
3. User can create a meeting, join a meeting, reconnect to an active session, review meeting history, or manage plans
4. User enters the lobby to test camera and microphone
5. User joins the meeting room

---

## Key Capabilities

### Conferencing
- HD video and audio
- adaptive media quality based on bandwidth
- screen sharing
- mobile-friendly controls
- installable PWA

### Collaboration
- real-time shared notes using TipTap + Yjs
- in-meeting chat
- reactions and hand raise
- slide creation and presentation mode
- annotations and laser pointer

### Intelligence
- live transcription via Web Speech API
- real-time translation for 11 South African official languages
- AI Meeting Pulse using in-browser TF-IDF summarization
- topic extraction

### Security
- meeting passwords
- waiting room
- meeting lock
- end-to-end encrypted communication indicators
- organization-aware onboarding and account structure

### Billing and Commercial
- trial-first onboarding
- Pro, Business, and Enterprise plans
- Peach Payments integration
- payment history persistence
- plan-aware feature gating

---

## Major Features

### 1. Authentication & Profiles
- Supabase Auth as the primary identity layer
- persistent sessions with browser restore
- onboarding-aware profiles
- profile metadata includes:
  - display name
  - avatar URL
  - user type (`individual` / `organization`)
  - organization name
  - organization size
  - organization industry
  - onboarding completion state

### 2. Dashboard
- quick actions: new meeting, join meeting
- recent meetings from persisted history
- reconnect prompt for active meetings
- plan badge and upgrade prompts
- tools visibility based on subscription tier

### 3. Lobby
- live camera preview
- microphone level test
- room code display and copy
- device readiness check before entering a meeting

### 4. Meeting Room
- adaptive video grid
- duration warnings and expiry prompts
- transcript panel
- translation panel
- security panel
- slides/presentation panel
- collaborative editor panel

### 5. Translation
Supported languages include:
- isiZulu
- isiXhosa
- Afrikaans
- Sesotho
- Setswana
- Xitsonga
- siSwati
- Tshivenḓa
- isiNdebele
- Sepedi
- English

Translation runs through a remote API integration while preserving a lightweight frontend experience.

### 6. Presentation Engine
- slide deck editor
- title/content/split/image/code/blank slide layouts
- fullscreen presentation mode
- keyboard navigation
- drawing mode
- laser pointer
- speaker notes
- local screen-share recursion prevention for presenters

### 7. Recording
- MediaRecorder-based local capture
- recordings saved to device storage (IndexedDB + download)
- no heavy backend storage burden

---

## Persistence Model

### Supabase (source of truth)
- profiles
- meetings
- payments
- transcripts
- notes
- chat history

### Browser persistence (resilience layer)
- localStorage for lightweight session/cache state
- IndexedDB for recordings, meeting caches, transcripts, chat, notes backups

### Active session persistence
Conferly stores active meeting session information so that users can reconnect after refresh or browser reopen.

---

## Technical Stack

- React 19
- TypeScript
- Vite-based frontend build pipeline
- Tailwind CSS v4
- Supabase Auth + Postgres
- Yjs + y-webrtc
- WebRTC / browser-native media APIs
- MediaRecorder
- Web Speech API
- Peach Payments
- n8n automation hooks

---

## Use Cases

- corporate meetings and internal collaboration
- webinars and executive briefings
- virtual classrooms and workshops
- multilingual community dialogues
- hybrid conferences and presentations

---

## Product Positioning

Conferly is not just a meeting tool. It is a trusted environment for meaningful digital interaction.

It is built for:
- individual professionals
- teams and organizations
- education providers
- community groups
- enterprises needing premium, secure, and inclusive communication

---

## Brand Promise

**Conferly — Connecting with Purpose.**
