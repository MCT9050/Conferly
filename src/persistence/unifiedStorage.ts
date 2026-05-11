/**
 * Unified Storage Layer - Enforces 3-tier data pattern
 * 
 * TIER 1 (localStorage): Thin metadata only
 *   - Auth tokens, active session IDs, user profile snapshots, banner dismissals
 * 
 * TIER 2 (IndexedDB): Offline-first local data buffer
 *   - Call recordings, chat archives, transcript caches, doc backups
 * 
 * TIER 3 (Supabase): Cloud source of truth + auto-sync
 *   - Remote sync when online
 */

import { supabase, isSupabaseConfigured } from './supabase';
import type { UserProfile } from '../hooks/useAuth';

// ============================================================================
// TIER 1: localStorage - Thin metadata only
// ============================================================================

const LS_KEYS = {
  AUTH_TOKEN: 'conferly_auth_token',
  REFRESH_TOKEN: 'conferly_refresh_token',
  USER_PROFILE: 'conferly_user_profile',
  ACTIVE_SESSION: 'conferly_active_session',
  BANNER_DISMISSED: 'conferly_banner_dismissed',
  ONBOARDING_COMPLETE: 'conferly_onboarding_complete',
  LAST_SYNC: 'conferly_last_sync',
} as const;

// Thin metadata getters/setters
export const tier1 = {
  // Auth tokens
  getToken(): string | null {
    return localStorage.getItem(LS_KEYS.AUTH_TOKEN);
  },
  setToken(token: string): void {
    localStorage.setItem(LS_KEYS.AUTH_TOKEN, token);
  },
  clearToken(): void {
    localStorage.removeItem(LS_KEYS.AUTH_TOKEN);
  },
  
  getRefreshToken(): string | null {
    return localStorage.getItem(LS_KEYS.REFRESH_TOKEN);
  },
  setRefreshToken(token: string): void {
    localStorage.setItem(LS_KEYS.REFRESH_TOKEN, token);
  },
  
  // User profile snapshot
  getProfile(): UserProfile | null {
    try {
      const data = localStorage.getItem(LS_KEYS.USER_PROFILE);
      return data ? JSON.parse(data) : null;
    } catch { return null; }
  },
  setProfile(profile: UserProfile): void {
    localStorage.setItem(LS_KEYS.USER_PROFILE, JSON.stringify(profile));
  },
  clearProfile(): void {
    localStorage.removeItem(LS_KEYS.USER_PROFILE);
  },
  
  // Active session ID (room)
  getActiveSession(): string | null {
    return localStorage.getItem(LS_KEYS.ACTIVE_SESSION);
  },
  setActiveSession(roomId: string): void {
    localStorage.setItem(LS_KEYS.ACTIVE_SESSION, roomId);
  },
  clearActiveSession(): void {
    localStorage.removeItem(LS_KEYS.ACTIVE_SESSION);
  },
  
  // Banner dismissal flags
  isBannerDismissed(bannerId: string): boolean {
    try {
      const dismissed = localStorage.getItem(LS_KEYS.BANNER_DISMISSED);
      const flags = dismissed ? JSON.parse(dismissed) : {};
      return !!flags[bannerId];
    } catch { return false; }
  },
  dismissBanner(bannerId: string): void {
    try {
      const dismissed = localStorage.getItem(LS_KEYS.BANNER_DISMISSED);
      const flags = dismissed ? JSON.parse(dismissed) : {};
      flags[bannerId] = true;
      localStorage.setItem(LS_KEYS.BANNER_DISMISSED, JSON.stringify(flags));
    } catch {}
  },
  
  // Onboarding state
  isOnboardingComplete(): boolean {
    return localStorage.getItem(LS_KEYS.ONBOARDING_COMPLETE) === 'true';
  },
  setOnboardingComplete(complete: boolean): void {
    localStorage.setItem(LS_KEYS.ONBOARDING_COMPLETE, String(complete));
  },
  
  // Last sync timestamp
  getLastSync(): number | null {
    const ts = localStorage.getItem(LS_KEYS.LAST_SYNC);
    return ts ? parseInt(ts, 10) : null;
  },
  setLastSync(timestamp: number): void {
    localStorage.setItem(LS_KEYS.LAST_SYNC, String(timestamp));
  },
  
  // Clear all tier1
  clearAll(): void {
    Object.values(LS_KEYS).forEach(key => localStorage.removeItem(key));
  },
};

