import { useState, useCallback, useRef } from 'react';

// All 11 official SA languages + common African languages
export interface SALanguage {
  code: string;
  apiCode: string; // MyMemory API code
  name: string;
  nativeName: string;
}

export const SA_LANGUAGES: SALanguage[] = [
  { code: 'zu', apiCode: 'zu-ZA', name: 'Zulu', nativeName: 'isiZulu' },
  { code: 'xh', apiCode: 'xh-ZA', name: 'Xhosa', nativeName: 'isiXhosa' },
  { code: 'af', apiCode: 'af-ZA', name: 'Afrikaans', nativeName: 'Afrikaans' },
  { code: 'st', apiCode: 'st-ZA', name: 'Sotho', nativeName: 'Sesotho' },
  { code: 'tn', apiCode: 'tn-ZA', name: 'Tswana', nativeName: 'Setswana' },
  { code: 'ts', apiCode: 'ts-ZA', name: 'Tsonga', nativeName: 'Xitsonga' },
  { code: 'ss', apiCode: 'ss-ZA', name: 'Swati', nativeName: 'siSwati' },
  { code: 've', apiCode: 've-ZA', name: 'Venda', nativeName: 'Tshivenḓa' },
  { code: 'nr', apiCode: 'nr-ZA', name: 'Ndebele', nativeName: 'isiNdebele' },
  { code: 'nso', apiCode: 'nso-ZA', name: 'Northern Sotho', nativeName: 'Sepedi' },
  { code: 'en', apiCode: 'en-GB', name: 'English', nativeName: 'English' },
];

export interface TranslationResult {
  id: string;
  originalText: string;
  translatedText: string;
  sourceLang: SALanguage;
  targetLang: SALanguage;
  timestamp: Date;
  speaker?: string;
}

const MYMEMORY_BASE = 'https://api.mymemory.translated.net/get';

async function translateViaMyMemory(
  text: string,
  sourceLangCode: string,
  targetLangCode: string,
): Promise<string> {
  const url = `${MYMEMORY_BASE}?q=${encodeURIComponent(text)}&langpair=${sourceLangCode}|${targetLangCode}`;

  const response = await fetch(url);
  if (response.status === 429) throw new Error('Translation rate limit reached. Please wait a moment and try again.');
  if (response.status === 403) throw new Error('Translation service temporarily unavailable. Try again shortly.');
  if (!response.ok) throw new Error(`Translation API error: ${response.status}`);

  const data = await response.json();

  if (data.responseStatus === 200 && data.responseData?.translatedText) {
    const result = data.responseData.translatedText;
    // MyMemory sometimes returns the input unchanged if unsupported
    if (result.toLowerCase() === text.toLowerCase()) {
      // Fallback: try without country code
      const shortSource = sourceLangCode.split('-')[0];
      const shortTarget = targetLangCode.split('-')[0];
      if (shortSource !== sourceLangCode || shortTarget !== targetLangCode) {
        const fallbackUrl = `${MYMEMORY_BASE}?q=${encodeURIComponent(text)}&langpair=${shortSource}|${shortTarget}`;
        const fbResp = await fetch(fallbackUrl);
        if (fbResp.ok) {
          const fbData = await fbResp.json();
          if (fbData.responseData?.translatedText) {
            return fbData.responseData.translatedText;
          }
        }
      }
    }
    return result;
  }

  throw new Error(data.responseDetails || 'Translation failed');
}

