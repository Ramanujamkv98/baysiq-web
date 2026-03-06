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
  const trimmed = (dateStr ?? "").trim();
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

function normalizeSource(source: string): string {
  const s = (source ?? "").trim().toLowerCase();
  return s || "unknown";
}

function nonNegative(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function compareRowsByDateThenOrderId(
  a: Record<string, string | number>,
  b: Record<string, string | number>
): number {
  const da = new Date(String(a.order_date ?? "")).getTime();
  const db = new Date(String(b.order_date ?? "")).getTime();

  const safeDa = Number.isFinite(da) ? da : Number.POSITIVE_INFINITY;
  const safeDb = Number.isFinite(db) ? db : Number.POSITIVE_INFINITY;

  if (safeDa !== safeDb) return safeDa - safeDb;

  const oa = String(a.order_id ?? "");
  const ob = String(b.order_id ?? "");
  return oa.localeCompare(ob);
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

  const rowsSorted = [...rows].sort(compareRowsByDateThenOrderId);

  const cogsMult = costs.cogsPct / 100;
  const processingMult = costs.paymentProcessingPct / 100;
  const refundAssumptionMult = (costs.defaultRefundRatePct ?? 0) / 100;

  const normalizedCacBySource = Object.fromEntries(
    Object.entries(costs.cacBySource ?? {}).map(([k, v]) => [normalizeSource(k), nonNegative(v)])
  );

  // Detect source labels from CSV
  const detectedSources = [...new Set(rowsSorted.map((r) => normalizeSource(String(r.utm_source ?? ""))))].sort();

  // Earliest cohort month per customer
  const customerFirstOrderMonth: Map<string, string> = new Map();
  for (const r of rowsSorted) {
    const cid = String(r.customer_id ?? "").trim();
    const od = String(r.order_date ?? "").trim();
    if (!cid || !od) continue;

    const om = toOrderMonth(od);
    if (!om) continue;

    const existing = customerFirstOrderMonth.get(cid);
    if (!existing || om < existing) {
      customerFirstOrderMonth.set(cid, om);
    }
  }

  const orderRows: OrderRow[] = [];
  const cacAppliedCustomers = new Set<string>();

  let rowsWithTrueRefunds = 0;
  let rowsUsingRefundAssumption = 0;

  for (const r of rowsSorted) {
    const customer_id = String(r.customer_id ?? "").trim();
    const order_date = String(r.order_date ?? "").trim();
    const order_month = toOrderMonth(order_date);

    if (!customer_id || !order_month) {
      continue;
    }

    const gross = nonNegative(Number(r.gross_revenue) || 0);
    const discount = nonNegative(Number(r.discount) || 0);
    const actualRefund = nonNegative(Number(r.refund) || 0);

    const postDiscountRevenue = Math.max(0, gross - discount);

    const is_true_refund = actualRefund > 0;
    const assumedRefund =
      !is_true_refund && refundAssumptionMult > 0
        ? postDiscountRevenue * refundAssumptionMult
        : 0;

    const effective_refund = is_true_refund ? actualRefund : assumedRefund;

    if (is_true_refund) rowsWithTrueRefunds += 1;
    if (!is_true_refund && assumedRefund > 0) rowsUsingRefundAssumption += 1;

    const net_revenue = Math.max(0, postDiscountRevenue - effective_refund);

    const normalizedSource = normalizeSource(String(r.utm_source ?? ""));
    const acquisition_cost =
      !cacAppliedCustomers.has(customer_id)
        ? nonNegative(normalizedCacBySource[normalizedSource] ?? 0)
        : 0;

    if (!cacAppliedCustomers.has(customer_id)) {
      cacAppliedCustomers.add(customer_id);
    }

    const order_profit =
      net_revenue -
      cogsMult * net_revenue -
      costs.shippingPerOrder -
      processingMult * net_revenue -
      costs.fixedTransactionFee -
      acquisition_cost;

    const cohort_month = customerFirstOrderMonth.get(customer_id) ?? order_month;
    const month_index = monthIndex(cohort_month, order_month);

    orderRows.push({
      order_id: String(r.order_id ?? ""),
      customer_id,
      order_date,
      product_id: String(r.product_id ?? ""),
      product_name: String(r.product_name ?? ""),
      gross_revenue: gross,
      discount,
      refund: actualRefund,
      utm_source: normalizedSource,
      country: String(r.country ?? ""),
      effective_refund,
      net_revenue,
      order_profit,
      acquisition_cost,
      is_true_refund,
      order_month,
      cohort_month,
      month_index,
    });
  }

  const customers = new Set(orderRows.map((o) => o.customer_id)).size;
  const orders = orderRows.length;
  const revenue = orderRows.reduce((s, o) => s + o.net_revenue, 0);
  const profit = orderRows.reduce((s, o) => s + o.order_profit, 0);

  // Repeat purchase rate by unique order_id per customer
  const ordersByCustomer = new Map<string, Set<string>>();
  for (const o of orderRows) {
    const existing = ordersByCustomer.get(o.customer_id) ?? new Set<string>();
    existing.add(o.order_id);
    ordersByCustomer.set(o.customer_id, existing);
  }

  const customersWithRepeat = [...ordersByCustomer.values()].filter((set) => set.size >= 2).length;
  const repeatPurchaseRate = customers > 0 ? (customersWithRepeat / customers) * 100 : 0;

  // Cohort sizes
  const cohortSizes = new Map<string, number>();
  for (const [, cm] of customerFirstOrderMonth) {
    if (cm) cohortSizes.set(cm, (cohortSizes.get(cm) ?? 0) + 1);
  }

  // Retention map: cohortMonth -> monthIndex -> set(customers)
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
  const maxMonthIndex = orderRows.length > 0 ? Math.max(0, ...orderRows.map((o) => o.month_index)) : 0;

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

  cohortRetention.sort((a, b) => {
    if (a.cohortMonth !== b.cohortMonth) return a.cohortMonth.localeCompare(b.cohortMonth);
    return a.monthIndex - b.monthIndex;
  });

  // Profit LTV by cohort
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

  // Archetypes
  const rawArchetypes = computeArchetypes(orderRows, customerFirstOrderMonth);

  const archetypes: Archetype[] = rawArchetypes
    .filter(
      (a): a is Archetype =>
        Boolean(a) &&
        typeof (a as any).key === "string" &&
        Array.isArray(a.items) &&
        typeof a.customers === "number"
    )
    .map((a) => ({
      key: String((a as any).key ?? a.items?.join("|") ?? ""),
      items: Array.isArray(a.items) ? a.items : [],
      customers: Number.isFinite(a.customers) ? a.customers : 0,
      profitLtv: Number.isFinite(a.profitLtv) ? a.profitLtv : 0,
      name: (a as any).name,
      description: (a as any).description,
    }))
    .filter((a) => a.key.length > 0);

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
    detectedSources,
    refundDiagnostics: {
      rowsWithTrueRefunds,
      rowsUsingRefundAssumption,
    },
  };
}

