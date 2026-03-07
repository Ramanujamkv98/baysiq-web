import type { LlmSummaryResult, MicroSegment } from "../types";

type MicroSegmentLabel = {
  segment_name: string;
  insight: string;
  action: string;
};

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

  return `Generate one label + insight + action per segment.

Rules:
- insight <= 20 words
- action <= 15 words
- no metric calculations
- JSON only

Input:
${JSON.stringify(list, null, 2)}`;
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
  const normalizedTab = tab.trim().toLowerCase();

  const basePrompt = `Tab: ${tab}
Metrics summary:
${JSON.stringify(metrics, null, 2)}

Prioritize:
1) explain what the output means, not just what it is
2) trends and outliers
3) efficiency/profit implications
4) one practical next action`;

  const archetypesGuidance =
    normalizedTab === "archetypes"
      ? `

If tab is archetypes:
- explain top first-product affinities using the provided top rows
- explain top product combinations and define what "product combination" means using the provided definition
- discuss profit LTV using the top affinity rows rather than cohort-level averages`
      : "";

  return `${basePrompt}${archetypesGuidance}

Return JSON: {"bullets": ["...", ...], "recommendation": "..."}`;
}

export function parseMicroSegmentsResponse(content: string): MicroSegmentLabel[] | null {
  try {
    const raw = JSON.parse(content) as {
      segments?: Array<Partial<MicroSegmentLabel>>;
    };

    if (!Array.isArray(raw?.segments)) return null;

    return raw.segments.map((segment) => ({
      segment_name:
        typeof segment.segment_name === "string" && segment.segment_name.trim().length > 0
          ? segment.segment_name
          : "Micro Segment",
      insight: typeof segment.insight === "string" ? segment.insight : "",
      action: typeof segment.action === "string" ? segment.action : "",
    }));
  } catch {
    return null;
  }
}

export function parseSummaryResponse(content: string): LlmSummaryResult | null {
  try {
    const raw = JSON.parse(content) as {
      bullets?: unknown;
      recommendation?: unknown;
    };

    const bullets = Array.isArray(raw?.bullets)
      ? raw.bullets.map((bullet) => String(bullet))
      : [];

    const recommendation =
      typeof raw?.recommendation === "string" ? raw.recommendation : "";

    return { bullets, recommendation };
  } catch {
    return null;
  }
}
