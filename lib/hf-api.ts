// lib/hf-api.ts
// Hugging Face Serverless Inference API — native fetch, no external dependencies.
// Keeps the PWA bundle tiny by avoiding @huggingface/inference.

const HF_API_BASE = "https://api-inference.huggingface.co/models";

/**
 * Supported inference intents mapped to Hugging Face model IDs.
 */
export const HF_MODELS = {
  SUMMARIZE: "facebook/bart-large-cnn",
  TRANSLATE: "facebook/mbart-large-50-many-to-many-mmt",
  ASSISTANT: "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
} as const;

export type HFIntent = keyof typeof HF_MODELS;

export type HFRequestOptions = {
  /** Model ID override — defaults to the model mapped to the intent */
  model?: string;
  /** Additional parameters passed in the JSON body (temperature, max_length, etc.) */
  params?: Record<string, unknown>;
};

export type HFErrorResponse = {
  error: string;
  estimated_time?: number;
};

/**
 * Call a Hugging Face Serverless Inference endpoint using native fetch.
 *
 * @param intent  The intent key (SUMMARIZE | TRANSLATE | ASSISTANT).
 * @param inputs  The text input(s) to send. For most models this is a string;
 *                translation models require an object with `inputs` and `args`.
 * @param opts    Optional model override and extra params.
 * @param apiKey  The Hugging Face API key. When called from a Server Action
 *                this is read from the server environment. The `apiKey`
 *                parameter exists for testability but should NOT be passed
 *                from client code.
 */
export async function callHF<TOutput = unknown>(
  intent: HFIntent,
  inputs: string | Record<string, unknown>,
  opts?: HFRequestOptions,
  apiKey?: string,
): Promise<TOutput> {
  const model = opts?.model ?? HF_MODELS[intent];
  const url = `${HF_API_BASE}/${model}`;

  const key =
    apiKey ??
    (typeof process !== "undefined" ? process.env.HUGGINGFACE_API_KEY : undefined);

  if (!key) {
    throw new Error(
      "HUGGINGFACE_API_KEY is not configured. Set it in your environment variables.",
    );
  }

  const body: Record<string, unknown> = { inputs };
  if (opts?.params) {
    body.parameters = opts.params;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as HFErrorResponse | null;
    const message = errorBody?.error ?? `Hugging Face API error (${response.status})`;
    const err = new Error(message) as Error & { status: number; estimatedTime?: number };
    err.status = response.status;
    if (errorBody?.estimated_time) {
      err.estimatedTime = errorBody.estimated_time;
    }
    throw err;
  }

  return response.json() as Promise<TOutput>;
}

// ---------------------------------------------------------------------------
// Typed convenience wrappers
// ---------------------------------------------------------------------------

export type SummarizeOutput = {
  summary_text: string;
}[];

/**
 * Summarize text using facebook/bart-large-cnn.
 */
export async function summarize(
  text: string,
  apiKey?: string,
): Promise<string> {
  const result = await callHF<SummarizeOutput>(
    "SUMMARIZE",
    text,
    { params: { max_length: 150, min_length: 40 } },
    apiKey,
  );
  return result[0]?.summary_text ?? "";
}

export type TranslateOutput = {
  translation_text: string;
}[];

/**
 * Translate text using facebook/mbart-large-50-many-to-many-mmt.
 * Pass `srcLang` and `tgtLang` as ISO codes understood by mBART
 * (e.g. "en_XX", "zu_ZA", "af_ZA", "xh_ZA").
 */
export async function translate(
  text: string,
  srcLang = "en_XX",
  tgtLang = "zu_ZA",
  apiKey?: string,
): Promise<string> {
  const result = await callHF<TranslateOutput>(
    "TRANSLATE",
    text,
    {
      params: { src_lang: srcLang, tgt_lang: tgtLang },
    },
    apiKey,
  );
  return result[0]?.translation_text ?? "";
}

export type AssistantOutput = {
  generated_text: string;
}[];

/**
 * Generate a chat-style response using TinyLlama/TinyLlama-1.1B-Chat-v1.0.
 * The `prompt` should follow the model's expected chat template format.
 */
export async function assistant(
  prompt: string,
  apiKey?: string,
): Promise<string> {
  const result = await callHF<AssistantOutput>(
    "ASSISTANT",
    prompt,
    {
      params: {
        max_new_tokens: 256,
        temperature: 0.7,
        top_p: 0.95,
        do_sample: true,
      },
    },
    apiKey,
  );
  return result[0]?.generated_text?.replace(prompt, "").trim() ?? "";
}