function computeArchetypes(
  orderRows: OrderRow[],
  customerFirstOrder: Map<string, string>
): Archetype[] {
  // Convert cohort month (YYYY-MM) into a timestamp representing the 1st day of that month.
  const firstOrderDateByCustomer = new Map<string, number>();
  for (const [cid, monthStr] of customerFirstOrder) {
    if (!monthStr) continue;

    const [yStr, mStr] = monthStr.split("-");
    const y = Number(yStr);
    const m = Number(mStr);

    if (!Number.isFinite(y) || !Number.isFinite(m)) continue;

    firstOrderDateByCustomer.set(cid, new Date(y, m - 1, 1).getTime());
  }

  const byCustomerOrder: Map<string, OrderRow[]> = new Map();
  for (const o of orderRows) {
    const cid = o.customer_id;
    if (!cid) continue;

    const list = byCustomerOrder.get(cid) ?? [];
    list.push(o);
    byCustomerOrder.set(cid, list);
  }

  // Products purchased in the first 30 days
  const first30DaysProductsByCustomer = new Map<string, string[]>();
  for (const [cid, list] of byCustomerOrder) {
    const firstTs = firstOrderDateByCustomer.get(cid);
    if (firstTs == null) continue;

    const cutoff = firstTs + 30 * 24 * 60 * 60 * 1000;

    const inWindow = list
      .filter((o) => {
        const t = new Date(o.order_date).getTime();
        return Number.isFinite(t) && t >= firstTs && t <= cutoff;
      })
      .map((o) => {
        const pn = (o.product_name ? o.product_name.trim() : "") || "";
        const pid = (o.product_id ?? "").trim();
        return pn || pid;
      })
      .filter(Boolean);

    const uniq = [...new Set(inWindow)];
    if (uniq.length >= 1) {
      first30DaysProductsByCustomer.set(cid, uniq);
    }
  }

  // Sum profit by customer
  const customerProfitLtv = new Map<string, number>();
  for (const o of orderRows) {
    if (!o.customer_id) continue;

    customerProfitLtv.set(
      o.customer_id,
      (customerProfitLtv.get(o.customer_id) ?? 0) + o.order_profit
    );
  }

  // Group customers by the set of products they bought in first 30 days
  const groupMap = new Map<string, { customers: Set<string>; profit: number }>();

  for (const [cid, products] of first30DaysProductsByCustomer) {
    if (!products || products.length === 0) continue;

    const key = [...products].sort().join("|");
    const profit = customerProfitLtv.get(cid) ?? 0;

    const existing = groupMap.get(key);
    if (existing) {
      existing.customers.add(cid);
      existing.profit += profit;
    } else {
      groupMap.set(key, { customers: new Set([cid]), profit });
    }
  }

  const archetypeList: Archetype[] = [];
  for (const [key, value] of groupMap) {
    if (!value) continue;

    const { customers: set, profit: totalProfit } = value;
    const items = key.split("|").filter(Boolean);
    if (items.length === 0) continue;

    const customerCount = set.size;

    archetypeList.push({
      key,
      items,
      customers: customerCount,
      profitLtv: customerCount > 0 ? totalProfit / customerCount : 0,
    });
  }

  archetypeList.sort((a, b) => b.customers - a.customers);
  return archetypeList.slice(0, 20);
}
