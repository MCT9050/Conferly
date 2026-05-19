import { useState, useCallback } from 'react';
import type { TranscriptEntry } from '../types';

// Real extractive summarization: TF-IDF scoring + sentence ranking
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2);
}

const STOP_WORDS = new Set([
  'the', 'and', 'that', 'this', 'with', 'from', 'have', 'has', 'had',
  'was', 'were', 'are', 'been', 'being', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'for', 'not', 'but',
  'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
  'some', 'such', 'than', 'too', 'very', 'just', 'about', 'also',
  'into', 'over', 'after', 'before', 'between', 'under', 'again',
  'then', 'here', 'there', 'once', 'during', 'out', 'like', 'think',
  'let', 'get', 'got', 'going', 'our', 'need', 'see', 'thing',
]);

function computeTfIdf(sentences: string[]): Map<string, number>[] {
  const allTokens = sentences.map(s => tokenize(s).filter(t => !STOP_WORDS.has(t)));
  const docFreq = new Map<string, number>();
  const seen = new Set<string>();

  for (const tokens of allTokens) {
    seen.clear();
    for (const t of tokens) {
      if (!seen.has(t)) {
        docFreq.set(t, (docFreq.get(t) || 0) + 1);
        seen.add(t);
      }
    }
  }

  const N = sentences.length;
  return allTokens.map(tokens => {
    const tf = new Map<string, number>();
    for (const t of tokens) {
      tf.set(t, (tf.get(t) || 0) + 1);
    }
    const tfidf = new Map<string, number>();
    for (const [term, count] of tf) {
      const idf = Math.log(N / (docFreq.get(term) || 1));
      tfidf.set(term, (count / tokens.length) * idf);
    }
    return tfidf;
  });
}

function scoreSentence(tfidf: Map<string, number>): number {
  let total = 0;
  for (const v of tfidf.values()) total += v;
  return total;
}

function summarize(entries: TranscriptEntry[], numBullets: number = 3): string[] {
  if (entries.length === 0) return ['No transcript data available to analyze.'];

  // Group by speaker turns to get complete thoughts
  const sentences: { text: string; speaker: string }[] = [];
  for (const e of entries) {
    if (e.text.trim().length > 10) {
      sentences.push({ text: e.text.trim(), speaker: e.speaker });
    }
  }

  if (sentences.length === 0) {
    return ['The transcript is too short to generate a meaningful summary.'];
  }

  if (sentences.length <= numBullets) {
    return sentences.map(s => `${s.speaker}: "${s.text}"`);
  }

  // Compute TF-IDF scores
  const tfidfScores = computeTfIdf(sentences.map(s => s.text));
  const scored = sentences.map((s, i) => ({
    ...s,
    score: scoreSentence(tfidfScores[i]),
    index: i,
  }));

  // Sort by score, take top N, then re-sort by original order
  const topSentences = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, numBullets)
    .sort((a, b) => a.index - b.index);

  // Identify key topics
  const allTerms = new Map<string, number>();
  for (const tfidf of tfidfScores) {
    for (const [term, score] of tfidf) {
      allTerms.set(term, (allTerms.get(term) || 0) + score);
    }
  }

  return topSentences.map(s => {
    return `${s.speaker} highlighted: "${s.text}"`;
  });
}

export function usePulse() {
  const [pulseSummary, setPulseSummary] = useState<string[]>([]);
  const [isPulseLoading, setIsPulseLoading] = useState(false);
  const [pulseTopics, setPulseTopics] = useState<string[]>([]);

  const generatePulse = useCallback((transcript: TranscriptEntry[]) => {
    setIsPulseLoading(true);

    // Run summarization asynchronously to not block UI
    requestAnimationFrame(() => {
      const finalEntries = transcript.filter(t => t.isFinal);
      const summary = summarize(finalEntries, 3);

      // Extract top topics
      const allText = finalEntries.map(e => e.text).join(' ');
      const tokens = tokenize(allText).filter(t => !STOP_WORDS.has(t));
      const freq = new Map<string, number>();
      for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);
      const topics = [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([word]) => word);

      setPulseSummary(summary);
      setPulseTopics(topics);
      setIsPulseLoading(false);
    });
  }, []);

  return { pulseSummary, isPulseLoading, pulseTopics, generatePulse };
}
