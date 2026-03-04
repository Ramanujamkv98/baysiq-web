import type { Archetype } from "../types";
import type { LlmSummaryResult } from "../types";

export const ARCHETYPES_SYSTEM = `You are a data analyst. Given a list of product-purchase archetypes (each with items and metrics), return a JSON object with a single key "archetypes" which is an array of objects. Each object must have: "name" (short label, e.g. "Weekend Grillers"), "description" (one sentence), and "items" (array of product names, same order as input). Return only valid JSON, no markdown.`;

export function archetypesUserPrompt(patterns: Archetype[]): string {
  const list = patterns.map((p) => ({
    items: p.items,
    customers: p.customers,
    profitLtv: p.profitLtv,
  }));
  return `Label these archetypes with a name and description. Return JSON: {"archetypes": [{"name": "...", "description": "...", "items": [...]}, ...]}\n\nInput:\n${JSON.stringify(list, null, 2)}`;
}

export const SUMMARY_SYSTEM = `You are a data analyst. Given a tab name and key metrics, return a JSON object with two keys: "bullets" (array of 3-5 short insight bullets) and "recommendation" (one short recommendation sentence). Return only valid JSON, no markdown.`;

export function summaryUserPrompt(tab: string, metrics: Record<string, unknown>): string {
  return `Tab: ${tab}\nMetrics summary:\n${JSON.stringify(metrics, null, 2)}\n\nReturn JSON: {"bullets": ["...", ...], "recommendation": "..."}`;
}

export function parseArchetypesResponse(content: string): Array<{ name: string; description: string; items: string[] }> | null {
  try {
    const raw = JSON.parse(content) as { archetypes?: Array<{ name?: string; description?: string; items?: string[] }> };
    const list = raw?.archetypes;
    if (!Array.isArray(list)) return null;
    return list.map((a) => ({
      name: typeof a.name === "string" ? a.name : "Archetype",
      description: typeof a.description === "string" ? a.description : "",
      items: Array.isArray(a.items) ? a.items.map(String) : [],
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
