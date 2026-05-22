# PHASE 1: FEATURE VALIDATION CHECKLIST
**Date:** May 21, 2026  
**Status:** In Progress  
**Dev Server:** Running on http://localhost:3000

---

## Overview

Feature validation tests the 10 isolated context stores to ensure:
1. ✅ Each store updates independently
2. ✅ Only relevant UI rerenders
3. ✅ Unrelated UI does NOT rerender
4. ✅ No rerender storms or cascades

**Tools Needed:**
- React DevTools (Chrome/Firefox extension)
- DevTools Profiler tab
- Network/Performance tabs

---

## Test Environment Setup

### 1. Enable React DevTools Highlighting

```
React DevTools Settings → Highlight updates when components render
```

This visually shows which components rerender during each test.

### 2. Enable React Profiler Recording

```
React DevTools → Profiler tab → Click "Start recording"
→ Perform action
→ Click "Stop recording"
→ Analyze commit graph
```

### 3. Open Browser Console

Watch for:
- Hydration warnings
- Console errors
- Rerender warnings

---

## Test Scenario Matrix

### SCENARIO 1: MEDIA CONTROLS

**Goal:** Camera/mic toggle should ONLY rerender `MeetingMediaStage`

| Component | Action | Expected Result | Rerender? | Notes |
|-----------|--------|-----------------|-----------|-------|
| MeetingMediaStage | Toggle camera | Video grid updates | ✅ YES | Primary consumer |
| VideoGrid | Toggle camera | Video tile updates | ✅ YES | Receives participants |
| MeetingSidebarStage | Toggle camera | NO CHANGE | ❌ NO | Should NOT rerender |
| ChatPanel | Toggle camera | NO CHANGE | ❌ NO | Unrelated |
| TranscriptPanel | Toggle camera | NO CHANGE | ❌ NO | Unrelated |
| PulsePanel | Toggle camera | NO CHANGE | ❌ NO | Unrelated |

**Test Steps:**

1. Navigate to `/meeting`
2. Open React DevTools → Profiler
3. Click **Start recording**
4. Find camera icon in media controls
5. Click **Toggle camera on/off**
6. Stop recording

**Acceptance Criteria:**
- ✅ Only `MeetingMediaStage` + `VideoGrid` appear in commit graph
- ✅ `MeetingSidebarStage` NOT in commit graph
- ✅ Sidebar panels NOT in commit graph
- ✅ No console errors

---

### SCENARIO 2: PARTICIPANT UPDATES

**Goal:** New participant joins/leaves → only `VideoGrid` rerenders

| Component | Action | Expected Result | Rerender? | Notes |
|-----------|--------|-----------------|-----------|-------|
| MeetingMediaStage | Participant joins | Participant count updates | ✅ YES | Receives participant list |
| VideoGrid | Participant joins | New tile added | ✅ YES | Primary video component |
| MeetingSidebarStage | Participant joins | Participant panel updates | ✅ YES | ParticipantPanel shows list |
| ChatPanel | Participant joins | NO CHANGE | ❌ NO | Unrelated |
| TranscriptPanel | Participant joins | NO CHANGE | ❌ NO | Unrelated |

**Test Steps:**

1. On `/meeting`, find the ParticipantsPanel in sidebar
2. Profiler → Start recording
3. Observe participant list in sidebar (shows "Anele", "Sipho" as mock participants)
4. Simulate: Open browser console and call:
   ```javascript
   // This simulates a participant join (if you have access to participant store)
   // Or observe the mock random interval that updates participant audio levels
   ```
5. Stop recording

**Acceptance Criteria:**
- ✅ Only `MeetingMediaStage` and `MeetingSidebarStage` rerender
- ✅ ChatPanel does NOT rerender
- ✅ No errors in console

---

### SCENARIO 3: CHAT MESSAGES

**Goal:** New chat message → ONLY ChatPanel rerenders

| Component | Action | Expected Result | Rerender? | Notes |
|-----------|--------|-----------------|-----------|-------|
| MeetingMediaStage | Send chat message | NO CHANGE | ❌ NO | Unrelated |
| VideoGrid | Send chat message | NO CHANGE | ❌ NO | Unrelated |
| MeetingSidebarStage | Send chat message | Message appears in chat | ✅ YES | Contains ChatPanel |
| ChatPanel | Send chat message | Message displays | ✅ YES | Primary consumer |
| TranscriptPanel | Send chat message | NO CHANGE | ❌ NO | Unrelated |

**Test Steps:**