// ============================================================================
// TIER 2: IndexedDB - Offline-first local data buffer
// ============================================================================

const IDB_NAME = 'conferly_offline';
const IDB_VERSION = 1;

const IDB_STORES = {
  RECORDINGS: 'recordings',
  CHATS: 'chats',
  TRANSCRIPTS: 'transcripts',
  DOCS: 'documents',
  PENDING_SYNC: 'pendingSync',
} as const;

let idbDb: IDBDatabase | null = null;

async function openIDB(): Promise<IDBDatabase> {
  if (idbDb) return idbDb;
  
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      idbDb = req.result;
      resolve(idbDb);
    };
    
    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create object stores
      if (!db.objectStoreNames.contains(IDB_STORES.RECORDINGS)) {
        db.createObjectStore(IDB_STORES.RECORDINGS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(IDB_STORES.CHATS)) {
        const store = db.createObjectStore(IDB_STORES.CHATS, { keyPath: 'id' });
        store.createIndex('roomId', 'roomId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains(IDB_STORES.TRANSCRIPTS)) {
        const store = db.createObjectStore(IDB_STORES.TRANSCRIPTS, { keyPath: 'id' });
        store.createIndex('roomId', 'roomId', { unique: false });
      }
      if (!db.objectStoreNames.contains(IDB_STORES.DOCS)) {
        db.createObjectStore(IDB_STORES.DOCS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(IDB_STORES.PENDING_SYNC)) {
        db.createObjectStore(IDB_STORES.PENDING_SYNC, { keyPath: 'id' });
      }
    };
  });
}

// Tier 2 IndexedDB operations
export const tier2 = {
  // Recordings (call recordings, blobs)
  async saveRecording(data: { id: string; roomId: string; blob: Blob; createdAt: string }): Promise<void> {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORES.RECORDINGS, 'readwrite');
      const store = tx.objectStore(IDB_STORES.RECORDINGS);
      const req = store.put(data);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
  
  async getRecording(id: string): Promise<Blob | null> {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORES.RECORDINGS, 'readonly');
      const store = tx.objectStore(IDB_STORES.RECORDINGS);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result?.blob || null);
      req.onerror = () => reject(req.error);
    });
  },
  
  async deleteRecording(id: string): Promise<void> {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORES.RECORDINGS, 'readwrite');
      const store = tx.objectStore(IDB_STORES.RECORDINGS);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
  
  // Chat archives
  async saveChat(data: { id: string; roomId: string; messages: any[]; updatedAt: string }): Promise<void> {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORES.CHATS, 'readwrite');
      const store = tx.objectStore(IDB_STORES.CHATS);
      const req = store.put(data);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
  
  async getChatsByRoom(roomId: string): Promise<any[]> {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORES.CHATS, 'readonly');
      const store = tx.objectStore(IDB_STORES.CHATS);
      const index = store.index('roomId');
      const req = index.getAll(roomId);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },
  
  // Transcript caches
  async saveTranscript(data: { id: string; roomId: string; entries: any[]; language: string; createdAt: string }): Promise<void> {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORES.TRANSCRIPTS, 'readwrite');
      const store = tx.objectStore(IDB_STORES.TRANSCRIPTS);
      const req = store.put(data);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
  
  async getTranscript(id: string): Promise<any | null> {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORES.TRANSCRIPTS, 'readonly');
      const store = tx.objectStore(IDB_STORES.TRANSCRIPTS);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },
  
  // Document backups
  async saveDoc(data: { id: string; content: string; updatedAt: string }): Promise<void> {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORES.DOCS, 'readwrite');
      const store = tx.objectStore(IDB_STORES.DOCS);
      const req = store.put(data);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
  
  async getDoc(id: string): Promise<string | null> {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORES.DOCS, 'readonly');
      const store = tx.objectStore(IDB_STORES.DOCS);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result?.content || null);
      req.onerror = () => reject(req.error);
    });
  },
  
  // Pending sync queue
  async addToSyncQueue(data: { id: string; type: string; payload: any; createdAt: string }): Promise<void> {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORES.PENDING_SYNC, 'readwrite');
      const store = tx.objectStore(IDB_STORES.PENDING_SYNC);
      const req = store.put(data);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
  
  async getPendingSync(): Promise<any[]> {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORES.PENDING_SYNC, 'readonly');
      const store = tx.objectStore(IDB_STORES.PENDING_SYNC);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },
  
  async clearSyncQueue(): Promise<void> {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORES.PENDING_SYNC, 'readwrite');
      const store = tx.objectStore(IDB_STORES.PENDING_SYNC);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
};

