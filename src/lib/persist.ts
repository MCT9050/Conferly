// Conferly Persistence Layer
// Stores meeting history, transcripts, notes, and chat in IndexedDB.
// Syncs to backend when available, falls back to local-only.

const DB_NAME = 'conferly_data';
const DB_VERSION = 2;

const STORES = {
  meetings: 'meetings',
  transcripts: 'transcripts',
  notes: 'notes',
  chatHistory: 'chatHistory',
} as const;

export interface StoredMeeting {
  id: string;
  roomCode: string;
  title: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  participantCount: number;
}

export interface StoredTranscript {
  meetingId: string;
  entries: { speaker: string; text: string; timestamp: string }[];
  savedAt: string;
}

export interface StoredNote {
  meetingId: string;
  content: string;
  savedAt: string;
}

export interface StoredChat {
  meetingId: string;
  messages: { sender: string; text: string; timestamp: string }[];
  savedAt: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const store of Object.values(STORES)) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: store === 'meetings' ? 'id' : 'meetingId' });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putItem<T>(storeName: string, item: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getItem<T>(storeName: string, key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllItems<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteItem(storeName: string, key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Public API ───

export async function saveMeeting(meeting: StoredMeeting): Promise<void> {
  await putItem(STORES.meetings, meeting);
}

export async function getMeetings(): Promise<StoredMeeting[]> {
  const all = await getAllItems<StoredMeeting>(STORES.meetings);
  return all.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 50);
}

export async function deleteMeeting(id: string): Promise<void> {
  await deleteItem(STORES.meetings, id);
  // Also clean up associated data
  await deleteItem(STORES.transcripts, id).catch(() => {});
  await deleteItem(STORES.notes, id).catch(() => {});
  await deleteItem(STORES.chatHistory, id).catch(() => {});
}

export async function saveTranscript(meetingId: string, entries: StoredTranscript['entries']): Promise<void> {
  await putItem(STORES.transcripts, { meetingId, entries, savedAt: new Date().toISOString() });
}

export async function getTranscript(meetingId: string): Promise<StoredTranscript | undefined> {
  return getItem<StoredTranscript>(STORES.transcripts, meetingId);
}

export async function saveNotes(meetingId: string, content: string): Promise<void> {
  await putItem(STORES.notes, { meetingId, content, savedAt: new Date().toISOString() });
}

export async function getNotes(meetingId: string): Promise<StoredNote | undefined> {
  return getItem<StoredNote>(STORES.notes, meetingId);
}

export async function saveChatHistory(meetingId: string, messages: StoredChat['messages']): Promise<void> {
  await putItem(STORES.chatHistory, { meetingId, messages, savedAt: new Date().toISOString() });
}

export async function getChatHistory(meetingId: string): Promise<StoredChat | undefined> {
  return getItem<StoredChat>(STORES.chatHistory, meetingId);
}

// ─── Active Meeting Session (survives browser refresh) ───

const SESSION_KEY = 'conferly_active_session';

export interface ActiveSession {
  meetingId: string;
  roomCode: string;
  userName: string;
  startedAt: string;
  durationAtPause: number;
  passwordHash: string | null; // SHA-256 of meeting password for re-entry verification
}

export function saveActiveSession(session: ActiveSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadActiveSession(): ActiveSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearActiveSession() {
  localStorage.removeItem(SESSION_KEY);
}
