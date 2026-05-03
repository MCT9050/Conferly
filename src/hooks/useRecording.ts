import { useState, useCallback, useRef, useEffect } from 'react';

// ─── IndexedDB for on-device recording storage ───
const DB_NAME = 'conferly_recordings';
const STORE_NAME = 'recordings';
const DB_VERSION = 1;

export interface SavedRecording {
  id: string;
  title: string;
  blob: Blob;
  mimeType: string;
  duration: number;
  size: number;
  createdAt: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveToIndexedDB(recording: SavedRecording): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(recording);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadFromIndexedDB(): Promise<SavedRecording[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteFromIndexedDB(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Recording Hook ───

export function useRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [savedRecordings, setSavedRecordings] = useState<SavedRecording[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mimeRef = useRef('video/webm');

  // Load saved recordings on mount
  useEffect(() => {
    loadFromIndexedDB()
      .then(recs => setSavedRecordings(recs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))))
      .catch(() => {});
  }, []);

  const startRecording = useCallback((stream: MediaStream) => {
    if (!stream || recorderRef.current) return;

    chunksRef.current = [];
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm';
    mimeRef.current = mime;

    try {
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        setRecordedBlob(blob);
        chunksRef.current = [];
      };

      recorder.start(1000);
      recorderRef.current = recorder;
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => setRecordingDuration(d => d + 1), 1000);
    } catch (err) {
      console.warn('MediaRecorder failed:', err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setIsRecording(false);
  }, []);

  // Save recording to device (IndexedDB)
  const saveRecording = useCallback(async (title?: string) => {
    if (!recordedBlob) return;
    setIsSaving(true);
    try {
      const rec: SavedRecording = {
        id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: title || `Meeting ${new Date().toLocaleDateString()}`,
        blob: recordedBlob,
        mimeType: mimeRef.current,
        duration: recordingDuration,
        size: recordedBlob.size,
        createdAt: new Date().toISOString(),
      };
      await saveToIndexedDB(rec);
      setSavedRecordings(prev => [rec, ...prev]);
    } catch (err) {
      console.warn('Failed to save recording:', err);
    } finally {
      setIsSaving(false);
    }
  }, [recordedBlob, recordingDuration]);

  // Download recording to filesystem
  const downloadRecording = useCallback((blob?: Blob) => {
    const target = blob || recordedBlob;
    if (!target) return;
    const url = URL.createObjectURL(target);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conferly-recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [recordedBlob]);

  // Delete a saved recording
  const deleteRecording = useCallback(async (id: string) => {
    try {
      await deleteFromIndexedDB(id);
      setSavedRecordings(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.warn('Failed to delete recording:', err);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try { recorderRef.current.stop(); } catch { /* ignore */ }
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return {
    isRecording, recordedBlob, recordingDuration,
    savedRecordings, isSaving,
    startRecording, stopRecording,
    saveRecording, downloadRecording, deleteRecording,
  };
}
