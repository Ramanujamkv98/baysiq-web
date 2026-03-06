import { NextRequest, NextResponse } from "next/server";
import { chatCompletion, hasOpenAiKey } from "@/lib/llm/client";
import {
  microSegmentsUserPrompt,
  MICRO_SEGMENTS_SYSTEM,
  parseMicroSegmentsResponse,
} from "@/lib/llm/prompts";
import type { MicroSegment } from "@/lib/types";

export const runtime = "nodejs";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 12;

const requestStore = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";

  const real = req.headers.get("x-real-ip");
  if (real) return real;

  return "unknown";
}

function checkRateLimit(
  key: string
): { allowed: true } | { allowed: false; retryAfter: number } {
  const now = Date.now();
  const existing = requestStore.get(key);

  if (!existing || now > existing.resetAt) {
    requestStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  requestStore.set(key, existing);
  return { allowed: true };
}

function isMicroSegmentArray(value: unknown): value is MicroSegment[] {
  return Array.isArray(value) && value.length > 0;
}

type SegmentRequestBody = {
  segments: MicroSegment[];
};

function validateBody(body: unknown):
  | {
      ok: true;
      value: SegmentRequestBody;
    }
  | {
      ok: false;
      error: string;
    } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body." };
  }

  const maybeBody = body as { segments?: unknown };
  const segments = maybeBody.segments;

  if (!isMicroSegmentArray(segments)) {
    return {
      ok: false,
      error: "Request body must include { segments: MicroSegment[] }.",
    };
  }

  return {
    ok: true,
    value: { segments },
  };
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rate = checkRateLimit(`segments:${ip}`);

  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfter) },
      }
    );
  }

  if (!hasOpenAiKey()) {
    return NextResponse.json({ error: "Server misconfiguration." }, { status: 500 });
  }

  try {
    const body = await request.json();
    const validated = validateBody(body);

    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const prompt = microSegmentsUserPrompt(validated.value.segments);

    const response = await chatCompletion({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: MICRO_SEGMENTS_SYSTEM },
        { role: "user", content: prompt },
      ],
      responseFormat: { type: "json_object" },
      temperature: 0.2,
    });

    if ("error" in response) {
      return NextResponse.json({ error: "LLM request failed." }, { status: 502 });
    }

    const parsed = parseMicroSegmentsResponse(response.content);

    if (!parsed) {
      return NextResponse.json({ error: "Invalid response format from LLM." }, { status: 502 });
    }

    return NextResponse.json({ segments: parsed }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
