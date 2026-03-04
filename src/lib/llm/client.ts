/**
 * Thin OpenAI client for server-side LLM calls.
 * Reads OPENAI_API_KEY from env; do not expose to client.
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export function hasOpenAiKey(): boolean {
  return Boolean(OPENAI_API_KEY && OPENAI_API_KEY.trim().length > 0);
}

export function getOpenAiKey(): string | null {
  return OPENAI_API_KEY?.trim() ?? null;
}

export async function chatCompletion(params: {
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  responseFormat?: { type: "json_object" };
}): Promise<{ content: string } | { error: string }> {
  const key = getOpenAiKey();
  if (!key) {
    return {
      error:
        "OPENAI_API_KEY is not set. Add it in Amplify environment variables or in .env.local for local development.",
    };
  }

  const body: Record<string, unknown> = {
    model: params.model,
    messages: params.messages,
  };
  if (params.responseFormat) {
    body.response_format = params.responseFormat;
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    return { error: `OpenAI API error (${res.status}): ${text.slice(0, 500)}` };
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (content == null) {
    return { error: "Empty response from OpenAI" };
  }
  return { content };
}
