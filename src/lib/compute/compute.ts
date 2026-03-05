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
  const d = new Date(dateStr.trim());
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthIndex(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
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

    const order_date = String(r.order_date ?? "").trim();
    const order_month = toOrderMonth(order_date);
    const customer_id = String(r.customer_id ?? "").trim();
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
  const repeatPurchaseRate = customers > 0 ? (customersWithRepeat / customers) * 100 : 0;

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
  const maxMonthIndex = Math.max(0, ...orderRows.map((o) => o.month_index));
  for (const [cohortMonth, byIndex] of retentionMap) {
    const cohortSize = cohortSizes.get(cohortMonth) ?? 0;
    if (cohortSize === 0) continue;
    for (let mi = 0; mi <= maxMonthIndex; mi++) {
      const active = byIndex.get(mi)?.size ?? 0;
      cohortRetention.push({
        cohortMonth: cohortMonth,
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

  const archetypes = computeArchetypes(orderRows, customerFirstOrder);

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
    const [y, m] = monthStr.split("-").map(Number);
    firstOrderDateByCustomer.set(cid, new Date(y, m - 1, 1).getTime());
  }

  const first30DaysProductsByCustomer = new Map<string, string[]>();
  const first2OrdersProductsByCustomer = new Map<string, string[]>();

  const byCustomerOrder: Map<string, OrderRow[]> = new Map();
  for (const o of orderRows) {
    const list = byCustomerOrder.get(o.customer_id) ?? [];
    list.push(o);
    byCustomerOrder.set(o.customer_id, list);
  }

  for (const [cid, list] of byCustomerOrder) {
    const firstTs = firstOrderDateByCustomer.get(cid);
    if (firstTs == null) continue;
    const cutoff = firstTs + 30 * 24 * 60 * 60 * 1000;
    const inWindow = list
      .filter((o) => {
        const t = new Date(o.order_date).getTime();
        return t >= firstTs && t <= cutoff;
      })
      .map((o) => o.product_name.trim() || o.product_id)
      .filter(Boolean);
    const uniq = [...new Set(inWindow)];
    if (uniq.length >= 1) {
      first30DaysProductsByCustomer.set(cid, uniq);
    }

    const sorted = [...list].sort(
      (a, b) => new Date(a.order_date).getTime() - new Date(b.order_date).getTime()
    );
    const first2 = sorted.slice(0, 2);
    const products2 = [...new Set(first2.map((o) => o.product_name.trim() || o.product_id).filter(Boolean))];
    if (products2.length >= 1) {
      first2OrdersProductsByCustomer.set(cid, products2);
    }
  }

  const pairCount = new Map<string, { customers: Set<string>; profit: number }>();
  const customerProfitLtv = new Map<string, number>();

  for (const o of orderRows) {
    customerProfitLtv.set(
      o.customer_id,
      (customerProfitLtv.get(o.customer_id) ?? 0) + o.order_profit
    );
  }

  for (const [cid, products] of first30DaysProductsByCustomer) {
    const key = [...products].sort().join("|");
    const existing = pairCount.get(key);
    const profit = customerProfitLtv.get(cid) ?? 0;
    if (existing) {
      existing.customers.add(cid);
      existing.profit += profit;
    } else {
      pairCount.set(key, { customers: new Set([cid]), profit });
    }
  }

  const archetypeList: Archetype[] = [];
  for (const [key, { customers: set, profit: totalProfit }] of pairCount) {
    const items = key.split("|").filter(Boolean);
if (items.length === 0) continue;

archetypeList.push({
  key, // ✅ add this
  items,
  customers: set.size,
  profitLtv: set.size > 0 ? totalProfit / set.size : 0,
});
