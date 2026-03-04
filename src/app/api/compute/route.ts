import { NextResponse } from "next/server";
import { compute } from "@/lib/compute/compute";
import type { CostInputs } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Temporary diagnostic endpoint
 * Allows us to check if Amplify runtime can see OPENAI_API_KEY
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    openaiEnvKeys: Object.keys(process.env).filter((k) =>
      k.toLowerCase().includes("openai")
    ),
    nodeEnv: process.env.NODE_ENV,
  });
}

const bodySchema = {
  csvText: "",
  costs: {
    cogsPct: 0,
    shippingPerOrder: 0,
    paymentProcessingPct: 0,
    fixedTransactionFee: 0,
  } as CostInputs,
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const csvText = typeof body?.csvText === "string" ? body.csvText : "";
    const costs =
      body?.costs && typeof body.costs === "object"
        ? body.costs
        : bodySchema.costs;

    const result = compute({ csvText, costs });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Compute failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
