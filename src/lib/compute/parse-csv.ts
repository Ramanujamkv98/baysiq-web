import Papa from "papaparse";
import type { CsvRow } from "../types";
import { validateCsvHeaders, parseRow } from "./validate-csv";

export type ParseCsvResult =
  | { success: true; rows: Record<string, string | number>[]; headers: string[] }
  | { success: false; error: string };

/**
 * Parse CSV text into rows with normalized headers.
 * Validates required columns (case-insensitive, trimmed).
 */
export function parseCsv(csvText: string): ParseCsvResult {
  const trimmed = csvText.trim();
  if (!trimmed) {
    return { success: false, error: "CSV content is empty." };
  }

  const parsed = Papa.parse<Record<string, string>>(trimmed, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length > 0) {
    const first = parsed.errors[0];
    return {
      success: false,
      error: `CSV parse error: ${first.message} (row ${first.row}).`,
    };
  }

  const rows = parsed.data as CsvRow[];
  const headers = parsed.meta.fields ?? (rows[0] ? Object.keys(rows[0]) : []);

  const headerResult = validateCsvHeaders(headers);
  if (!headerResult.success) {
    return { success: false, error: headerResult.error };
  }

  const normalizedToOriginal: Record<string, string> = {};
  for (const h of headers) {
    const n = h.toLowerCase().trim();
    normalizedToOriginal[n] = h;
  }

  const out: Record<string, string | number>[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const parsedRow = parseRow(row as Record<string, string>, normalizedToOriginal);
    if (!parsedRow.ok) {
      return {
        success: false,
        error: `Row ${i + 2}: ${parsedRow.error}.`,
      };
    }
    out.push(parsedRow.row);
  }

  return {
    success: true,
    rows: out,
    headers,
  };
}
