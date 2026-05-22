"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TranscriptEntry } from '../types';

type SpeechRecognitionConstructor = new () => any;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const MAX_TRANSCRIPT_SIZE = 1000; // Cap transcript to prevent memory issues

export function useSpeechTranscript() {
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [interimText, setInterimText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const recognitionClass = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    setIsSpeechSupported(Boolean(recognitionClass));
  }, []);

  const startListening = useCallback(() => {
    const recognitionClass = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!recognitionClass) return;

    if (recognitionRef.current) {
      recognitionRef.current.start();
      setIsListening(true);
      return;
    }

    const recognition = new recognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let interim = '';
      const results: TranscriptEntry[] = [];

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript?.trim() ?? '';

        if (result.isFinal) {
          results.push({
            id: `${Date.now()}-${i}`,
            speaker: 'You',
            text,
            isFinal: true,
            timestamp: new Date().toISOString(),
          });
        } else {
          interim = text;
        }
      }

      if (results.length > 0) {
        // Cap transcript to prevent unbounded growth
        setTranscript(current => {
          const updated = [...current, ...results];
          if (updated.length > MAX_TRANSCRIPT_SIZE) {
            // Remove oldest entries, keep last MAX_TRANSCRIPT_SIZE
            return updated.slice(updated.length - MAX_TRANSCRIPT_SIZE);
          }
          return updated;
        });
      }
      setInterimText(interim);
    };

    recognition.onerror = () => {
      setIsListening(false);
      recognition.stop();
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimText('');
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    transcript,
    interimText,
    isListening,
    isSpeechSupported,
    startListening,
    stopListening,
  };
}
