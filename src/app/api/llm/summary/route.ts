import { NextRequest, NextResponse } from "next/server";
import { chatCompletion, hasOpenAiKey } from "@/lib/llm/client";
import {
  summaryUserPrompt,
  SUMMARY_SYSTEM,
  parseSummaryResponse,
} from "@/lib/llm/prompts";

export const runtime = "nodejs";

const ALLOWED_TABS = new Set(["cohorts", "archetypes", "ltv"]);

// Basic in-memory rate limiter for MVP.
// Note: on serverless platforms this is best-effort only.
// For stronger protection later, move this to Redis / Upstash.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 12;

const requestStore = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  return "unknown";
}

function checkRateLimit(
  key: string
): { allowed: true } | { allowed: false; retryAfter: number } {
  const now = Date.now();
  const current = requestStore.get(key);

  if (!current || now > current.resetAt) {
    requestStore.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return { allowed: true };
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  requestStore.set(key, current);
  return { allowed: true };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type SummaryRequestBody = {
  tab: string;
  metrics: Record<string, unknown>;
};

function validateBody(body: unknown):
  | { ok: true; value: SummaryRequestBody }
  | { ok: false; error: string } {
  if (!isPlainObject(body)) {
    return {
      ok: false,
      error: "Invalid request body. Expected a JSON object.",
    };
  }

  const tab = body.tab;
  const metrics = body.metrics;

  if (typeof tab !== "string" || !ALLOWED_TABS.has(tab)) {
    return {
      ok: false,
      error: "Invalid tab. Expected one of: cohorts, archetypes, ltv.",
    };
  }

  if (metrics !== undefined && !isPlainObject(metrics)) {
    return {
      ok: false,
      error: "Invalid metrics. Expected an object if provided.",
    };
  }

  return {
    ok: true,
    value: {
      tab,
      metrics: isPlainObject(metrics) ? metrics : {},
    },
  };
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`summary:${ip}`);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfter),
        },
      }
    );
  }

  if (!hasOpenAiKey()) {
    if (process.env.NODE_ENV !== "production") {
      console.error("OpenAI API key missing in environment.");
    }

    return NextResponse.json(
      { error: "Server misconfiguration." },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const validated = validateBody(body);

    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const { tab, metrics } = validated.value;
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
      if (process.env.NODE_ENV !== "production") {
        console.error("OpenAI request failed:", llmResponse.error);
      }

      return NextResponse.json({ error: "LLM request failed." }, { status: 502 });
    }

    const parsed = parseSummaryResponse(llmResponse.content);

    if (!parsed) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Failed to parse LLM response:", llmResponse.content);
      }

      return NextResponse.json(
        { error: "Invalid response format from LLM." },
        { status: 502 }
      );
    }

    return NextResponse.json(parsed, { status: 200 });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Summary API error:", err);
    }

    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