1. On `/meeting`, navigate to Chat panel (click "Chat" in sidebar)
2. Profiler → Start recording
3. Type message in chat input
4. Click send / press Enter
5. Stop recording

**Acceptance Criteria:**
- ✅ Only `ChatPanel` rerenders in detail
- ✅ `VideoGrid` NOT in commit graph
- ✅ `TranscriptPanel` NOT in commit graph
- ✅ Message appears immediately

---

### SCENARIO 4: TRANSCRIPT UPDATES

**Goal:** Speech transcript → ONLY TranscriptPanel rerenders

| Component | Action | Expected Result | Rerender? | Notes |
|-----------|--------|-----------------|-----------|-------|
| MeetingMediaStage | Start transcription | Status indicator? | ❓ Maybe | If shows in header |
| ChatPanel | Start transcription | NO CHANGE | ❌ NO | Unrelated |
| TranscriptPanel | Start transcription | Panel becomes active | ✅ YES | Primary consumer |
| PulsePanel | Start transcription | NO CHANGE (initially) | ❌ NO | Waits for summary |

**Test Steps:**

1. On `/meeting`, click "Transcript" panel
2. Profiler → Start recording
3. Click "Start" button to begin transcription
4. Observe UI update (status changes to "Live Transcription Active")
5. Stop recording

**Acceptance Criteria:**
- ✅ Only `TranscriptPanel` rerenders significantly
- ✅ `ChatPanel` NOT in commit graph
- ✅ `VideoGrid` NOT in commit graph

---

### SCENARIO 5: RECORDING STATE

**Goal:** Start/stop recording → ONLY controls update

| Component | Action | Expected Result | Rerender? | Notes |
|-----------|--------|-----------------|-----------|-------|
| MeetingMediaStage | Start recording | NO CHANGE | ❌ NO | Recording state isolated |
| MeetingControlsWrapper | Start recording | Recording indicator appears | ✅ YES | Primary consumer |
| ChatPanel | Start recording | NO CHANGE | ❌ NO | Unrelated |
| VideoGrid | Start recording | NO CHANGE | ❌ NO | Unrelated |

**Test Steps:**

1. On `/meeting`, scroll down to Meeting Controls
2. Profiler → Start recording
3. Click **"Start Recording"** button (red "Record" button)
4. Observe recording indicator
5. Stop recording

**Acceptance Criteria:**
- ✅ Only `MeetingControlsWrapper` rerenders
- ✅ Media stage, video grid, sidebar do NOT rerender
- ✅ Recording state visible in UI

---

### SCENARIO 6: TRANSLATION TOGGLE

**Goal:** Change translation language → ONLY affected panels rerender

| Component | Action | Expected Result | Rerender? | Notes |
|-----------|--------|-----------------|-----------|-------|
| MeetingMediaStage | Change language | NO CHANGE | ❌ NO | Unrelated |
| ChatPanel | Change language | NO CHANGE (unless translating) | ❓ Maybe | If translation enabled |
| TranscriptPanel | Change language | Translated text updates | ✅ YES | Primary consumer |
| VideoGrid | Change language | NO CHANGE | ❌ NO | Unrelated |

**Test Steps:**

1. On `/meeting`, find Translation panel (if available)
2. Profiler → Start recording
3. Select different language from dropdown
4. Stop recording

**Acceptance Criteria:**
- ✅ Only translation-aware panels rerender
- ✅ Video grid unaffected
- ✅ Chat unaffected

---

### SCENARIO 7: PRESENTATION SLIDE CHANGES

**Goal:** Next/previous slide → ONLY presentation area rerenders

| Component | Action | Expected Result | Rerender? | Notes |
|-----------|--------|-----------------|-----------|-------|
| MeetingMediaStage | Change slide | NO CHANGE | ❌ NO | Unrelated |
| VideoGrid | Change slide | NO CHANGE | ❌ NO | Unrelated |
| MeetingSidebarStage | Change slide | Slide counter updates | ✅ YES | Shows slide info |
| ChatPanel | Change slide | NO CHANGE | ❌ NO | Unrelated |
| TranscriptPanel | Change slide | NO CHANGE | ❌ NO | Unrelated |

**Test Steps:**

1. On `/meeting`, look for presentation controls
2. Profiler → Start recording
3. Click "Next Slide" or "Previous Slide" button
4. Stop recording

**Acceptance Criteria:**
- ✅ Only presentation-related components rerender
- ✅ Video grid and chat unaffected
- ✅ Slide counter/title updates immediately

---

### SCENARIO 8: AI PULSE GENERATION

