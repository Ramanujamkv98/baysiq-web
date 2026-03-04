import { NextResponse } from "next/server";
import { chatCompletion, hasOpenAiKey } from "@/lib/llm/client";
import {
  archetypesUserPrompt,
  ARCHETYPES_SYSTEM,
  parseArchetypesResponse,
} from "@/lib/llm/prompts";
import type { Archetype } from "@/lib/types";

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
    const patterns = body?.patterns as Archetype[] | undefined;
    if (!Array.isArray(patterns) || patterns.length === 0) {
      return NextResponse.json(
        { error: "Request body must include { patterns: Archetype[] }" },
        { status: 400 }
      );
    }

    const prompt = archetypesUserPrompt(patterns);
    const response = await chatCompletion({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: ARCHETYPES_SYSTEM },
        { role: "user", content: prompt },
      ],
      responseFormat: { type: "json_object" },
    });

    if ("error" in response) {
      return NextResponse.json({ error: response.error }, { status: 502 });
    }

    const parsed = parseArchetypesResponse(response.content);
    if (!parsed) {
      return NextResponse.json(
        { error: "LLM returned invalid JSON for archetypes" },
        { status: 502 }
      );
    }

    return NextResponse.json({ archetypes: parsed });
  } catch (e) {
    const message = e instanceof Error ? e.message : "LLM request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
