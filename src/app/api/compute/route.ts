import { NextResponse } from "next/server";
import { compute } from "@/lib/compute/compute";
import type { CostInputs } from "@/lib/types";

export const runtime = "nodejs";

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
    const costs = body?.costs && typeof body.costs === "object" ? body.costs : bodySchema.costs;

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
