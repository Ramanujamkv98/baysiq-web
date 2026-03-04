import { NextResponse } from "next/server";
import { chatCompletion, hasOpenAiKey } from "@/lib/llm/client";
import {
  summaryUserPrompt,
  SUMMARY_SYSTEM,
  parseSummaryResponse,
} from "@/lib/llm/prompts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!hasOpenAiKey()) {
    return NextResponse.json(
      {
        error:
          "OPENAI_API_KEY is not set. Add it in Amplify environment variables or in .env.local for local development.",
      },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const tab = typeof body?.tab === "string" ? body.tab : "";
    const metrics = body?.metrics && typeof body.metrics === "object" ? body.metrics : {};

    if (!tab) {
      return NextResponse.json(
        { error: "Request body must include { tab: string, metrics?: object }" },
        { status: 400 }
      );
    }

    const prompt = summaryUserPrompt(tab, metrics);
    const response = await chatCompletion({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SUMMARY_SYSTEM },
        { role: "user", content: prompt },
      ],
      responseFormat: { type: "json_object" },
    });

    if ("error" in response) {
      return NextResponse.json({ error: response.error }, { status: 502 });
    }

    const parsed = parseSummaryResponse(response.content);
    if (!parsed) {
      return NextResponse.json(
        { error: "LLM returned invalid JSON for summary" },
        { status: 502 }
      );
    }

    return NextResponse.json(parsed);
  } catch (e) {
    const message = e instanceof Error ? e.message : "LLM request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
