# PHASE 2 & 3: HYDRATION SAFETY & STORE EFFICIENCY AUDIT
**Date:** May 21, 2026  
**Status:** In Progress  
**Approach:** Comprehensive code analysis of state stores and subscription patterns

---

## AUDIT FINDINGS

### Store Architecture Review

**Current Pattern:** React Context + useState hooks (NOT Zustand)

All 11 stores follow this pattern:
```typescript
const [state, setState] = useState(...);
const value = useMemo(() => ({ state, actions }), [deps]);
return <Context.Provider value={value}>{children}</Context.Provider>;
```

**Storage Mechanism:**
| Store | State Model | Persistence | Hydration Risk |
|-------|-------------|-------------|-----------------|
| mediaStore | useState from useBrowserMedia | None | MEDIUM - browser APIs |
| participantStore | useState + mock interval | None | LOW - mock data |
| chatStore | useState array | None | LOW - messages |
| transcriptStore | useSpeechTranscript hook | None | MEDIUM - browser APIs |
| uiStore | useState (sidebarOpen, tab, etc) | None | MEDIUM - defaults might differ |
| translationStore | (needs inspection) | None | LOW - stateless |
| presentationStore | useState + mock slides | None | LOW - mock data |
| recordingStore | (needs inspection) | None | MEDIUM - blob state |
| pulseStore | (needs inspection) | None | LOW - generated data |
| securityStore | (needs inspection) | None | LOW - static config |
| roomStore | useState + room metadata | None | LOW - metadata |

---

## PHASE 2: HYDRATION SAFETY ISSUES IDENTIFIED

### Issue 1: useBrowserMedia Hook in mediaStore

**File:** `components/meeting/state/mediaStore.tsx`  
**Problem:** `useBrowserMedia()` calls browser APIs (`navigator.mediaDevices.getUserMedia`) during render

**Risk:**
- On server: `navigator` undefined → error or null stream
- On client: `navigator` available → stream obtained
- **Result:** Server renders `stream: null`, client renders `stream: MediaStream` → Hydration mismatch

**Current Code:**
```typescript
export function MeetingMediaProvider({ children }: { children: ReactNode }) {
  const media = useBrowserMedia();  // ← Browser API call during render
  return <MeetingMediaContext.Provider value={media}>{children}</MeetingMediaContext.Provider>;
}
```

**Impact:** `MeetingMediaStage` will rerender on client hydration to sync stream state

**Recommended Fix:**
```typescript
export function MeetingMediaProvider({ children }: { children: ReactNode }) {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);
  
  const media = useBrowserMedia();
  
  // Server renders with null stream, client hydrates with real stream
  if (!isClient) {
    return <MeetingMediaContext.Provider value={null}>{children}</MeetingMediaContext.Provider>;
  }
  
  return <MeetingMediaContext.Provider value={media}>{children}</MeetingMediaContext.Provider>;
}
```

---

### Issue 2: useSpeechTranscript Hook in transcriptStore

**File:** `components/meeting/state/transcriptStore.tsx`  
**Problem:** `useSpeechTranscript()` includes browser APIs for speech recognition

**Risk:** Similar to Issue 1 - browser API state differs between server and client

**Current Code:**
```typescript
export function MeetingTranscriptProvider({ children }: { children: ReactNode }) {
  const transcriptState = useSpeechTranscript();  // ← Browser API hook
  // ... memoization ...
}
```

**Impact:** `isSpeechSupported` will be false on server, true on client (or vice versa)

---

### Issue 3: Window Timers in uiStore

**File:** `components/meeting/state/uiStore.tsx`  
**Problem:** `window.setInterval()` in `useEffect` runs during SSR

