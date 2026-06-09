"use server";

// app/actions/ai-actions.ts
// Next.js Server Actions for Hugging Face Serverless Inference API.
// These run server-side only, keeping the HUGGINGFACE_API_KEY hidden
// from students and tutors.

import { summarize, translate, assistant } from "../../lib/hf-api";
import { getServerEnv } from "../../lib/serverEnv";

// ---------------------------------------------------------------------------
// SUMMARIZE — facebook/bart-large-cnn
// ---------------------------------------------------------------------------

/**
 * Summarize meeting chat/transcript text.
 * Called from the client when a session ends.
 */
export async function summarizeAction(text: string): Promise<string> {
  const env = getServerEnv();
  return summarize(text, env.HUGGINGFACE_API_KEY);
}

// ---------------------------------------------------------------------------
// TRANSLATE — facebook/mbart-large-50-many-to-many-mmt
// ---------------------------------------------------------------------------

export type TranslateRequest = {
  text: string;
  sourceLang?: string;
  targetLang: string;
};

/**
 * Translate a single segment of text.
 * Used by CaptionsOverlay for real-time caption translation.
 */
export async function translateAction(req: TranslateRequest): Promise<string> {
  const env = getServerEnv();
  return translate(req.text, req.sourceLang ?? "en_XX", req.targetLang, env.HUGGINGFACE_API_KEY);
}

// ---------------------------------------------------------------------------
// ASSISTANT — TinyLlama/TinyLlama-1.1B-Chat-v1.0
// ---------------------------------------------------------------------------

/**
 * Generate a sidebar assistant response from a chat prompt.
 * The prompt should include conversation history for context.
 */
export async function assistantAction(prompt: string): Promise<string> {
  const env = getServerEnv();
  return assistant(prompt, env.HUGGINGFACE_API_KEY);
}