**Goal:** Generate AI summary → ONLY PulsePanel rerenders

| Component | Action | Expected Result | Rerender? | Notes |
|-----------|--------|-----------------|-----------|-------|
| MeetingMediaStage | Generate pulse | NO CHANGE | ❌ NO | Unrelated |
| ChatPanel | Generate pulse | NO CHANGE | ❌ NO | Unrelated |
| TranscriptPanel | Generate pulse | NO CHANGE | ❌ NO | Unrelated |
| PulsePanel | Generate pulse | Summary displays | ✅ YES | Primary consumer |
| MeetingSidebarStage | Generate pulse | Panel updates | ✅ YES | Contains PulsePanel |

**Test Steps:**

1. On `/meeting`, navigate to "Pulse" panel in sidebar
2. Ensure transcript has entries
3. Profiler → Start recording
4. Click **"Generate Meeting Pulse"** button
5. Watch for loading state → summary appears
6. Stop recording

**Acceptance Criteria:**
- ✅ Only `PulsePanel` + parent sidebar rerender during generation
- ✅ Media stage and video grid NOT affected
- ✅ Chat panel NOT affected
- ✅ Summary displays with topics and key points

---

## Rerender Storm Detection

**What to watch for (RED FLAGS):**

❌ **Bad Pattern 1: Cascade Rerender**
```
Start: Toggle camera
Expected: MeetingMediaStage rerenders
Actual: MeetingMediaStage → MeetingSidebarStage → ChatPanel → TranscriptPanel...
```
**Action:** If observed, context is too broad; investigate store dependencies.

❌ **Bad Pattern 2: Unnecessary Update Loop**
```
Single toggle camera
Profiler shows: [Commit 1] [Commit 2] [Commit 3] [Commit 4]...
```
**Action:** Check for useEffect loops; verify store logic doesn't create circular dependencies.

❌ **Bad Pattern 3: Unrelated Component Rerender**
```
Start: Send chat message
Profiler shows: ChatPanel + VideoGrid both rerender
```
**Action:** VideoGrid should NOT rerender on chat messages; check if stores are merged.

---

## Expected DevTools Profiler Output

### ✅ GOOD Example (Camera Toggle)

```
Profiler Commit Graph:

├─ MeetingRuntimeClient (no significant time)
│  └─ MeetingStateProvider (no significant time)
│     └─ MeetingMediaStage (RERENDERS - 2ms)
│        └─ VideoGrid (RERENDERS - 15ms)
│           └─ VideoTile (memoized, no rerender) x 2
└─ MeetingSidebarStage (no rerender)
└─ MeetingControlsWrapper (no rerender)
```

**Key markers:**
- Only `MeetingMediaStage` and `VideoGrid` in commit
- `MeetingSidebarStage` NOT listed
- Total time: ~17ms
- No loops

---

## Store Interaction Map

```
mediaStore
├─ Updates: camera, mic, screen sharing
├─ Consumers: MeetingMediaStage, VideoGrid, MeetingControlsWrapper
└─ Must NOT affect: ChatPanel, TranscriptPanel, PulsePanel

participantStore
├─ Updates: participant list, audio levels, speaking state
├─ Consumers: MeetingMediaStage (count), VideoGrid (tiles), ParticipantsPanel
└─ Must NOT affect: ChatPanel, TranscriptPanel

chatStore
├─ Updates: chat messages, input state
├─ Consumers: ChatPanel only
└─ Must NOT affect: VideoGrid, MeetingMediaStage, Transcript

transcriptStore
├─ Updates: transcript entries, interim text, listening state
├─ Consumers: TranscriptPanel, PulsePanel (for summary generation)
└─ Must NOT affect: ChatPanel, VideoGrid

pulseStore
├─ Updates: AI summary, topics, loading state
├─ Consumers: PulsePanel only
└─ Must NOT affect: ChatPanel, TranscriptPanel

translationStore
├─ Updates: language selection, translated messages
├─ Consumers: TranscriptPanel, ChatPanel (if translation enabled)
└─ Must NOT affect: VideoGrid, MeetingMediaStage

presentationStore
├─ Updates: current slide, presenter info, slide list
├─ Consumers: MeetingSidebarStage (presentation area)
└─ Must NOT affect: ChatPanel, VideoGrid

recordingStore
├─ Updates: recording state, status
├─ Consumers: MeetingControlsWrapper only
└─ Must NOT affect: ChatPanel, VideoGrid

securityStore
├─ Updates: encryption, permissions, privacy settings
├─ Consumers: SecurityPanel, MeetingControlsWrapper (indicators)
└─ Must NOT affect: ChatPanel, VideoGrid

roomStore
├─ Updates: room metadata, connection state, participant info
├─ Consumers: All stages (for connection status)
└─ Should NOT cause frequent rerenders (stable connection)

uiStore
├─ Updates: active panel, sidebar visibility, layout
├─ Consumers: MeetingSidebarStage, MeetingMediaStage (for layout)
└─ Must NOT affect: ChatPanel directly (only through panel visibility)
```

