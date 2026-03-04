import { NextResponse } from "next/server";
import { chatCompletion, hasOpenAiKey } from "@/lib/llm/client";
import {
  summaryUserPrompt,
  SUMMARY_SYSTEM,
  parseSummaryResponse,
} from "@/lib/llm/prompts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // Debug check to verify Amplify injected the key
  console.log("OPENAI KEY EXISTS:", !!process.env.OPENAI_API_KEY);

  if (!hasOpenAiKey()) {
    console.error("OpenAI API key missing in environment.");

    return NextResponse.json(
      {
        error:
          "Server misconfiguration: OpenAI API key is missing. Check Amplify environment variables.",
      },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();

    const tab = typeof body?.tab === "string" ? body.tab : null;
    const metrics =
      body?.metrics && typeof body.metrics === "object" ? body.metrics : {};

    if (!tab) {
      return NextResponse.json(
        {
          error: "Invalid request. Expected: { tab: string, metrics?: object }",
        },
        { status: 400 }
      );
    }

    const prompt = summaryUserPrompt(tab, metrics);

    const llmResponse = await chatCompletion({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SUMMARY_SYSTEM },
        { role: "user", content: prompt },
      ],
      responseFormat: { type: "json_object" },
    });

    if ("error" in llmResponse) {
      console.error("OpenAI request failed:", llmResponse.error);

      return NextResponse.json(
        { error: "LLM request failed. Check server logs." },
        { status: 502 }
      );
    }

    const parsed = parseSummaryResponse(llmResponse.content);

    if (!parsed) {
      console.error("Failed to parse LLM response:", llmResponse.content);

      return NextResponse.json(
        { error: "Invalid response format from LLM." },
        { status: 502 }
      );
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("Summary API error:", err);

    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
