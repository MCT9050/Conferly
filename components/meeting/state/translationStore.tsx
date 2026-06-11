"use client";

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { SALanguage, TranslationResult } from '../../../hooks/useTranslation';
import { translateAction } from '../../../app/actions/ai-actions';

const defaultLanguages: SALanguage[] = [
  { code: 'en', name: 'English', nativeName: 'English', apiCode: 'en-US' },
  { code: 'zu', name: 'isiZulu', nativeName: 'isiZulu', apiCode: 'zu-ZA' },
  { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans', apiCode: 'af-ZA' },
  { code: 'xh', name: 'isiXhosa', nativeName: 'isiXhosa', apiCode: 'xh-ZA' },
];

// Map SALanguage apiCode (e.g. "zu-ZA") to mBART code (e.g. "zu_ZA")
function toMbartCode(apiCode: string): string {
  return apiCode.replace('-', '_');
}

type MeetingTranslationContextValue = {
  translations: TranslationResult[];
  isTranslating: boolean;
  translationError: string | null;
  translationSourceLang: SALanguage;
  translationTargetLang: SALanguage;
  translationAutoDetect: boolean;
  translationLanguages: SALanguage[];
  onSetTranslationSource: (lang: SALanguage) => void;
  onSetTranslationTarget: (lang: SALanguage) => void;
  onSetTranslationAutoDetect: (value: boolean) => void;
  onTranslate: (text: string, speaker?: string) => Promise<TranslationResult | null>;
  onTranslateBatch: (entries: { text: string; speaker?: string }[]) => Promise<TranslationResult[]>;
  onClearTranslations: () => void;
};

const MeetingTranslationContext = createContext<MeetingTranslationContextValue | null>(null);

export function MeetingTranslationProvider({ children }: { children: ReactNode }) {
  const [translations, setTranslations] = useState<TranslationResult[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [translationSourceLang, setTranslationSourceLang] = useState(defaultLanguages[0]);
  const [translationTargetLang, setTranslationTargetLang] = useState(defaultLanguages[1]);
  const [translationAutoDetect, setTranslationAutoDetect] = useState(true);

  const onTranslate = useCallback(async (text: string, speaker?: string) => {
    try {
      setIsTranslating(true);
      setTranslationError(null);

      const translateResponse = await translateAction({
        text,
        sourceLang: toMbartCode(translationSourceLang.apiCode),
        targetLang: toMbartCode(translationTargetLang.apiCode),
      });
      const translatedText = translateResponse.status === "OK" ? translateResponse.data : `[Translation error: ${translateResponse.status === "ERROR" ? translateResponse.error : "AI cooldown"}]`;

      const result: TranslationResult = {
        id: Math.random().toString(36).slice(2, 10),
        originalText: text,
        translatedText,
        sourceLang: translationSourceLang,
        targetLang: translationTargetLang,
        speaker,
        timestamp: new Date().toISOString(),
      };
      setTranslations(current => [result, ...current]);
      return result;
    } catch (error) {
      console.error('Translation failed:', error);
      setTranslationError('Translation failed.');
      return null;
    } finally {
      setIsTranslating(false);
    }
  }, [translationSourceLang, translationTargetLang]);

  const onTranslateBatch = useCallback(async (entries: { text: string; speaker?: string }[]) => {
    const results = await Promise.all(entries.map(entry => onTranslate(entry.text, entry.speaker)));
    return results.filter(Boolean) as TranslationResult[];
  }, [onTranslate]);

  const onClearTranslations = useCallback(() => {
    setTranslations([]);
  }, []);

  const value = useMemo(
    () => ({
      translations,
      isTranslating,
      translationError,
      translationSourceLang,
      translationTargetLang,
      translationAutoDetect,
      translationLanguages: defaultLanguages,
      onSetTranslationSource: setTranslationSourceLang,
      onSetTranslationTarget: setTranslationTargetLang,
      onSetTranslationAutoDetect: setTranslationAutoDetect,
      onTranslate,
      onTranslateBatch,
      onClearTranslations,
    }),
    [
      translations,
      isTranslating,
      translationError,
      translationSourceLang,
      translationTargetLang,
      translationAutoDetect,
      onTranslate,
      onTranslateBatch,
      onClearTranslations,
    ]
  );

  return <MeetingTranslationContext.Provider value={value}>{children}</MeetingTranslationContext.Provider>;
}

export function useMeetingTranslation() {
  const context = useContext(MeetingTranslationContext);
  if (!context) {
    throw new Error('useMeetingTranslation must be used within MeetingTranslationProvider');
  }
  return context;
}
