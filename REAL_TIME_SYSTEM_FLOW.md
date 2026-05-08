# Conferly Real-Time System Flow + Video Stack Architecture
## Complete Technical Breakdown

**Date:** 2025-05-07  
**Method:** Code analysis + architecture reverse-engineering  
**Technology Stack:** LiveKit, WebRTC, Yjs, React

---

# 1. MEETING LIFECYCLE (END-TO-END FLOW)

## 1.1 Meeting Creation Process

```
User Action → Create Meeting
     ↓
Room ID Generated (UUID)
     ↓
LiveKit Room Created (server-side)
     ↓
Meeting Link Generated (conferly.site/{roomId})
     ↓
Link Shareable to Participants
```

## 1.2 User Entry Into Meeting

```
1. User visits conferly.site/{roomId}
2. Room component loads → Lobby screen shown
3. User enters display name
4. User clicks "Join Meeting"
5. useMediaDevices.startMedia() called:
   - Request camera/microphone access
   - Create MediaStream
   - Create AudioContext + Analyser
6. Connect to LiveKit room
7. Receive participant list
8. Video stream established
```

## 1.3 Participant Join Flow

```
Join Request
     ↓
Authentication Check (existing session)
     ↓
Join LiveKit Room
     ↓
Receive Existing Participants' Streams
     ↓
Own Stream Published to Room
     ↓
All participants see new user
```

---

# 2. WEBRTC & REAL-TIME COMMUNICATION STACK

## 2.1 Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|--------|
| **Client** | LiveKit Client SDK | Room connection & streaming |
| **SFU** | LiveKit Server | Media routing |
| **Transport** | WebRTC | Peer-to-peer media |
| **Signaling** | LiveKit WebSocket | Session coordination |

## 2.2 LiveKit Architecture

Conferly uses **LiveKit** as its real-time engine:

```
┌─────────────────────────────────────────────────────┐
│              LiveKit Cloud                     │
├─────────────────────────────────────────────────────┤
│  WebSocket                              │
│  - Room management                    │
│  - Participant tracking             │
│  - Signaling                     │
├─────────────────────────────────────────────────────┤
│  SFU (Selective Forwarding Unit)    │
│  - Routes media between peers    │
│  - Handles N-way connections    │
│  - Transcoding if needed         │
└─────────────────────────────────────────────────────┘
           ↕
┌─────────────────────────────────────────────────────┐
│  Client Browser                              │
│  - LiveKit Room                          │
│  - WebRTC PeerConnection                │
│  - Local MediaStream                   │
└─────────────────────────────────────────────────────┘
```

## 2.3 WebRTC Connection Flow

```
1. Create Room Connection
   room = new Room()
   await room.connect(url, token)

2. Publish Local Stream
   await room.localParticipant.publishTrack(track)

3. Subscribe to Remote Tracks
   room.on('trackSubscribed', (track) => {
     attachTrack(track, element);
   })
```

## 2.4 Media Pipeline

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Camera     │────▶│  Browser   │────▶│  LiveKit   │
│  (Media    │     │  Encoding  │     │  SFU       │
│  Capture)  │     │  (VP8/VP9)│     │            │
└──────────────┘     └──────────────┘     └──────────────┘
                                               ↕
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Remote     │◀────│  Browser   │◀────│  SFU        │
│  Video     │     │  Decoding  │     │  (Forward)  │
│  Render    │     │            │     │            │
└──────────────┘     └──────────────┘     └──────────────┘
```

---

# 3. MEDIA STREAMING ARCHITECTURE

## 3.1 Adaptive Quality System

Conferly implements **adaptive bitrate** based on network conditions:

```typescript
// useMediaDevices.ts
const conn = navigator.connection;
const downlink = conn?.downlink || 10; // Mbps

// Adaptive video constraints
const videoConstraints = 
  downlink < 5   ? { width: 640, height: 360, frameRate: 15 }   // Low bandwidth
  : downlink < 15  ? { width: 960, height: 540, frameRate: 24 }   // Medium
  : { width: 1280, height: 720, frameRate: 30 };           // High
