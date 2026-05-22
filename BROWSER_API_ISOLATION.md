# PHASE 4: BROWSER API ISOLATION
**Date:** May 21, 2026  
**Status:** In Progress  
**Build Status:** ✅ Clean (all routes generate)

---

## Browser API Audit Results

### Current State: APIs Scattered Across Components

| API | Location | Usage | Isolation Status |
|-----|----------|-------|------------------|
| `navigator.clipboard` | Dashboard, Lobby | Copy room code | ❌ Not isolated |
| `navigator.serviceWorker` | ServiceWorkerRegistration | Register SW | ✅ Already isolated |
| `window.setInterval` | uiStore, participantStore | Timers | ❌ Embedded in stores |
| `window.setTimeout` | uiStore, pulseStore | Delayed actions | ❌ Embedded in stores |
| `document.getElementById` | LandingPage | Scroll to element | ❌ Not isolated |
| `document.addEventListener` | MeetingControls, ProfileMenu | Click outside detection | ❌ Not isolated |
| `document.removeEventListener` | MeetingControls, ProfileMenu | Cleanup | ❌ Not isolated |
| `WebrtcProvider` | CollaborativeEditor | Collaborative editing | ⚠️ Part of Yjs/Tiptap |
| `MediaStream` | useBrowserMedia, VideoGrid | Video/audio streams | ✅ Already isolated |
| `navigator.mediaDevices` | useBrowserMedia | Media enumeration | ✅ Already isolated |

---

## Critical Isolation Issues

### Issue 1: Clipboard API Not Isolated

**Files:**
- `components/Dashboard.tsx` line 109
- `components/Lobby.tsx` line 49

**Current Pattern (BAD):**
```typescript
// In Dashboard.tsx
const copyCode = (code: string) => {
  navigator.clipboard?.writeText(code).catch(() => {});
};
```

**Problem:**
- Direct `navigator` call in component
- No error handling
- No feedback to user
- Cannot test without browser

**Recommended Fix:** Create dedicated hook
```typescript
// hooks/useClipboard.ts
export function useClipboard() {
  const [copied, setCopied] = useState(false);
  
  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }, []);
  
  return { copy, copied };
}
```

---

### Issue 2: Window Timers Embedded in Stores

**Files:**
- `components/meeting/state/uiStore.tsx` lines 29, 43
- `components/meeting/state/participantStore.tsx` line 25
- `components/meeting/state/pulseStore.tsx` line 31

**Current Pattern (BAD):**
```typescript
// In uiStore.tsx
export function MeetingUiProvider({ children }: { children: ReactNode }) {
  const [meetingDuration, setMeetingDuration] = useState(0);
  
  useEffect(() => {
    const timer = window.setInterval(() => {
      setMeetingDuration(current => current + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);
  
  // ...
}
```

**Problems:**
- Timer logic tightly coupled to store
- Difficult to mock for testing
- Hard to adjust timer duration
- Cannot pause/resume without store change

**Recommended Fix:** Extract to custom hook
```typescript
// hooks/useTimer.ts
export function useTimer(duration = 1000) {
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  
  useEffect(() => {
    if (!isRunning) return;
    
    const timer = window.setInterval(() => {
      setElapsed(current => current + 1);
    }, duration);
    
    return () => window.clearInterval(timer);
  }, [isRunning, duration]);
  
  return { elapsed, setElapsed, isRunning, setIsRunning };
}
```

---

### Issue 3: Document Event Listeners Not Isolated

**Files:**
- `components/MeetingControls.tsx` lines 71-72
- `components/ProfileMenu.tsx` lines 30-31

**Current Pattern (BAD):**
```typescript
// In MeetingControls.tsx
useEffect(() => {
  const handler = (e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
    }
  };
  document.addEventListener('mousedown', handler);
  return () => document.removeEventListener('mousedown', handler);
}, []);
```

**Problems:**
- Event binding scattered across components
- Difficult to trace all listeners
- Potential memory leaks if cleanup missed
- Cannot test without DOM

**Recommended Fix:** Extract to custom hook
```typescript
// hooks/useClickOutside.ts
export function useClickOutside(ref: RefObject<HTMLElement>, callback: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        callback();
      }
    };
    
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, callback]);
}
```

---

### Issue 4: DOM Scroll Not Isolated

**File:** `components/LandingPage.tsx` line 127

**Current Pattern (BAD):**
```typescript
onClick={() => { 
  const el = document.getElementById('features'); 
  el?.scrollIntoView({ behavior: 'smooth' }); 
}}
```

**Problem:**
- Direct DOM manipulation in onClick
- Depends on specific element ID
- Cannot reuse
- Tight coupling to DOM structure

**Recommended Fix:** Extract to custom hook
```typescript
// hooks/useScrollToId.ts
export function useScrollToId() {
  return useCallback((id: string) => {
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: 'smooth' });
  }, []);
}
```

---

### Issue 5: WebRTC Provider Not Isolated

**File:** `components/CollaborativeEditor.tsx` lines 12, 29

