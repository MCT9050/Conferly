"use server";

// app/actions/ai-actions.ts
// Next.js Server Actions for Hugging Face Serverless Inference API.
// These run server-side only, keeping the HUGGINGFACE_API_KEY hidden
// from students and tutors.
//
// Includes rate-limit gating and circuit breaker via system-guard.ts.
// When the AI is in COOLDOWN, the action returns immediately without
// calling Hugging Face, preserving quota and preventing further load.

import { summarize, translate, assistant } from "../../lib/hf-api";
import { getServerEnv } from "../../lib/serverEnv";
import { checkRateLimit, recordHfResponse } from "../../lib/system-guard";

// ---------------------------------------------------------------------------
// Response union type — all AI actions return this shape
// ---------------------------------------------------------------------------

export type AIActionResponse<T> =
  | { status: 'OK'; data: T }
  | { status: 'COOLDOWN'; retryAfter: number }
  | { status: 'ERROR'; error: string };

// ---------------------------------------------------------------------------
// Internal helper — wraps a HF call with guard checks
// ---------------------------------------------------------------------------

async function guardedCall<T>(
  hfCall: () => Promise<T>,
  roomId?: string,
): Promise<AIActionResponse<T>> {
  // 1. Check rate limit + circuit breaker
  const guard = checkRateLimit(roomId);
  if (!guard.allowed) {
    return { status: 'COOLDOWN', retryAfter: guard.retryAfter ?? 30 };
  }

  // 2. Execute the HF call
  try {
    const data = await hfCall();
    recordHfResponse(200); // Success — reset circuit breaker
    return { status: 'OK', data };
  } catch (err: unknown) {
    const hfErr = err as { status?: number; message?: string };
    const status = hfErr.status ?? 0;

    // 3. Record 429/503 to drive circuit breaker
    if (status === 429 || status === 503) {
      recordHfResponse(status);
      return { status: 'COOLDOWN', retryAfter: 30 };
    }

    // 4. Other errors — return as ERROR (don't affect circuit breaker)
    return {
      status: 'ERROR',
      error: hfErr.message ?? 'Unknown AI service error',
    };
  }
}

// ---------------------------------------------------------------------------
// SUMMARIZE — facebook/bart-large-cnn
// ---------------------------------------------------------------------------

/**
 * Summarize meeting chat/transcript text.
 * Called from the client when a session ends.
 */
export async function summarizeAction(
  text: string,
  roomId?: string,
): Promise<AIActionResponse<string>> {
  const env = getServerEnv();

  return guardedCall(
    () => summarize(text, env.HUGGINGFACE_API_KEY),
    roomId,
  );
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
export async function translateAction(
  req: TranslateRequest,
  roomId?: string,
): Promise<AIActionResponse<string>> {
  const env = getServerEnv();

  return guardedCall(
    () => translate(
      req.text,
      req.sourceLang ?? "en_XX",
      req.targetLang,
      env.HUGGINGFACE_API_KEY,
    ),
    roomId,
  );
}

// ---------------------------------------------------------------------------
// ASSISTANT — TinyLlama/TinyLlama-1.1B-Chat-v1.0
// ---------------------------------------------------------------------------

/**
 * Generate a sidebar assistant response from a chat prompt.
 * The prompt should include conversation history for context.
 */
export async function assistantAction(
  prompt: string,
  roomId?: string,
): Promise<AIActionResponse<string>> {
  const env = getServerEnv();

  return guardedCall(
    () => assistant(prompt, env.HUGGINGFACE_API_KEY),
    roomId,
  );
}