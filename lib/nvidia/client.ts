/**
 * NVIDIA NIM client (OpenAI-compatible endpoint)
 *
 * Model: meta/llama-3.3-70b-instruct
 *   - Meta Llama 3.3 70B — latest and most capable 70B instruction model
 *   - Excellent at JSON output, reasoning, and creative writing
 *   - Ideal for profile analysis, compatibility scoring, and story generation
 */
import OpenAI from "openai";

export const NIM_MODEL = "meta/llama-3.3-70b-instruct";

export const nim = new OpenAI({
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey: process.env.NVIDIA_NIM_API_KEY!,
});

/**
 * Helper: chat completion that always returns the assistant text.
 * Strips markdown code fences so callers can JSON.parse directly.
 */
export async function nimChat(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 1024
): Promise<string> {
  const completion = await nim.chat.completions.create({
    model: NIM_MODEL,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  // Strip ```json ... ``` or ``` ... ``` fences
  return raw.replace(/```(?:json)?\n?/g, "").trim();
}