**Current Pattern (Partially Isolated):**
```typescript
import { WebrtcProvider } from 'y-webrtc';

export function CollaborativeEditor({ roomId }: { roomId: string }) {
  const ydoc = new Y.Doc();
  const prov = new WebrtcProvider(`conferly-notes-${roomId}`, ydoc, {
    // config
  });
  
  // ...
}
```

**Problem:**
- WebRTC provider initialized directly in component
- Config hardcoded
- No error boundaries for connection failures
- Tight coupling to Yjs

**Recommended Fix:** Extract to custom hook
```typescript
// hooks/useCollaborativeDoc.ts
export function useCollaborativeDoc(roomId: string) {
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebrtcProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    try {
      const ydoc = new Y.Doc();
      const prov = new WebrtcProvider(
        `conferly-notes-${roomId}`,
        ydoc,
        { maxConns: 50, filterBcConns: false }
      );
      
      setDoc(ydoc);
      setProvider(prov);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
    
    return () => {
      doc?.destroy();
      provider?.destroy();
    };
  }, [roomId]);
  
  return { doc, provider, error };
}
```

---

## Browser API Isolation Roadmap

### Priority 1: High-Impact APIs (Used in Critical Paths)

| API | Impact | Effort | Status |
|-----|--------|--------|--------|
| `navigator.clipboard` | Low (UX nice-to-have) | 30 min | ⏳ Pending |
| `document event listeners` | Medium (core UI) | 1 hour | ⏳ Pending |
| `window timers` | High (state critical) | 1 hour | ⏳ Pending |

### Priority 2: Medium-Impact APIs

| API | Impact | Effort | Status |
|-----|--------|--------|--------|
| `document.getElementById` | Low (landing page) | 15 min | ⏳ Pending |
| `WebrtcProvider` | Medium (collab feature) | 1.5 hours | ⏳ Pending |

### Priority 3: Already Isolated

| API | Location |
|-----|----------|
| `navigator.serviceWorker` | ServiceWorkerRegistration.tsx |
| `navigator.mediaDevices` | useBrowserMedia.ts |
| `MediaStream` | useBrowserMedia.ts |

---

## Hook Creation Plan

### 1. useClipboard Hook

```typescript
// hooks/useClipboard.ts
import { useCallback, useState } from 'react';

export function useClipboard() {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const copy = useCallback(async (text: string) => {
    if (!navigator?.clipboard) {
      setError('Clipboard API not available');
      return false;
    }
    
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      const timeout = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timeout);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to copy';
      setError(msg);
      return false;
    }
  }, []);
  
  return { copy, copied, error };
}
```

### 2. useTimer Hook

```typescript
// hooks/useTimer.ts
import { useEffect, useState } from 'react';

export function useTimer(interval = 1000, autoStart = true) {
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(autoStart);
  
  useEffect(() => {
    if (!isRunning) return;
    
    const timer = window.setInterval(() => {
      setElapsed(current => current + 1);
    }, interval);
    
    return () => window.clearInterval(timer);
  }, [isRunning, interval]);
  
  const pause = () => setIsRunning(false);
  const resume = () => setIsRunning(true);
  const reset = () => { setElapsed(0); setIsRunning(false); };
  
  return { elapsed, isRunning, pause, resume, reset, setElapsed };
}
```

### 3. useClickOutside Hook

```typescript
// hooks/useClickOutside.ts
import { useEffect, RefObject } from 'react';

export function useClickOutside(
  ref: RefObject<HTMLElement>,
  callback: () => void
) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        callback();
      }
    };
    
    if (typeof document !== 'undefined') {
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [ref, callback]);
}
```

### 4. useScrollToId Hook

```typescript
// hooks/useScrollToId.ts
import { useCallback } from 'react';

export function useScrollToId() {
  return useCallback((id: string) => {
    if (typeof document !== 'undefined') {
      const element = document.getElementById(id);
      element?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);
}
```

### 5. useCollaborativeDoc Hook

```typescript
// hooks/useCollaborativeDoc.ts
import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';

export function useCollaborativeDoc(roomId: string) {
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebrtcProvider | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const ydoc = new Y.Doc();
      const prov = new WebrtcProvider(
        `conferly-notes-${roomId}`,
        ydoc,
        { maxConns: 50, filterBcConns: false }
      );
      
      prov.on('connection-change', (connected) => {
        setIsConnected(connected);
      });
      
      setDoc(ydoc);
      setProvider(prov);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to initialize collaborative doc';
      setError(msg);
    }
    
    return () => {
      doc?.destroy();
      provider?.destroy();
    };
  }, [roomId]);
  
  return { doc, provider, isConnected, error };
}
```

---

## Expected Outcomes

After PHASE 4 isolation:

✅ All browser APIs encapsulated in focused hooks  
✅ Components don't directly reference browser globals  
✅ Easy to mock for testing  
✅ Single source of truth for each API  
✅ Better error handling  
✅ Improved SSR safety (guards against undefined globals)  

---

## Summary

**APIs Identified:** 8 major browser API categories  
**Components Affected:** 8 components  
**Hooks to Create:** 5 new custom hooks  
**Estimated Work:** 3-4 hours  
**Risk Level:** Low (encapsulation, no breaking changes)  

**Next Phase:** PHASE 5 (Dynamic Import Validation)

---

*Isolation Status: Ready for implementation*
