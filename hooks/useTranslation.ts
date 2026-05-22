export type SALanguage = {
  code: string;
  name: string;
  nativeName: string;
  apiCode: string;
};

export type TranslationResult = {
  id: string;
  originalText: string;
  translatedText: string;
  sourceLang: SALanguage;
  targetLang: SALanguage;
  speaker?: string;
  timestamp?: string;
};