// ============================================================================
// TIER 3: Supabase - Cloud source of truth + auto-sync
// ============================================================================

export const tier3 = {
  // Check if online and configured
  isConfigured(): boolean {
    return isSupabaseConfigured;
  },
  
  isOnline(): boolean {
    return navigator.onLine && isSupabaseConfigured;
  },
  
  // Meeting sync
  async syncMeeting(meeting: { id: string; roomCode: string; title: string; startedAt: string; endedAt?: string }): Promise<boolean> {
    if (!isSupabaseConfigured) {
      await tier2.addToSyncQueue({ id: meeting.id, type: 'meeting', payload: meeting, createdAt: new Date().toISOString() });
      return false;
    }
    
    try {
      const { error } = await supabase.from('meetings').upsert(meeting, { onConflict: 'id' });
      if (error) throw error;
      tier1.setLastSync(Date.now());
      return true;
    } catch (err) {
      console.warn('[sync] Meeting sync failed:', err);
      await tier2.addToSyncQueue({ id: meeting.id, type: 'meeting', payload: meeting, createdAt: new Date().toISOString() });
      return false;
    }
  },
  
  // Chat sync
  async syncChat(roomId: string, messages: any[]): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    
    try {
      const { error } = await supabase.from('chats').upsert({ roomId, messages, updatedAt: new Date().toISOString() }, { onConflict: 'roomId' });
      if (error) throw error;
      return true;
    } catch (err) {
      console.warn('[sync] Chat sync failed:', err);
      return false;
    }
  },
  
  // Transcript sync
  async syncTranscript(transcript: { id: string; roomId: string; entries: any[]; language: string }): Promise<boolean> {
    if (!isSupabaseConfigured) {
      await tier2.addToSyncQueue({ id: transcript.id, type: 'transcript', payload: transcript, createdAt: new Date().toISOString() });
      return false;
    }
    
    try {
      const { error } = await supabase.from('transcripts').upsert(transcript, { onConflict: 'id' });
      if (error) throw error;
      return true;
    } catch (err) {
      console.warn('[sync] Transcript sync failed:', err);
      return false;
    }
  },
  
  // Document sync
  async syncDocument(doc: { id: string; content: string }): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    
    try {
      const { error } = await supabase.from('documents').upsert(doc, { onConflict: 'id' });
      if (error) throw error;
      return true;
    } catch (err) {
      console.warn('[sync] Document sync failed:', err);
      return false;
    }
  },
};

// ============================================================================
// AUTO-SYNC: Process pending queue when online
// ============================================================================

let syncInterval: number | null = null;

export function startAutoSync(intervalMs = 30000): void {
  if (syncInterval) return;
  
  const sync = async () => {
    if (!tier3.isOnline()) return;
    
    try {
      const pending = await tier2.getPendingSync();
      if (pending.length === 0) return;
      
      let synced = 0;
      for (const item of pending) {
        let success = false;
        
        if (item.type === 'meeting') {
          success = await tier3.syncMeeting(item.payload);
        } else if (item.type === 'transcript') {
          success = await tier3.syncTranscript(item.payload);
        }
        
        if (success) synced++;
      }
      
      if (synced === pending.length) {
        await tier2.clearSyncQueue();
      }
      
      console.log(`[sync] Synced ${synced}/${pending.length} items`);
    } catch (err) {
      console.warn('[sync] Auto-sync error:', err);
    }
  };
  
  // Listen for online event
  window.addEventListener('online', sync);
  
  // Start interval
  syncInterval = window.setInterval(sync, intervalMs);
}

export function stopAutoSync(): void {
  if (syncInterval) {
    window.clearInterval(syncInterval);
    syncInterval = null;
  }
}
