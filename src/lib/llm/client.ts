import "server-only";

export function getOpenAiKey(): string | null {
  const key = process.env.OPENAI_API_KEY;

  if (!key) {
    console.error("OPENAI_API_KEY missing from runtime environment");
    return null;
  }

  return key.trim();
}

export function hasOpenAiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function chatCompletion(params: {
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  responseFormat?: { type: "json_object" };
  temperature?: number;
}): Promise<{ content: string } | { error: string }> {

  const key = getOpenAiKey();

  if (!key) {
    return {
      error: "OPENAI_API_KEY missing from runtime",
    };
  }

  const body: Record<string, unknown> = {
    model: params.model,
    messages: params.messages,
  };

  if (params.responseFormat) {
    body.response_format = params.responseFormat;
  }

    if (typeof params.temperature === "number") {
    body.temperature = params.temperature;
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
    return { error: `OpenAI API error (${res.status}): ${text}` };
  }

  const data = await res.json();

  const content =
    data?.choices?.[0]?.message?.content?.trim();

  if (!content) {
    return { error: "Empty response from OpenAI" };
  }

  return { content };
}