```

| Network | Resolution | Frame Rate | Use Case |
|---------|-----------|----------|--------|
| <5 Mbps | 360p | 15fps | Mobile/poor Africa |
| 5-15 Mbps | 540p | 24fps | Standard WiFi |
| >15 Mbps | 720p | 30fps | Fiber/5G |

## 3.2 Audio Processing

```typescript
// Audio constraints
audio: {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
}
```

| Feature | Purpose |
|---------|---------|
| **Echo Cancellation** | Remove speaker output from mic input |
| **Noise Suppression** | Filter background noise |
| **Auto Gain** | Maintain consistent volume level |

## 3.3 Media Controls

| Action | Implementation |
|--------|---------------|
| **Mute** | `track.enabled = false` |
| **Unmute** | `track.enabled = true` |
| **Video Off** | `track.enabled = false` |
| **Video On** | `track.enabled = true` |
| **Screen Share** | `getDisplayMedia()` replaces video track |

---

# 4. MULTILINGUAL TRANSLATION PIPELINE

## 4.1 Translation Trigger

Translation is **automatic** when enabled in meeting settings.

## 4.2 Real-Time Translation Flow

```
Audio Stream (Source Language)
        ↓
Speech-to-Text (Interim Results)
        ↓
Language Detection
        ↓
Translation Engine (Source → Target)
        ↓
Text-to-Speech (Optional)
        ↓
Display Overlay / Audio Output
```

## 4.3 Supported Languages

All 11 South African official languages:
- isiZulu, isiXhosa, Afrikaans, Sesotho, Setswana
- Xitsonga, siSwati, Tshivenda, isiNdebele, Sepedi, English

## 4.4 Sync Mechanism

```typescript
// From useTranslation hook
Live Translation → Zero local processing
Remote AI translation service handles:
- Language detection
- Translation
- Synthesis (if audio output)
```

## 4.5 Latency Impact

| Component | Estimated Latency |
|-----------|----------------|
| Audio capture | 10ms |
| Speech-to-text | 100-300ms |
| Translation | 50-150ms |
| Display | 10ms |
| **Total** | **170-510ms** |

---

# 5. AI FEATURES IN LIVE MEETINGS

## 5.1 Transcription

```typescript
// Real-time speech-to-text
transcript: TranscriptEntry[]
interimText: string  // Streaming results

// Use case:
- Live transcription displayed
- Meeting documentation
- Accessibility support
```

## 5.2 AI Meeting Pulse

```typescript
// Automatic meeting summary
pulseSummary: string[]
isPulseLoading: boolean

// Generate:
- TF-IDF analysis on transcript
- 3-point summary extraction
```

## 5.3 Feature Integration

| Feature | Pipeline | Storage |
|---------|---------|--------|
| **Transcription** | Real-time | Live display |
| **AI Pulse** | Post-meeting | Generated on demand |
| **Recording** | Live capture | Blob download |

---

# 6. SYSTEM ARCHITECTURE OVERVIEW

## 6.1 Layered Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  FRONTEND LAYER                         │
├─────────────────────────────────────────────────────────────┤
│  React Components:                                       │
│  - MeetingRoom, VideoGrid, Lobby, Sidebar                 │
│  - ChatView, Participants, Controls                   │
│  state → roomId, participants, streams                │
├─────────────────────────────────────────────────────────────┤
│                REAL-TIME LAYER                          │
├─────────────────────────────────────────────────────────────┤
│  LiveKit Client:                                        │
│  - Room Connection: room.connect(url, token)           │
│  - Track Publishing: publishTrack(track)                │
│  - Track Subscriptions: on('trackSubscribed')            │
│                                                      │
│  WebRTC:                                             │
│  - RTCPeerConnection                             │
│  - STUN/TURN ICE candidates                     │
│  - MediaStream management                          │
├─────────────────────────────────────────────────────────────┤
│                 MEDIA LAYER                         │
├─────────────────────────────────────────────────────────────┤
│  Media Capture:                                         │
│  - navigator.mediaDevices.getUserMedia()          │
│  - getDisplayMedia() (screen share)                 │
│                                                      │
│  Audio/Video Processing:                              │
│  - AudioContext + AnalyserNode                  │
│  - Audio levels, echo cancellation             │
│                                                      │
│  LiveKit SFU:                                        │
│  - Media routing to participants              │
│  - Adaptive bitrate                        │
│  - Recording (if enabled)                │
├─────────────────────────────────────────────────────────────┤
│                  AI LAYER                         │
├─────────────────────────────────────────────────────────────┤
│  Translation Engine:                               │
│  - Real-time text translation                     │
│  - Language detection                         │
│                                                      │
│  Transcription:                                  │
│  - Speech-to-text (streaming)                │
│                                                      │
│  AI Pulse:                                        │
│  - TF-IDF summarization                      │
│  - Topic extraction                          │
├─────────────────────────────────────────────────────────────┤
│                BACKEND LAYER                         │
├─────────────────────────────────────────────────────────────┤
│  Room Management:                                    │
│  - Room creation/destruction                 │
│  - Participant tracking                      │
│  - Token generation                        │
│                                                      │
│  Persistence:                                         │
│  - Recording storage                           │
│  - Meeting history                        │
│  - User profiles                          │
└─────────────────────────────────────────────────────────────┘
```

