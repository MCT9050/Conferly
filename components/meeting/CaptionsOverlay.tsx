"use client";

// components/meeting/CaptionsOverlay.tsx
// Real-time caption translation overlay.
// Uses browser SpeechRecognition for input and the TRANSLATE Server Action
// for multi-language support via Hugging Face mBART.

import { useCallback, useEffect, useRef, useState } from "react";
import { translateAction, type TranslateRequest } from "../../app/actions/ai-actions";

// ---------------------------------------------------------------------------
// Supported South African languages for translation
// ---------------------------------------------------------------------------

export type TargetLanguage = {
  code: string;
  label: string;
  mbartCode: string;
};

export const SUPPORTED_LANGUAGES: TargetLanguage[] = [
  { code: "zu", label: "isiZulu", mbartCode: "zu_ZA" },
  { code: "af", label: "Afrikaans", mbartCode: "af_ZA" },
  { code: "xh", label: "isiXhosa", mbartCode: "xh_ZA" },
  { code: "en", label: "English", mbartCode: "en_XX" },
  { code: "st", label: "Sesotho", mbartCode: "st_ZA" },
  { code: "tn", label: "Setswana", mbartCode: "tn_ZA" },
  { code: "ts", label: "Xitsonga", mbartCode: "ts_ZA" },
  { code: "ss", label: "SiSwati", mbartCode: "ss_ZA" },
  { code: "ve", label: "Tshivenda", mbartCode: "ve_ZA" },
  { code: "nr", label: "isiNdebele", mbartCode: "nr_ZA" },
  { code: "nso", label: "Sesotho sa Leboa", mbartCode: "nso_ZA" },
];

export type CaptionEntry = {
  id: string;
  original: string;
  translated: string;
  speaker: string;
  timestamp: number;
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type CaptionsOverlayProps = {
  /** Currently active transcript entries (final only) from useSpeechTranscript */
  captions: { id: string; speaker: string; text: string; timestamp: string }[];
  /** Interim (unconfirmed) speech text */
  interimText: string;
  /** Whether speech recognition is active */
  isListening: boolean;
  /** Target language for translation */
  targetLang?: TargetLanguage;
  /** Called when the user changes the target language */
  onLanguageChange?: (lang: TargetLanguage) => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CaptionsOverlay({
  captions,
  interimText,
  isListening,
  targetLang = SUPPORTED_LANGUAGES[0], // Default: isiZulu
  onLanguageChange,
}: CaptionsOverlayProps) {
  const [translatedEntries, setTranslatedEntries] = useState<CaptionEntry[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const lastProcessedRef = useRef<Set<string>>(new Set());

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [translatedEntries]);

  // Process new captions through the translation action
  const processCaptions = useCallback(async () => {
    if (captions.length === 0) return;

    // Find captions that haven't been translated yet
    const newCaptions = captions.filter((c) => !lastProcessedRef.current.has(c.id));
    if (newCaptions.length === 0) return;

    setIsTranslating(true);

    // Process in parallel, but batch to avoid rate limits
    const batchSize = 3;
    for (let i = 0; i < newCaptions.length; i += batchSize) {
      const batch = newCaptions.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((caption) => {
          lastProcessedRef.current.add(caption.id);
          const req: TranslateRequest = {
            text: caption.text,
            sourceLang: "en_XX",
            targetLang: targetLang.mbartCode,
          };
          return translateAction(req);
        }),
      );

      setTranslatedEntries((prev) => {
        const next = [...prev];
        batch.forEach((caption, idx) => {
          const result = results[idx];
          // translateAction returns AIActionResponse — unwrap it
          const responseBody = result.status === "fulfilled" ? result.value : null;
          const translated =
            responseBody?.status === "OK" ? responseBody.data : `[Translation error]`;
          // Replace existing entry with same id or append
          const existingIdx = next.findIndex((e) => e.id === caption.id);
          const entry: CaptionEntry = {
            id: caption.id,
            original: caption.text,
            translated,
            speaker: caption.speaker,
            timestamp: Date.now(),
          };
          if (existingIdx >= 0) {
            next[existingIdx] = entry;
          } else {
            next.push(entry);
          }
        });
        // Keep only last 50 entries to prevent unbounded growth
        return next.slice(-50);
      });
    }

    setIsTranslating(false);
  }, [captions, targetLang.mbartCode]);

  // Trigger translation whenever new captions arrive
  useEffect(() => {
    void processCaptions();
  }, [processCaptions]);

  // Reset processed set when language changes
  useEffect(() => {
    lastProcessedRef.current.clear();
    setTranslatedEntries([]);
  }, [targetLang]);

  if (!isListening && captions.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/90 backdrop-blur-sm shadow-xl shadow-black/20 overflow-hidden">
      {/* Header with language selector */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs font-medium text-slate-300">
            {isListening ? "Live captions" : "Captions paused"}
          </span>
          {isTranslating && (
            <span className="text-[10px] text-cyan-400">Translating...</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onLanguageChange && (
            <select
              value={targetLang.code}
              onChange={(e) => {
                const lang = SUPPORTED_LANGUAGES.find(
                  (l) => l.code === e.target.value,
                );
                if (lang && onLanguageChange) onLanguageChange(lang);
              }}
              className="text-xs rounded-lg bg-slate-800/80 border border-slate-700/30 text-slate-200 px-2 py-1 focus:outline-none focus:border-cyan-500/40"
              aria-label="Translation target language"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          )}
          {!onLanguageChange && (
            <span className="text-xs text-slate-400">{targetLang.label}</span>
          )}
        </div>
      </div>

      {/* Caption list */}
      <div
        ref={listRef}
        className="overflow-y-auto max-h-56 p-3 space-y-2"
        aria-live="polite"
      >
        {translatedEntries.length === 0 && (
          <p className="text-xs text-slate-500 text-center py-4">
            {isListening
              ? "Speak to see live captions..."
              : "Captions will appear here when transcription starts."}
          </p>
        )}
        {translatedEntries.map((entry) => (
          <div key={entry.id} className="space-y-0.5">
            <div className="text-xs text-slate-500 font-medium">
              {entry.speaker}
            </div>
            <div className="text-sm text-slate-200">{entry.translated}</div>
            <div className="text-[11px] text-slate-500 italic truncate">
              {entry.original}
            </div>
          </div>
        ))}
        {interimText && (
          <div className="opacity-60">
            <div className="text-xs text-slate-500 font-medium">
              Listening...
            </div>
            <div className="text-sm text-slate-300 italic">{interimText}</div>
          </div>
        )}
      </div>
    </div>
  );
}