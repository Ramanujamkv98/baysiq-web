import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const hasKey = !!process.env.OPENAI_API_KEY;

  return NextResponse.json({
    hasOpenAIKey: hasKey,
    nodeEnv: process.env.NODE_ENV,
    envKeys: Object.keys(process.env).filter(k =>
      k.toLowerCase().includes("openai")
    )
  });
}
