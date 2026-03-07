import type { LlmSummaryResult, MicroSegment } from "../types";

export const MICRO_SEGMENTS_SYSTEM = `You are a data analyst for e-commerce growth teams.
Use only the provided input data; do not compute metrics.
Return a JSON object with key "segments" as an array.
Each object must include:
- "segment_name": short segment label
- "insight": max 20 words
- "action": max 15 words
Return valid JSON only.`;

export function microSegmentsUserPrompt(segments: MicroSegment[]): string {
  const list = segments.map((segment) => ({
    customers: segment.customers,
    profit_ltv: segment.profit_ltv,
    avg_cac: segment.avg_cac,
    ltv_cac_ratio: segment.ltv_cac_ratio,
    key_products: segment.key_products,
  }));

  return `Generate one label + insight + action per segment.\nRules:\n- insight <= 20 words\n- action <= 15 words\n- no metric calculations\n- JSON only\n\nInput:\n${JSON.stringify(list, null, 2)}`;
}

export const SUMMARY_SYSTEM = `You are a senior e-commerce data analyst.
Use only the provided metrics and avoid speculation.
Given a tab name and key metrics, return a JSON object with two keys:
- "bullets": array of 3-5 insight bullets
- "recommendation": one concise action-oriented recommendation sentence

Rules for bullets:
- Write explanatory bullets, not just restated values.
- Include what each important metric implies for profitability or growth when possible.
- If relevant definitions are provided in metrics (for example, productCombinationDefinition), explicitly use them in plain language.
- Prefer concrete entities from the input (product names, channels, top rows) over generic statements.
- If a metric is missing, skip it instead of guessing.

Return only valid JSON, no markdown.`;

export function summaryUserPrompt(tab: string, metrics: Record<string, unknown>): string {
  return `Tab: ${tab}
Metrics summary:
${JSON.stringify(metrics, null, 2)}

Prioritize:
1) explain what the output means, not just what it is
2) trends and outliers
3) efficiency/profit implications
4) one practical next action

If tab is archetypes:
- explain top first-product affinities using the provided top rows
- explain top product combinations and define what "product combination" means using the provided definition
- discuss profit LTV using the top affinity rows rather than cohort-level averages

Return JSON: {"bullets": ["...", ...], "recommendation": "..."}`;
}

export function parseMicroSegmentsResponse(
  content: string
): Array<{ segment_name: string; insight: string; action: string }> | null {
  try {
    const raw = JSON.parse(content) as {
      segments?: Array<{ segment_name?: string; insight?: string; action?: string }>;
    };
    const list = raw?.segments;
    if (!Array.isArray(list)) return null;

    return list.map((a) => ({
      segment_name: typeof a.segment_name === "string" ? a.segment_name : "Micro Segment",
      insight: typeof a.insight === "string" ? a.insight : "",
      action: typeof a.action === "string" ? a.action : "",
    }));
  } catch {
    return null;
  }
}

export function parseSummaryResponse(content: string): LlmSummaryResult | null {
  try {
    const raw = JSON.parse(content) as { bullets?: string[]; recommendation?: string };
    const bullets = Array.isArray(raw?.bullets) ? raw.bullets.map(String) : [];
    const recommendation = typeof raw?.recommendation === "string" ? raw.recommendation : "";
    return { bullets, recommendation };
  } catch {
    return null;
  }
}
