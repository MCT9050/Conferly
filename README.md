# Conferly

**Connecting with Purpose.**

Conferly is a premium conferencing and collaboration platform rooted in the African philosophy of Ubuntu — *"I am because we are."* It offers a seamless digital space where people can connect with purpose, share ideas, and build meaningful relationships.

🌍 **Live at:** [www.conferly.site](https://www.conferly.site)

[![MIT License](https://img.shields.io/badge/License-MIT-amber.svg)](LICENSE)
[![Built with Vite](https://img.shields.io/badge/Built%20with-Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-Connected-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)

---

## ✨ Why Conferly?

| Pillar | What It Means |
|---|---|
| 🛡️ **Secure & Reliable** | Enterprise-grade encryption, Supabase-backed infrastructure |
| 💎 **Premium Experience** | High-quality audio/video with minimal latency |
| 🌐 **Inclusive Design** | 11 South African languages, accessibility-first |
| 📈 **Scalable** | From intimate team meetings to 500-participant conferences |
| 🎨 **Brand Elevation** | Customizable branding for organizations |

---

## 🎯 Features

| Feature | Implementation |
|---|---|
| 📹 **HD Video & Audio** | WebRTC peer-to-peer with adaptive quality (360p/540p/720p) |
| 🎤 **Live Transcription** | Real-time speech-to-text via Web Speech API |
| 🌐 **11 SA Language Translation** | Live translation via MyMemory API (isiZulu, isiXhosa, Afrikaans, Sesotho, Setswana + 6 more) |
| 🧠 **AI Meeting Pulse** | TF-IDF extractive summarization, runs entirely in-browser |
| 📝 **Collaborative Notes** | TipTap + Yjs CRDT real-time sync |
| 📺 **Screen Sharing** | Native `getDisplayMedia` API |
| 🔴 **Recording** | On-device via MediaRecorder + IndexedDB storage |
| 💬 **Chat & Reactions** | In-meeting messaging, emoji reactions, hand raise |
| 🛡️ **Meeting Security** | Passwords, waiting room, meeting lock |
| 🎬 **Presentation Mode** | Built-in slide deck with annotations + laser pointer |
| 💳 **Payments** | Peach Payments (Card, EFT, Mobicred, SnapScan) |
| 📱 **PWA** | Installable on any device, works offline |

---

## 🏗️ Architecture

```
src/
├── App.tsx                          # Root router
├── store.ts                         # Central state (composes 9 hooks)
├── types.ts                         # TypeScript interfaces
│
├── lib/
│   ├── supabase.ts                  # Supabase client
│   ├── api.ts                       # Self-hosted backend API client
│   ├── persist.ts                   # IndexedDB persistence layer
│   └── peach.ts                     # Peach Payments integration
│
├── hooks/
│   ├── useAuth.ts                   # Supabase Auth + offline fallback
│   ├── useMediaDevices.ts           # getUserMedia + adaptive quality
│   ├── useSpeechRecognition.ts      # Web Speech API
│   ├── useRecording.ts              # MediaRecorder + IndexedDB
│   ├── useTranslation.ts            # 11 SA languages via MyMemory
│   ├── usePulse.ts                  # In-browser TF-IDF summarization
│   ├── usePlan.ts                   # Subscription tier management
│   ├── useMeetingSecurity.ts        | Password, lock, waiting room
│   ├── usePresentation.ts           | Slide deck + annotations
│   ├── usePayment.ts                | Peach Payments checkout
│   └── useInstallPrompt.ts          # PWA install prompt
│
└── components/
    ├── LandingPage.tsx              # Public marketing page
    ├── AuthPage.tsx                 # Sign in / Sign up
    ├── OnboardingPage.tsx           # Individual vs Organization choice
    ├── Dashboard.tsx                # Authenticated home
    ├── Lobby.tsx                    # Pre-meeting camera/mic test
    ├── MeetingRoom.tsx              # Main meeting UI
    ├── VideoGrid.tsx                # Adaptive video tiles
    ├── MeetingControls.tsx          # Bottom control bar
    ├── Sidebar.tsx                  # 8-tab in-meeting panel
    ├── PresentationView.tsx         # Fullscreen slide presentation
    ├── SlideEditor.tsx              # Slide creation panel
    ├── CollaborativeEditor.tsx      # TipTap + Yjs editor
    ├── SecurityPanel.tsx            # Meeting security controls
    ├── TranslationPanel.tsx         # SA language translation UI
    ├── PricingPage.tsx              # Plans + Peach Payments
    ├── ProfileMenu.tsx              # User dropdown
    ├── InstallBanner.tsx            # PWA install prompt UI
    └── Logo.tsx                     # Brand logo component
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 18
- npm or pnpm
- Chrome/Edge (recommended for full feature support)

### Install & Run

```bash
git clone https://github.com/YOUR_USERNAME/conferly.git
cd conferly
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Build for Production

```bash
npm run build
```

Output is a single `dist/index.html` (~1.3 MB) deployable to any static host.

---

## 🌍 Use Cases

- **Corporate meetings & webinars** — Video calls with recording and AI summaries
- **Educational workshops** — Live transcription + translation for inclusive classrooms
- **Community forums** — Multi-language conversations across 11 SA languages
- **Hybrid conferences** — In-person + virtual with built-in presentation mode

---

## 🔧 Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + Vite 7 + TypeScript 5.9 |
| Styling | Tailwind CSS v4 |
| Auth | Supabase Auth (JWT + refresh tokens) |
| Database | Supabase Postgres + Row Level Security |
| Editor | TipTap v3 + Yjs CRDT |
| Real-time sync | y-webrtc |
| Translation | MyMemory API |
| Payments | Peach Payments (Hosted Checkout) |
| Recording | MediaRecorder API + IndexedDB |
| Icons | Lucide React |

---

## 🌐 Browser Support

| Browser | Video | Translation | Transcription | Recording |
|---|---|---|---|---|
| Chrome / Edge | ✅ | ✅ | ✅ | ✅ |
| Firefox | ✅ | ✅ | ❌ (no Web Speech API) | ✅ |
| Safari | ✅ | ✅ | ❌ | ⚠️ Partial |

---

## 📄 License

MIT — use it however you want.

---

<p align="center"><strong>Conferly — Connecting with Purpose.</strong></p>
<p align="center">Made with ❤️ in South Africa</p>
