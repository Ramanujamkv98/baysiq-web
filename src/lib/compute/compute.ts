import type {
  CostInputs,
  OrderRow,
  ComputeResult,
  CohortRetentionCell,
  CohortProfitLtvRow,
  Archetype,
} from "../types";
import { parseCsv } from "./parse-csv";
import { costInputsSchema } from "./validate-csv";

function toOrderMonth(dateStr: string): string {
  const trimmed = dateStr.trim();
  if (!trimmed) return "";
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthIndex(from: string, to: string): number {
  if (!from || !to) return 0;
  const [fyStr, fmStr] = from.split("-");
  const [tyStr, tmStr] = to.split("-");
  const fy = Number(fyStr);
  const fm = Number(fmStr);
  const ty = Number(tyStr);
  const tm = Number(tmStr);
  if (
    !Number.isFinite(fy) ||
    !Number.isFinite(fm) ||
    !Number.isFinite(ty) ||
    !Number.isFinite(tm)
  ) {
    return 0;
  }
  return (ty - fy) * 12 + (tm - fm);
}

export type ComputeInput = {
  csvText: string;
  costs: CostInputs;
};

export function compute(input: ComputeInput): ComputeResult | { error: string } {
  const parseResult = parseCsv(input.csvText);
  if (!parseResult.success) {
    return { error: parseResult.error };
  }

  const costParse = costInputsSchema.safeParse(input.costs);
  if (!costParse.success) {
    return { error: "Invalid cost inputs: " + costParse.error.message };
  }

  const costs = costParse.data;
  const rows = parseResult.rows as Array<Record<string, string | number>>;

  const cogsMult = costs.cogsPct / 100;
  const processingMult = costs.paymentProcessingPct / 100;

  const customerFirstOrder: Map<string, string> = new Map();
  for (const r of rows) {
    const cid = String(r.customer_id ?? "").trim();
    const od = String(r.order_date ?? "").trim();
    if (!cid || !od) continue;
    const om = toOrderMonth(od);
    if (!om) continue;
    const existing = customerFirstOrder.get(cid);
    if (!existing || om < existing) {
      customerFirstOrder.set(cid, om);
    }
  }

  const orderRows: OrderRow[] = [];
  for (const r of rows) {
    const customer_id = String(r.customer_id ?? "").trim();
    const order_date = String(r.order_date ?? "").trim();
    const order_month = toOrderMonth(order_date);
    if (!customer_id || !order_month) {
      // Skip malformed or incomplete rows for cohort/archetype logic
      continue;
    }

    const gross = Number(r.gross_revenue) || 0;
    const discount = Number(r.discount) || 0;
    const refund = Number(r.refund) || 0;
    const net_revenue = gross - discount - refund;
    const order_profit =
      net_revenue -
      cogsMult * net_revenue -
      costs.shippingPerOrder -
      processingMult * net_revenue -
      costs.fixedTransactionFee;

    const cohort_month = customerFirstOrder.get(customer_id) ?? order_month;
    const month_index = monthIndex(cohort_month, order_month);

    orderRows.push({
      order_id: String(r.order_id ?? ""),
      customer_id,
      order_date,
      product_id: String(r.product_id ?? ""),
      product_name: String(r.product_name ?? ""),
      gross_revenue: gross,
      discount,
      refund,
      utm_source: String(r.utm_source ?? ""),
      country: String(r.country ?? ""),
      net_revenue,
      order_profit,
      order_month,
      cohort_month,
      month_index,
    });
  }

  const customers = new Set(orderRows.map((o) => o.customer_id)).size;
  const orders = orderRows.length;
  const revenue = orderRows.reduce((s, o) => s + o.net_revenue, 0);
  const profit = orderRows.reduce((s, o) => s + o.order_profit, 0);

  const customersWithRepeat = new Set(
    orderRows
      .filter((_, i, arr) =>
        arr.some(
          (x, j) =>
            j !== i && x.customer_id === _.customer_id && x.order_id !== _.order_id
        )
      )
      .map((o) => o.customer_id)
  ).size;
  const repeatPurchaseRate =
    customers > 0 ? (customersWithRepeat / customers) * 100 : 0;

  const cohortSizes = new Map<string, number>();
  for (const [cid, cm] of customerFirstOrder) {
    if (cm) cohortSizes.set(cm, (cohortSizes.get(cm) ?? 0) + 1);
  }

  const retentionMap = new Map<string, Map<number, Set<string>>>();
  for (const o of orderRows) {
    if (!o.cohort_month) continue;
    let byIndex = retentionMap.get(o.cohort_month);
    if (!byIndex) {
      byIndex = new Map();
      retentionMap.set(o.cohort_month, byIndex);
    }
    let set = byIndex.get(o.month_index);
    if (!set) {
      set = new Set();
      byIndex.set(o.month_index, set);
    }
    set.add(o.customer_id);
  }

  const cohortRetention: CohortRetentionCell[] = [];
  const maxMonthIndex =
    orderRows.length > 0
      ? Math.max(0, ...orderRows.map((o) => o.month_index))
      : 0;
  for (const [cohortMonth, byIndex] of retentionMap) {
    const cohortSize = cohortSizes.get(cohortMonth) ?? 0;
    if (cohortSize === 0) continue;
    for (let mi = 0; mi <= maxMonthIndex; mi++) {
      const active = byIndex.get(mi)?.size ?? 0;
      cohortRetention.push({
        cohortMonth,
        monthIndex: mi,
        retentionPct: (active / cohortSize) * 100,
        activeCustomers: active,
        cohortSize,
      });
    }
  }

  const profitByCohort = new Map<string, number>();
  for (const o of orderRows) {
    profitByCohort.set(
      o.cohort_month,
      (profitByCohort.get(o.cohort_month) ?? 0) + o.order_profit
    );
  }

  const cohortProfitLtv: CohortProfitLtvRow[] = [];
  for (const [cohortMonth, totalProfit] of profitByCohort) {
    const size = cohortSizes.get(cohortMonth) ?? 0;
    cohortProfitLtv.push({
      cohortMonth,
      cohortSize: size,
      profitLtv: size > 0 ? totalProfit / size : 0,
    });
  }
  cohortProfitLtv.sort((a, b) => a.cohortMonth.localeCompare(b.cohortMonth));

  const profitLtvByCohort = cohortProfitLtv.map((r) => ({
    cohortMonth: r.cohortMonth,
    profitLtv: r.profitLtv,
  }));

  const rawArchetypes = computeArchetypes(orderRows, customerFirstOrder);

  // Defensive: ensure archetypes array never contains undefined or malformed entries.
  const archetypes: Archetype[] = rawArchetypes
    .filter(
      (a): a is Archetype =>
        Boolean(a) &&
        typeof a.customers === "number" &&
        Array.isArray(a.items)
    )
    .map((a) => ({
      items: a.items ?? [],
      customers: Number.isFinite(a.customers) ? a.customers : 0,
      profitLtv: Number.isFinite(a.profitLtv) ? a.profitLtv : 0,
      name: a.name,
      description: a.description,
    }));

  return {
    kpis: {
      customers,
      orders,
      revenue,
      profit,
      repeatPurchaseRate,
    },
    cohortRetention,
    cohortProfitLtv,
    archetypes,
    profitLtvByCohort,
  };
}

function computeArchetypes(
  orderRows: OrderRow[],
  customerFirstOrder: Map<string, string>
): Archetype[] {
  const firstOrderDateByCustomer = new Map<string, number>();
  for (const [cid, monthStr] of customerFirstOrder) {
    if (!monthStr) continue;
    const [yStr, mStr] = monthStr.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    if (!Number.isFinite(y) || !Number.isFinite(m)) continue;
    firstOrderDateByCustomer.set(cid, new Date(y, m - 1, 1).getTime());
  }

  const first30DaysProductsByCustomer = new Map<string, string[]>();

  const byCustomerOrder: Map<string, OrderRow[]> = new Map();
  for (const o of orderRows) {
    const cid = o.customer_id;
    if (!cid) continue;
    const list = byCustomerOrder.get(cid) ?? [];
    list.push(o);
    byCustomerOrder.set(cid, list);
  }

  for (const [cid, list] of byCustomerOrder) {
    const firstTs = firstOrderDateByCustomer.get(cid);
    if (firstTs == null) continue;
    const cutoff = firstTs + 30 * 24 * 60 * 60 * 1000;
    const inWindow = list
      .filter((o) => {
        const t = new Date(o.order_date).getTime();
        return Number.isFinite(t) && t >= firstTs && t <= cutoff;
      })
      .map((o) => o.product_name.trim() || o.product_id)
      .filter((v) => Boolean(v));
    const uniq = [...new Set(inWindow)];
    if (uniq.length >= 1) {
      first30DaysProductsByCustomer.set(cid, uniq);
    }
  }

  const pairCount = new Map<string, { customers: Set<string>; profit: number }>();
  const customerProfitLtv = new Map<string, number>();

  for (const o of orderRows) {
    if (!o.customer_id) continue;
    customerProfitLtv.set(
      o.customer_id,
      (customerProfitLtv.get(o.customer_id) ?? 0) + o.order_profit
    );
  }

  for (const [cid, products] of first30DaysProductsByCustomer) {
    if (!products || products.length === 0) continue;
    const key = [...products].sort().join("|");
    const profit = customerProfitLtv.get(cid) ?? 0;
    const existing = pairCount.get(key);
    if (existing) {
      existing.customers.add(cid);
      existing.profit += profit;
    } else {
      pairCount.set(key, { customers: new Set([cid]), profit });
    }
  }

  const archetypeList: Archetype[] = [];
  for (const [key, value] of pairCount) {
    if (!value) continue;
    const { customers: set, profit: totalProfit } = value;
    const items = key.split("|").filter(Boolean);
    if (items.length === 0) continue;
    const customerCount = set.size;
    archetypeList.push({
      items,
      customers: customerCount,
      profitLtv: customerCount > 0 ? totalProfit / customerCount : 0,
    });
  }

  archetypeList.sort((a, b) => b.customers - a.customers);
  return archetypeList.slice(0, 20);
}
