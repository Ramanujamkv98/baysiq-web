import { z } from "zod";
import { REQUIRED_CSV_COLUMNS } from "../types";

const normalizedColumns = REQUIRED_CSV_COLUMNS.map((c) => c.toLowerCase().trim());

/** Normalize header: lowercase + trim */
function normalizeHeader(h: string): string {
  return h.toLowerCase().trim();
}

const numSchema = z
  .union([z.string().transform((s) => parseFloat(s)), z.number()])
  .refine((n) => !Number.isNaN(n), "Must be a number");

export function validateCsvHeaders(headers: string[]):
  | {
      success: true;
      normalizedToOriginal: Record<string, string>;
    }
  | {
      success: false;
      error: string;
    } {
  const normalizedToOriginal: Record<string, string> = {};
  const seen = new Set<string>();

  for (const h of headers) {
    const n = normalizeHeader(h);
    if (n && !seen.has(n)) {
      seen.add(n);
      normalizedToOriginal[n] = h;
    }
  }

  const missing: string[] = [];
  for (const col of normalizedColumns) {
    if (!(col in normalizedToOriginal)) {
      missing.push(col);
    }
  }

  if (missing.length > 0) {
    return {
      success: false,
      error: `Missing required columns: ${missing.join(", ")}. Required: ${REQUIRED_CSV_COLUMNS.join(", ")}.`,
    };
  }

  return { success: true, normalizedToOriginal };
}

/** Parse a single row into a record with normalized keys; validate numeric fields with zod */
export function parseRow(
  row: Record<string, string>,
  normalizedToOriginal: Record<string, string>
): { ok: true; row: Record<string, string | number> } | { ok: false; error: string } {
  const out: Record<string, string | number> = {};
  const numericKeys = ["gross_revenue", "discount", "refund"];

  for (const col of REQUIRED_CSV_COLUMNS) {
    const raw = row[normalizedToOriginal[col] ?? col] ?? row[col] ?? "";
    const value = (typeof raw === "string" ? raw.trim() : String(raw)) || "";

    if (numericKeys.includes(col)) {
      const parsed = numSchema.safeParse(value === "" ? "0" : value);
      if (!parsed.success) {
        return { ok: false, error: parsed.error.message };
      }
      out[col] = parsed.data;
    } else {
      out[col] = value;
    }
  }

  return { ok: true, row: out };
}

export const costInputsSchema = z.object({
  cogsPct: z.number().min(0).max(100),
  shippingPerOrder: z.number().min(0),
  paymentProcessingPct: z.number().min(0).max(100),
  fixedTransactionFee: z.number().min(0),

  defaultRefundRatePct: z.number().min(0).max(100).optional().default(0),

  cacBySource: z.record(z.string(), z.number().min(0)).optional().default({}),
});

export type CostInputsValidated = z.infer<typeof costInputsSchema>;