---

## Validation Checklist

### Media Controls Testing
- [ ] Toggle camera → only media stage rerenders
- [ ] Toggle microphone → only media stage rerenders
- [ ] Enable screen sharing → only media stage rerenders
- [ ] Disable screen sharing → only media stage rerenders
- [ ] Change audio device → only media controls rerender
- [ ] No video grid full rerender on device change

### Participant Testing
- [ ] New participant joins → video tile added (no chat rerender)
- [ ] Participant leaves → video tile removed (no chat rerender)
- [ ] Participant speaks → audio level updates (no chat rerender)
- [ ] Participant mutes → mute indicator updates (no chat rerender)
- [ ] Participant count updates in header

### Chat Testing
- [ ] Send message → chat panel only rerenders
- [ ] Receive message → chat panel only rerenders
- [ ] Clear chat → chat panel only rerenders
- [ ] No video grid rerender on new messages
- [ ] No participant panel rerender on new messages

### Transcript Testing
- [ ] Start transcription → transcript panel activates
- [ ] Speech detected → interim text appears (transcript only)
- [ ] Finalize speech → entry added (transcript only)
- [ ] Stop transcription → status updates
- [ ] No video grid rerender on transcript changes

### Recording Testing
- [ ] Start recording → only controls rerender
- [ ] Stop recording → only controls rerender
- [ ] Recording indicator visible in UI
- [ ] No media stage full rerender on recording toggle

### Translation Testing
- [ ] Change language → translation panel updates
- [ ] Translated text appears correctly
- [ ] No video grid rerender on language change
- [ ] No chat rerender if translation disabled

### Presentation Testing
- [ ] Next slide → presentation area updates
- [ ] Previous slide → presentation area updates
- [ ] Slide counter updates
- [ ] No video grid rerender on slide change
- [ ] Presenter info updates if applicable

### AI Pulse Testing
- [ ] Generate summary → pulse panel shows loading state
- [ ] Summary displays → topics and points visible
- [ ] Only pulse panel rerenders during generation
- [ ] Chat and transcript unaffected
- [ ] No infinite generation loops

### General Rerender Testing
- [ ] No rerender storms observed
- [ ] No console errors during testing
- [ ] No hydration warnings
- [ ] All features responsive
- [ ] UI updates in < 50ms

---

## Failure Analysis

If tests FAIL, follow this decision tree:

### If VideoGrid rerenders on chat message:
1. ❌ Check if `chatStore` is wrongly nested above `MeetingMediaStage`
2. ❌ Check if `participantStore` subscribes to `chatStore`
3. ✅ Verify stores are correctly separated in `MeetingStateContext`

### If ChatPanel doesn't appear on chat message:
1. ❌ Check if `chatStore` updates are happening
2. ❌ Check if ChatPanel is being rendered (might be lazy-loaded)
3. ✅ Verify `MeetingChatProvider` wraps sidebar

### If all components rerender together:
1. ❌ Check if stores are merged at top level
2. ❌ Check if MeetingStateProvider is too broad
3. ✅ Verify each store only wraps needed consumers

### If specific store values don't update:
1. ❌ Check store implementation for state update logic
2. ❌ Check if async operations complete
3. ✅ Verify hook is consuming correct store

---

## Success Definition

PHASE 1 passes when:

✅ All 8 test scenarios complete without rerender storms  
✅ No component rerenders unless directly affected  
✅ All features update correctly and visibly  
✅ No console errors or warnings  
✅ React DevTools Profiler shows clean commit graphs  
✅ Performance is snappy (< 50ms updates)  

---

**Next Step:** Begin testing scenarios 1-8 in order. Document findings in console as you proceed.

**Report Format for Findings:**
```
SCENARIO: [Name]
RESULT: [PASS/FAIL]
OBSERVATIONS: [What you saw in DevTools]
ISSUES (if any): [Describe any unexpected behavior]
REMEDIATION: [If failed, what needs fixing]
```

---

*Testing Date: May 21, 2026 | Status: Ready to begin*