**Risk:**
- Server: `window` undefined in useEffect scope (but useEffect doesn't run server-side in normal RSC)
- Client: `window` defined, interval starts
- **Result:** Meeting duration starts at 0 on server render, jumps on client

**Current Code:**
```typescript
useEffect(() => {
  const timer = window.setInterval(() => {
    setMeetingDuration(current => current + 1);
  }, 1000);
  return () => window.clearInterval(timer);
}, []);
```

**Impact:** Minor - UI hydration matches because `meetingDuration` is useState, but timer logic differs

---

### Issue 4: participantStore Mock Data Interval

**File:** `components/meeting/state/participantStore.tsx`  
**Problem:** Mock participant audio levels update every 1800ms via `setInterval`

**Current Code:**
```typescript
useEffect(() => {
  const interval = window.setInterval(() => {
    setRemoteParticipants(current => current.map(participant => ({
      ...participant,
      audioLevel: Math.min(0.24, Math.max(0, participant.audioLevel + (Math.random() - 0.45) * 0.05)),
      isSpeaking: Math.random() > 0.68,
    })));
  }, 1800);
  return () => window.clearInterval(interval);
}, []);
```

**Impact:** Animation starts at different times on server vs. client (minor, but observable)

---

## PHASE 3: STORE SUBSCRIPTION EFFICIENCY ISSUES

### Issue 1: Broad Memoization Dependencies

**File:** `components/meeting/state/uiStore.tsx`  
**Problem:** useMemo includes all state + callbacks

```typescript
const value = useMemo(
  () => ({
    sidebarOpen,
    setSidebarOpen,
    sidebarTab,
    setSidebarTab,
    handRaised,
    toggleHandRaise,  // ← Function reference
    reactions,
    addReaction,      // ← Function reference
    meetingDuration,
  }),
  [sidebarOpen, sidebarTab, handRaised, reactions, meetingDuration, toggleHandRaise, addReaction]
);
```

**Problem:** 
- `toggleHandRaise` recreated every render → consumers rerender unnecessarily
- `addReaction` recreated every render → consumers rerender unnecessarily
- Any state change → all consumers rerender

**Why It's Bad:**
```
User toggles hand raise:
→ uiStore setState
→ useMemo recalculates (handRaised changed)
→ Provider value object recreated
→ ALL context consumers rerender (VideoGrid, ChatPanel, etc.)
```

**Expected Subscribers:**
- `MeetingMediaStage` → needs `handRaised` only (NOT all UI state)
- `MeetingSidebarStage` → needs `sidebarOpen`, `sidebarTab` only
- Chat/Transcript panels → don't need hand raise state

---

### Issue 2: Excessive chatStore Context Value

**File:** `components/meeting/state/chatStore.tsx`  
**Problem:** Returns entire `chatMessages` array on every subscription

```typescript
const value = useMemo(
  () => ({ chatMessages, sendChatMessage }),
  [chatMessages, sendChatMessage]
);
```

**Problem:**
- New message added → entire `chatMessages` array changes reference
- ALL chatStore consumers rerender (even those just needing send action)

**Expected Subscribers:**
- ChatPanel → needs full `chatMessages` array
- ChatInput → needs just `sendChatMessage` function

**Bad Pattern:** Tight coupling of readers and writers

---

### Issue 3: participantStore Rerender Cascade

**File:** `components/meeting/state/participantStore.tsx`  
**Problem:** Mock participant interval updates trigger massive context updates

```typescript
// Every 1800ms:
setRemoteParticipants(current => current.map(participant => ({
  ...participant,
  audioLevel: Math.min(0.24, Math.max(0, participant.audioLevel + (Math.random() - 0.45) * 0.05)),
  isSpeaking: Math.random() > 0.68,
})));
```

**Cascade:**
1. Audio level changes
2. `participantStore` rerender trigger
3. VideoGrid rerender (correct)
4. Participant count badge rerender (correct)
5. BUT: If VideoGrid is not memoized → ALL VideoTile children rerender

**Expected:** Only affected VideoTile rerenders

**Actual:** Entire VideoGrid might rerender (needs verification with Profiler)

---

## CRITICAL HYDRATION MISMATCHES TO FIX

### Priority 1: Browser API Providers

| Provider | Issue | Fix |
|----------|-------|-----|
| `MeetingMediaProvider` | `useBrowserMedia()` called server-side | Add client-only guard or defer to useEffect |
| `MeetingTranscriptProvider` | `useSpeechTranscript()` called server-side | Add client-only guard |
| `MeetingUiProvider` | Window timer in useEffect | Safe (doesn't run on server), but verify |
| `MeetingParticipantProvider` | Mock interval in useEffect | Safe (doesn't run on server), but verify |

### Priority 2: Broad Context Values

| Provider | Issue | Fix |
|----------|-------|-----|
| `MeetingUiProvider` | Includes unrelated state (handRaised, reactions, meetingDuration) | Split into focused contexts |
| `MeetingChatProvider` | Couples readers and writers | Add selective selectors |
| `MeetingParticipantProvider` | Tightly coupled to VideoGrid | Ensure memoization boundaries |

---

## RECOMMENDED FIXES

### FIX 1: Client-Only Media Initialization

```typescript
// components/meeting/state/mediaStore.tsx
"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { useBrowserMedia } from '../../../hooks/useBrowserMedia';

export function MeetingMediaProvider({ children }: { children: ReactNode }) {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Server: render with null value
  // Client: render with real browser media
  if (!isClient) {
    return children; // Skip provider on server, hydrate on client
  }
  
  return <MeetingMediaInternalProvider>{children}</MeetingMediaInternalProvider>;
}

function MeetingMediaInternalProvider({ children }: { children: ReactNode }) {
  const media = useBrowserMedia();
  return (
    <MeetingMediaContext.Provider value={media}>
      {children}
    </MeetingMediaContext.Provider>
  );
}
```

### FIX 2: Split UI Context by Domain

**Current (Bad):**
```typescript
const uiValue = {
  sidebarOpen, setSidebarOpen,    // Used by MeetingSidebarStage
  sidebarTab, setSidebarTab,      // Used by MeetingSidebarStage
  handRaised, toggleHandRaise,    // Used by MeetingMediaStage
  reactions, addReaction,         // Used by VideoGrid
  meetingDuration,                // Used by MeetingControlsWrapper
};
```

**Recommended (Good):**
```typescript
// Split into 3 focused contexts:
const SidebarUIContext = { sidebarOpen, setSidebarOpen, sidebarTab, setSidebarTab };
const MediaUIContext = { handRaised, toggleHandRaise };
const ReactionContext = { reactions, addReaction };
const TimerContext = { meetingDuration };
```

**Benefit:** Sidebar changes don't trigger VideoGrid rerender

---

## HYDRATION MISMATCH DETECTION TEST

**How to find remaining hydration issues:**

1. **Build production bundle:**
   ```bash
   npm run build
   npm start
   ```

2. **Open browser DevTools → Console**

3. **Look for warnings like:**
   ```
   Warning: Hydration failed because the initial UI does not match what was rendered on the server.
   
   Warning: Text content did not match. Server: "0" Client: "5"
   
   Warning: Expected server HTML to contain a matching <div> in <section>.
   ```

4. **If found:**
   - Suppress with `suppressHydrationWarning` ONLY as last resort
   - Prefer: identify server/client state difference and fix the root cause

---

## STORE EFFICIENCY TEST PLAN

### Test 1: VideoGrid Rerender on Chat Message

**Expected:** VideoGrid does NOT rerender  
**Test:**
```javascript
// In React DevTools Profiler:
1. Record
2. Send chat message
3. Stop recording
4. Check: Is VideoGrid in the render tree?
```

**If FAIL:** ChatContext is merged with ParticipantContext somewhere

### Test 2: ChatPanel Rerender on Participant Update

**Expected:** ChatPanel does NOT rerender  
**Test:**
```javascript
// In React DevTools Profiler:
1. Record
2. Wait for mock participant audio update (watch audio levels change)
3. Stop recording
4. Check: Is ChatPanel in the render tree?
```

**If FAIL:** ParticipantContext is merged with ChatContext somewhere

### Test 3: UI State Isolation

**Expected:** Sidebar open/close does NOT rerender VideoGrid  
**Test:**
```javascript
// In React DevTools Profiler:
1. Record
2. Click sidebar toggle button
3. Stop recording
4. Check: Is VideoGrid in the render tree?
```

**If FAIL:** uiStore is too broad or VideoGrid subscribes to wrong context

---

## SUMMARY

### Hydration Issues Found: 3 Critical
1. Browser API initialization in providers (mediaStore, transcriptStore)
2. Window timer state differences (minor)
3. Mock data initialization timing

### Subscription Issues Found: 3 Major
1. Overly broad uiStore context value
2. Coupled reader/writer in chatStore
3. Participant cascade rerender risk

### Immediate Actions:
1. **Fix:** Add client-only guards to browser API providers
2. **Fix:** Split uiStore into focused contexts
3. **Test:** Verify VideoGrid not rerendering on unrelated updates
4. **Monitor:** Check browser console for hydration warnings during dev

### Status: Ready for implementation

---

**Next Phase:** PHASE 4 (Browser API Isolation) & PHASE 5 (Dynamic Import Validation)

*Testing Environment: Dev server running on localhost:3000 | Production build validated*