## 6.2 Data Flow During Meeting

```
User Input → React State → LiveKit Room → SFU → Other Participants
                ↓
         Local MediaStream
                ↓
         MediaTrack Published
                ↓
         All Participants Receive
```

---

# 7. FAILURE MODES & RESILIENCE DESIGN

## 7.1 Network Loss

| Scenario | Behavior |
|----------|----------|
| **Internet drops** | Meeting pauses, reconnection attempted |
| **Reconnection** | Auto-reconnect with same room |
| **Timeout** | Meeting ends after threshold |

## 7.2 Media Failures

| Scenario | Behavior |
|----------|----------|
| **Camera fails** | Video disabled, user notified |
| **Mic fails** | Muted automatically |
| **Permission denied** | Error displayed, can retry |

## 7.3 Audio/Video Desync

| Scenario | Behavior |
|----------|----------|
| **Audio lag** | Buffer adjustment |
| **Video freeze** | Frame drop, quality reduction |

## 7.4 Multiple Join

```typescript
// Room handles concurrent joins:
// 1. Join request received
// 2. Participant added to room
// 3. Existing participants notified
// 4. New participant receives all streams
```

## 7.5 Africa-First Constraints

| Constraint | Solution |
|------------|----------|
| **Low bandwidth** | Adaptive resolution (360p default) |
| **Unstable network** | Automatic reconnection |
| **High latency** | Low-latency STUN servers |

---

# 8. USER EXPERIENCE DURING LIVE CALLS

## 8.1 Join Experience

1. Click meeting link
2. Enter name in lobby
3. Click "Join Meeting"
4. 1-3 second connection
5. See other participants

## 8.2 During Meeting

| Action | UX Feedback |
|--------|-----------|
| **Mute/Unmute** | Icon toggle, no delay |
| **Video On/Off** | Icon toggle, immediate |
| **Screen Share** | Preview → shared |
| **Chat** | Real-time message |
| **Raise Hand** | Visual indicator |
| **Language Switch** | Settings → apply immediately |

## 8.3 Post-Meeting

- Recording available (if enabled)
- Pulse summary generated
- Chat history saved
- Return to lobby

---

# 9. KEY TECHNICAL INSIGHTS

## 9.1 Sub-100ms Latency Claim

The "<100ms latency" is achieved through:

1. **Direct browser-to-SFU routing** (not mesh for large calls)
2. **Adaptive quality** reduces processing time
3. **Local area network optimization** for SA users
4. **Efficient codec** (VP8/VP9)

## 9.2 African Network Optimization

Conferly optimizes for Africa through:

1. **Adaptive bitrate** - starts low, increases as available
2. **SFU architecture** - reduces upload bandwidth
3. **Browser-only** - no downloads to fail
4. **TURN servers** - relay for NAT/firewall

## 9.3 No Mesh for Large Calls

| Participants | Architecture |
|--------------|-------------|
| 2-4 | P2P possible via LiveKit |
| 5+ | SFU mandatory |

SFU is required for N-way because:
- Each participant would need N-1 uploads
- Exponential bandwidth growth

## 9.4 Recording Flow

```typescript
// When recording enabled:
- LiveKit tracks all participants
- WebM/MKV encoded server-side
- User clicks download
- Blob returned to browser
```

---

*Document Version: 1.0.0*  
*Technology: LiveKit, WebRTC, Yjs, React*  
*Method: Code analysis + architecture reverse-engineering*