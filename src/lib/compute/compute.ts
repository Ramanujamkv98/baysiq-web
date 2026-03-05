// src/lib/compute/compute.ts

/**
 * Minimal MVP compute module.
 * - Exports `compute` as a named export (fixes your build failure).
 * - Parses a CSV text payload.
 * - Computes per-order profit using provided costs.
 * - Produces a few summary metrics + top archetypes.
 *
 * NOTE: This file intentionally avoids importing app-specific types (OrderRow/Archetype)
 * to prevent build breaks if your types file doesn't export them.
 */

export type CostInputs = {
  cogsPct: number; // e.g. 0.35 for 35%
  shippingPerOrder: number; // e.g. 4.5
  paymentProcessingPct: number; // e.g. 0.029
  fixedTransactionFee: number; // e.g. 0.30
};

export type ComputeInput = {
  csvText: string;
  costs: CostInputs;
};

type OrderRow = {
  order_id: string;
  customer_id: string;
  order_date: string;
  product_id: string;
  product_name: string;
  gross_revenue: number;
  discount: number;
  refund: number;
  // computed:
  order_profit: number;
};

type Archetype = {
  key: string;
  items: string[];
  customers: number;
  profitLtv: number;
};

type ComputeOk = {
  ok: true;
  totals: {
    orders: number;
    customers: number;
    grossRevenue: number;
    discount: number;
    refund: number;
    profit: number;
  };
  archetypes: Archetype[];
};

type ComputeErr = { error: string };

function toOrderMonth(dateStr: string): string {
  const d = new Date(dateStr.trim());
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Very small CSV parser (handles quoted values + commas). */
function parseCsv(csvText: string): { headers: string[]; rows: Record<string, string>[] } | ComputeErr {
  const text = (csvText ?? "").trim();
  if (!text) return { error: "Empty CSV text" };

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { error: "CSV must include a header row + at least 1 data row" };

  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  if (headers.length === 0) return { error: "CSV header row is empty" };

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (cols[j] ?? "").trim();
    }
    rows.push(row);
  }

  return { headers, rows };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      // Handle escaped quotes ""
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }
  out.push(cur);
  return out;
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function computeOrderProfit(
  grossRevenue: number,
  discount: number,
  refund: number,
  costs: CostInputs
): number {
  const netRevenue = grossRevenue - discount - refund;

  const cogs = netRevenue * (num(costs.cogsPct) || 0);
  const shipping = num(costs.shippingPerOrder) || 0;
  const processing = netRevenue * (num(costs.paymentProcessingPct) || 0);
  const fixedFee = num(costs.fixedTransactionFee) || 0;

  return netRevenue - cogs - shipping - processing - fixedFee;
}