// Detect language from common SA language patterns
function detectSALanguage(text: string): SALanguage | null {
  const lower = text.toLowerCase();

  // Zulu markers
  if (/\b(ngiy|umuntu|abantu|uku|isiz|ngi|bafundi|sawubona|nkosi)\b/i.test(lower)) {
    return SA_LANGUAGES.find(l => l.code === 'zu')!;
  }
  // Xhosa markers
  if (/\b(ndiy|umntu|abantu|ukux|isix|molo|enkosi|ndiyak)\b/i.test(lower)) {
    return SA_LANGUAGES.find(l => l.code === 'xh')!;
  }
  // Afrikaans markers
  if (/\b(die|het|nie|van|wat|kan|sal|ons|hul|baie|goeie|dankie|asseblief)\b/i.test(lower)) {
    return SA_LANGUAGES.find(l => l.code === 'af')!;
  }
  // Sotho markers
  if (/\b(ke|ba|le|ho|tsa|sa|ya|ena|bona|dumela|kea)\b/i.test(lower) && /\b(ntho|motho|batho)\b/i.test(lower)) {
    return SA_LANGUAGES.find(l => l.code === 'st')!;
  }
  // Tswana markers
  if (/\b(ke|re|ba|le|go|dumela|rre|mma|pula)\b/i.test(lower) && /\b(motho|batho|lefatshe)\b/i.test(lower)) {
    return SA_LANGUAGES.find(l => l.code === 'tn')!;
  }
  // Tsonga markers
  if (/\b(ndzi|va|ku|hi|xik|avuxeni|inkomu)\b/i.test(lower)) {
    return SA_LANGUAGES.find(l => l.code === 'ts')!;
  }
  // Venda markers
  if (/\b(ndi|vha|u|zwi|ndaa|tshiven)\b/i.test(lower)) {
    return SA_LANGUAGES.find(l => l.code === 've')!;
  }

  return null;
}

export function useTranslation() {
  const [translations, setTranslations] = useState<TranslationResult[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceLang, setSourceLang] = useState<SALanguage>(SA_LANGUAGES.find(l => l.code === 'zu')!);
  const [targetLang, setTargetLang] = useState<SALanguage>(SA_LANGUAGES.find(l => l.code === 'en')!);
  const [autoDetect, setAutoDetect] = useState(true);
  const cacheRef = useRef<Map<string, string>>(new Map());

  const translate = useCallback(async (
    text: string,
    speaker?: string,
    overrideSource?: SALanguage,
    overrideTarget?: SALanguage,
  ): Promise<TranslationResult | null> => {
    if (!text.trim()) return null;

    const src = overrideSource || sourceLang;
    let actualSrc = src;
    const tgt = overrideTarget || targetLang;

    // Auto-detect SA language if enabled
    if (autoDetect && !overrideSource) {
      const detected = detectSALanguage(text);
      if (detected) {
        actualSrc = detected;
      }
    }

    // Skip if source === target
    if (actualSrc.code === tgt.code) return null;

    // Check cache
    const cacheKey = `${actualSrc.apiCode}|${tgt.apiCode}|${text.trim().toLowerCase()}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      const result: TranslationResult = {
        id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        originalText: text.trim(),
        translatedText: cached,
        sourceLang: actualSrc,
        targetLang: tgt,
        timestamp: new Date(),
        speaker,
      };
      setTranslations(prev => [...prev, result]);
      return result;
    }

    setIsTranslating(true);
    setError(null);

    try {
      const translated = await translateViaMyMemory(text.trim(), actualSrc.apiCode, tgt.apiCode);

      // Cache it
      cacheRef.current.set(cacheKey, translated);

      const result: TranslationResult = {
        id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        originalText: text.trim(),
        translatedText: translated,
        sourceLang: actualSrc,
        targetLang: tgt,
        timestamp: new Date(),
        speaker,
      };
      setTranslations(prev => [...prev, result]);
      setIsTranslating(false);
      return result;
    } catch (err: any) {
      setError(err.message || 'Translation failed');
      setIsTranslating(false);
      return null;
    }
  }, [sourceLang, targetLang, autoDetect]);

  const translateBatch = useCallback(async (
    texts: { text: string; speaker?: string }[],
  ): Promise<TranslationResult[]> => {
    const results: TranslationResult[] = [];
    for (const item of texts) {
      const r = await translate(item.text, item.speaker);
      if (r) results.push(r);
    }
    return results;
  }, [translate]);

  const clearTranslations = useCallback(() => {
    setTranslations([]);
  }, []);

  return {
    translations,
    isTranslating,
    error,
    sourceLang, setSourceLang,
    targetLang, setTargetLang,
    autoDetect, setAutoDetect,
    translate,
    translateBatch,
    clearTranslations,
    languages: SA_LANGUAGES,
    detectLanguage: detectSALanguage,
  };
}
