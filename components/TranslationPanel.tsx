"use client";

import { useState, useRef, useEffect } from 'react';
import {
  Languages, ArrowRight, ArrowLeftRight, Loader2, Send,
  Sparkles, Globe, AlertCircle, Trash2, Volume2, ChevronDown
} from 'lucide-react';
import type { SALanguage, TranslationResult } from '../hooks/useTranslation';
import type { TranscriptEntry } from '../types';

interface TranslationPanelProps {
  translations: TranslationResult[];
  isTranslating: boolean;
  error: string | null;
  sourceLang: SALanguage;
  targetLang: SALanguage;
  autoDetect: boolean;
  languages: SALanguage[];
  onSetSourceLang: (lang: SALanguage) => void;
  onSetTargetLang: (lang: SALanguage) => void;
  onSetAutoDetect: (v: boolean) => void;
  onTranslate: (text: string, speaker?: string) => Promise<TranslationResult | null>;
  onTranslateTranscript: (entries: { text: string; speaker?: string }[]) => Promise<TranslationResult[]>;
  onClear: () => void;
  transcript: TranscriptEntry[];
}

export default function TranslationPanel({
  translations, isTranslating, error,
  sourceLang, targetLang, autoDetect, languages,
  onSetSourceLang, onSetTargetLang, onSetAutoDetect,
  onTranslate, onTranslateTranscript, onClear,
  transcript,
}: TranslationPanelProps) {
  const [manualInput, setManualInput] = useState('');
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [showTargetPicker, setShowTargetPicker] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [translations.length]);

  const handleManualTranslate = async () => {
    if (!manualInput.trim()) return;
    await onTranslate(manualInput.trim());
    setManualInput('');
  };

  const handleTranslateAllTranscript = () => {
    const entries = transcript
      .filter(t => t.isFinal && t.text.trim().length > 3)
      .map(t => ({ text: t.text, speaker: t.speaker }));
    if (entries.length > 0) {
      onTranslateTranscript(entries);
    }
  };

  const swapLanguages = () => {
    const temp = sourceLang;
    onSetSourceLang(targetLang);
    onSetTargetLang(temp);
  };

  const speakText = (text: string, langCode: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    speechSynthesis.speak(utterance);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header — Language Selector */}
      <div className="px-4 pt-3 pb-3 border-b border-slate-800/30 space-y-3">
        {/* Status */}
        <div className="flex items-center gap-2 text-xs">
          <Globe className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-cyan-400 font-medium">Remote AI Translation</span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-500">MyMemory API</span>
        </div>

        {/* Language pair selector */}
        <div className="flex items-center gap-2">
          {/* Source */}
          <div className="relative flex-1">
            <button
              onClick={() => { setShowSourcePicker(!showSourcePicker); setShowTargetPicker(false); }}
              className="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/30 text-sm text-left flex items-center justify-between hover:border-slate-600/40 transition-colors"
            >
              <div>
                <div className="text-xs text-slate-500">From</div>
                <div className="text-slate-200 font-medium">
                  {autoDetect ? 'Auto-detect' : sourceLang.nativeName}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>
            {showSourcePicker && (
              <div className="absolute top-full left-0 right-0 mt-1 glass rounded-xl shadow-2xl z-20 max-h-48 overflow-y-auto">
                <button
                  onClick={() => { onSetAutoDetect(true); setShowSourcePicker(false); }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-800/40 transition-colors flex items-center gap-2 ${autoDetect ? 'text-cyan-400' : 'text-slate-300'}`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Auto-detect
                </button>
                {languages.filter(l => l.code !== 'en').map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => { onSetSourceLang(lang); onSetAutoDetect(false); setShowSourcePicker(false); }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-800/40 transition-colors ${sourceLang.code === lang.code && !autoDetect ? 'text-cyan-400' : 'text-slate-300'}`}
                  >
                    <span className="font-medium">{lang.nativeName}</span>
                    <span className="text-slate-500 ml-1.5 text-xs">{lang.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Swap */}
          <button
            onClick={swapLanguages}
            className="p-2 rounded-lg bg-slate-800/40 text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors shrink-0"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>

          {/* Target */}
          <div className="relative flex-1">
            <button
              onClick={() => { setShowTargetPicker(!showTargetPicker); setShowSourcePicker(false); }}
              className="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/30 text-sm text-left flex items-center justify-between hover:border-slate-600/40 transition-colors"
            >
              <div>
                <div className="text-xs text-slate-500">To</div>
                <div className="text-slate-200 font-medium">{targetLang.nativeName}</div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>
            {showTargetPicker && (
              <div className="absolute top-full left-0 right-0 mt-1 glass rounded-xl shadow-2xl z-20 max-h-48 overflow-y-auto">
                {languages.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => { onSetTargetLang(lang); setShowTargetPicker(false); }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-800/40 transition-colors ${targetLang.code === lang.code ? 'text-cyan-400' : 'text-slate-300'}`}
                  >
                    <span className="font-medium">{lang.nativeName}</span>
                    <span className="text-slate-500 ml-1.5 text-xs">{lang.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Translate transcript button */}
        <button
          onClick={handleTranslateAllTranscript}
          disabled={isTranslating || transcript.filter(t => t.isFinal).length === 0}
          className="w-full py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-xs font-medium flex items-center justify-center gap-2 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {isTranslating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Translating…
            </>
          ) : (
            <>
              <Languages className="w-3.5 h-3.5" />
              Translate entire transcript ({transcript.filter(t => t.isFinal).length} entries)
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2 text-xs text-red-400">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Translation Results */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {translations.length === 0 && (
          <div className="text-center py-12 space-y-3">
            <Languages className="w-10 h-10 text-slate-500 mx-auto" />
            <div className="text-sm text-slate-500">No translations yet</div>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Type text below or translate the live transcript. Supports all 11 SA official languages.
            </p>
          </div>
        )}

        {translations.map(t => (
          <div key={t.id} className="glass-light rounded-xl p-3 space-y-2">
            {/* Source */}
            <div className="flex items-start gap-2">
              <div className="px-1.5 py-0.5 rounded bg-slate-700/50 text-[9px] text-slate-400 font-mono shrink-0 mt-0.5">
                {t.sourceLang.code.toUpperCase()}
              </div>
              <div className="flex-1">
                {t.speaker && (
                  <span className="text-[10px] text-blue-400 font-medium">{t.speaker} • </span>
                )}
                <span className="text-sm text-slate-400">{t.originalText}</span>
              </div>
              <button
                onClick={() => speakText(t.originalText, t.sourceLang.apiCode)}
                className="p-1 text-slate-500 hover:text-slate-300 transition-colors shrink-0"
              >
                <Volume2 className="w-3 h-3" />
              </button>
            </div>

            {/* Arrow */}
            <div className="flex items-center gap-2 px-1">
              <ArrowRight className="w-3 h-3 text-cyan-500" />
              <div className="flex-1 h-px bg-gradient-to-r from-cyan-500/30 to-transparent" />
            </div>

            {/* Target */}
            <div className="flex items-start gap-2">
              <div className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-[9px] text-cyan-400 font-mono shrink-0 mt-0.5">
                {t.targetLang.code.toUpperCase()}
              </div>
              <p className="flex-1 text-sm text-white font-medium">{t.translatedText}</p>
              <button
                onClick={() => speakText(t.translatedText, t.targetLang.apiCode)}
                className="p-1 text-slate-500 hover:text-cyan-300 transition-colors shrink-0"
              >
                <Volume2 className="w-3 h-3" />
              </button>
            </div>

            <div className="text-[9px] text-slate-400 text-right">
              {t.timestamp ? new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Clear button */}
      {translations.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-800/30">
          <button
            onClick={onClear}
            className="w-full py-1.5 rounded-lg bg-slate-800/30 text-xs text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-3 h-3" />
            Clear translations
          </button>
        </div>
      )}

      {/* Manual Input */}
      <div className="p-3 border-t border-slate-800/50">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={manualInput}
            onChange={e => setManualInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleManualTranslate()}
            placeholder="Type in any SA language…"
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700/30 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/40"
          />
          <button
            onClick={handleManualTranslate}
            disabled={!manualInput.trim() || isTranslating}
            className="p-2.5 rounded-xl bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            {isTranslating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
