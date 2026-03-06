import { NextRequest, NextResponse } from "next/server";
import { chatCompletion, hasOpenAiKey } from "@/lib/llm/client";
import {
  archetypesUserPrompt,
  ARCHETYPES_SYSTEM,
  parseArchetypesResponse,
} from "@/lib/llm/prompts";
import type { Archetype } from "@/lib/types";

export const runtime = "nodejs";

// --- Basic rate limiting (MVP) ---
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
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

// --- Input validation ---
function isArchetypeArray(value: unknown): value is Archetype[] {
  return Array.isArray(value) && value.length > 0;
}

type ArchetypeRequestBody = {
  patterns: Archetype[];
};

function validateBody(body: unknown): {
  ok: true;
  value: ArchetypeRequestBody;
} | {
  ok: false;
  error: string;
} {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body." };
  }

  const patterns = (body as any).patterns;

  if (!isArchetypeArray(patterns)) {
    return {
      ok: false,
      error: "Request body must include { patterns: Archetype[] }.",
    };
  }

  return {
    ok: true,
    value: { patterns },
  };
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rate = checkRateLimit(`archetypes:${ip}`);

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
    if (process.env.NODE_ENV !== "production") {
      console.error("OPENAI_API_KEY missing.");
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
      return NextResponse.json(
        { error: validated.error },
        { status: 400 }
      );
    }

    const { patterns } = validated.value;

    const prompt = archetypesUserPrompt(patterns);

    const response = await chatCompletion({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: ARCHETYPES_SYSTEM },
        { role: "user", content: prompt },
      ],
      responseFormat: { type: "json_object" },
      temperature: 0.2,
    });

    if ("error" in response) {
      if (process.env.NODE_ENV !== "production") {
        console.error("OpenAI request failed:", response.error);
      }

      return NextResponse.json(
        { error: "LLM request failed." },
        { status: 502 }
      );
    }

    const parsed = parseArchetypesResponse(response.content);

    if (!parsed) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Invalid archetype response:", response.content);
      }

      return NextResponse.json(
        { error: "Invalid response format from LLM." },
        { status: 502 }
      );
    }

    return NextResponse.json({ archetypes: parsed }, { status: 200 });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Archetypes API error:", err);
    }

    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

// Explicitly block GET requests
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed." },
    { status: 405 }
  );
}