function computeArchetypes(orderRows: OrderRow[], customerFirstOrder: Map<string, string>): Archetype[] {
  // Convert cohort month (YYYY-MM) into a timestamp representing the 1st day of that month.
  // NOTE: Approximation if CSV has day-level first orders, but works for MVP.
  const firstOrderDateByCustomer = new Map<string, number>();
  for (const [cid, monthStr] of customerFirstOrder) {
    const [y, m] = monthStr.split("-").map(Number);
    if (!y || !m) continue;
    firstOrderDateByCustomer.set(cid, new Date(y, m - 1, 1).getTime());
  }

  // Group orders by customer
  const byCustomerOrder: Map<string, OrderRow[]> = new Map();
  for (const o of orderRows) {
    const list = byCustomerOrder.get(o.customer_id) ?? [];
    list.push(o);
    byCustomerOrder.set(o.customer_id, list);
  }

  // Customer total profit (for optional profitLtv per archetype)
  const customerProfitTotal = new Map<string, number>();
  for (const o of orderRows) {
    customerProfitTotal.set(
      o.customer_id,
      (customerProfitTotal.get(o.customer_id) ?? 0) + o.order_profit
    );
  }

  // pairKey -> { customers:Set, totalProfit:number }
  const pairCount = new Map<string, { customers: Set<string>; profit: number }>();

  for (const [cid, list] of byCustomerOrder) {
    const firstTs = firstOrderDateByCustomer.get(cid);
    if (firstTs == null) continue;

    const cutoff = firstTs + 30 * 24 * 60 * 60 * 1000;

    // Unique products purchased in first 30 days
    const productsInWindow = list
      .filter((o) => {
        const t = new Date(o.order_date).getTime();
        return Number.isFinite(t) && t >= firstTs && t <= cutoff;
      })
      .map((o) => (o.product_name?.trim() ? o.product_name.trim() : o.product_id))
      .filter(Boolean);

    const uniq = Array.from(new Set(productsInWindow));
    if (uniq.length < 2) continue;

    // Generate ALL pairs from the unique product set
    for (let i = 0; i < uniq.length; i++) {
      for (let j = i + 1; j < uniq.length; j++) {
        const a = uniq[i];
        const b = uniq[j];
        const key = [a, b].sort((x, y) => x.localeCompare(y)).join("|");

        const profit = customerProfitTotal.get(cid) ?? 0;
        const existing = pairCount.get(key);
        if (existing) {
          existing.customers.add(cid);
          existing.profit += profit;
        } else {
          pairCount.set(key, { customers: new Set([cid]), profit });
        }
      }
    }
  }

  const archetypeList: Archetype[] = [];
  for (const [key, { customers: set, profit: totalProfit }] of pairCount) {
    const items = key.split("|").filter(Boolean);
    if (items.length === 0) continue;

    archetypeList.push({
      key,
      items,
      customers: set.size,
      profitLtv: set.size > 0 ? totalProfit / set.size : 0,
    });
  }

  archetypeList.sort((a, b) => b.customers - a.customers);
  return archetypeList.slice(0, 5);
}

/**
 * Named export required by: import { compute } from "@/lib/compute/compute"
 */
export function compute(input: ComputeInput): ComputeOk | ComputeErr {
  const csvText = input?.csvText ?? "";
  const costs = input?.costs;

  if (!costs || typeof costs !== "object") {
    return { error: "Missing costs object" };
  }

  const parsed = parseCsv(csvText);
  if ("error" in parsed) return parsed;

  // These are the columns we can use. If your CSV uses different names, update here.
  // This keeps your pipeline from silently producing garbage.
  const required = ["order_id", "customer_id", "order_date", "product_id", "product_name", "gross_revenue", "discount", "refund"];
  for (const col of required) {
    if (!parsed.headers.includes(col)) {
      return { error: `Missing required column: ${col}` };
    }
  }

  const orders: OrderRow[] = parsed.rows.map((r) => {
    const gross = num(r["gross_revenue"]);
    const disc = num(r["discount"]);
    const ref = num(r["refund"]);
    const profit = computeOrderProfit(gross, disc, ref, costs);

    return {
      order_id: r["order_id"] ?? "",
      customer_id: r["customer_id"] ?? "",
      order_date: r["order_date"] ?? "",
      product_id: r["product_id"] ?? "",
      product_name: r["product_name"] ?? "",
      gross_revenue: gross,
      discount: disc,
      refund: ref,
      order_profit: profit,
    };
  });

  // first order month per customer
  const firstOrderMonth = new Map<string, string>();
  for (const o of orders) {
    if (!o.customer_id) continue;
    const month = toOrderMonth(o.order_date);
    if (!month) continue;

    const existing = firstOrderMonth.get(o.customer_id);
    if (!existing) {
      firstOrderMonth.set(o.customer_id, month);
    } else {
      // keep earliest month
      firstOrderMonth.set(o.customer_id, existing < month ? existing : month);
    }
  }

  const archetypes = computeArchetypes(orders, firstOrderMonth);

  const customersSet = new Set<string>();
  let grossRevenue = 0;
  let discount = 0;
  let refund = 0;
  let profit = 0;

  for (const o of orders) {
    if (o.customer_id) customersSet.add(o.customer_id);
    grossRevenue += o.gross_revenue;
    discount += o.discount;
    refund += o.refund;
    profit += o.order_profit;
  }

  return {
    ok: true,
    totals: {
      orders: orders.length,
      customers: customersSet.size,
      grossRevenue,
      discount,
      refund,
      profit,
    },
    archetypes,
  };
}
