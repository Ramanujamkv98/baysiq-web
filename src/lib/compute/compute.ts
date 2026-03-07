import type {
  CostInputs,
  OrderRow,
  ComputeResult,
  CohortRetentionCell,
  CohortProfitLtvRow,
  FirstProductAffinity,
  ProductCombination,
  MicroSegment,
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

  const totalCac = orderRows.reduce((s, o) => s + o.acquisition_cost, 0);
  const overallAvgLtv = customers > 0 ? profit / customers : 0;
  const overallLtvCacRatio = totalCac > 0 ? safeRatio(profit, totalCac) : null;

  // Optional debug logging (uncomment to trace LTV/CAC issues):
  // console.debug("[compute] orderRows:", orderRows.length, "customers:", customers, "revenue:", revenue, "profit:", profit, "totalCac:", totalCac, "overallAvgLtv:", overallAvgLtv, "overallLtvCacRatio:", overallLtvCacRatio);
  // if (orderRows.length > 0) console.debug("[compute] first row gross_revenue:", orderRows[0]?.gross_revenue, "net_revenue:", orderRows[0]?.net_revenue, "order_profit:", orderRows[0]?.order_profit);

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

    const insights = computeCustomerInsights(orderRows);

  return {
    kpis: {
      customers,
      orders,
      revenue,
      profit,
      repeatPurchaseRate,
    },
    overallAvgLtv,
    overallLtvCacRatio,
    cohortRetention,
    cohortProfitLtv,
    first_product_affinities: insights.first_product_affinities,
    product_combinations: insights.product_combinations,
    micro_segments: insights.micro_segments,
    profitLtvByCohort,
    detectedSources,
    refundDiagnostics: {
      rowsWithTrueRefunds,
      rowsUsingRefundAssumption,
    },
  };
}



type CustomerAggregate = {
  firstOrderTs: number;
  firstProduct: string;
  firstChannel: string;
  products30Days: Set<string>;
  totalProfit: number;
  totalCac: number;
};

function safeRatio(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return numerator / denominator;
}

function computeCustomerInsights(orderRows: OrderRow[]): {
  first_product_affinities: FirstProductAffinity[];
  product_combinations: ProductCombination[];
  micro_segments: MicroSegment[];
} {
  const byCustomer = new Map<string, CustomerAggregate>();

  for (const o of orderRows) {
    const ts = new Date(o.order_date).getTime();
    if (!Number.isFinite(ts)) continue;

    const productLabel = (o.product_name || o.product_id || "Unknown Product").trim() || "Unknown Product";

    const existing = byCustomer.get(o.customer_id);
    if (!existing) {
      byCustomer.set(o.customer_id, {
        firstOrderTs: ts,
        firstProduct: productLabel,
        firstChannel: o.utm_source || "unknown",
        products30Days: new Set([productLabel]),
        totalProfit: o.order_profit,
        totalCac: o.acquisition_cost,
      });
      continue;
    }

    existing.totalProfit += o.order_profit;
    existing.totalCac += o.acquisition_cost;

    if (ts < existing.firstOrderTs) {
      existing.firstOrderTs = ts;
      existing.firstProduct = productLabel;
      existing.firstChannel = o.utm_source || "unknown";
    }
  }

  for (const o of orderRows) {
    const customer = byCustomer.get(o.customer_id);
    if (!customer) continue;
    const ts = new Date(o.order_date).getTime();
    if (!Number.isFinite(ts)) continue;
    const cutoff = customer.firstOrderTs + 30 * 24 * 60 * 60 * 1000;
    if (ts > cutoff) continue;
    const productLabel = (o.product_name || o.product_id || "Unknown Product").trim() || "Unknown Product";
    customer.products30Days.add(productLabel);
  }

  const customers = [...byCustomer.values()];
  const overallAvgLtv = customers.length > 0
    ? customers.reduce((sum, c) => sum + c.totalProfit, 0) / customers.length
    : 0;

  const firstProductMap = new Map<string, { customers: number; totalProfit: number; totalCac: number; channels: Map<string, number> }>();
  for (const customer of customers) {
    const existing = firstProductMap.get(customer.firstProduct) ?? {
      customers: 0,
      totalProfit: 0,
      totalCac: 0,
      channels: new Map<string, number>(),
    };
    existing.customers += 1;
    existing.totalProfit += customer.totalProfit;
    existing.totalCac += customer.totalCac;
    existing.channels.set(customer.firstChannel, (existing.channels.get(customer.firstChannel) ?? 0) + 1);
    firstProductMap.set(customer.firstProduct, existing);
  }

  const first_product_affinities: FirstProductAffinity[] = [...firstProductMap.entries()]
    .map(([first_product, value]) => {
      const topChannel = [...value.channels.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";
      const avgProfit = value.customers > 0 ? value.totalProfit / value.customers : 0;
      const avgCac = value.customers > 0 ? value.totalCac / value.customers : 0;
      return {
        first_product,
        customers: value.customers,
        avg_profit_ltv: avgProfit,
        avg_cac: avgCac,
        ltv_cac_ratio: safeRatio(avgProfit, avgCac),
        top_acquisition_channel: topChannel,
      };
    })
    .sort((a, b) => b.customers - a.customers)
    .slice(0, 5);

  const comboMap = new Map<string, { key_products: string[]; customers: number; totalProfit: number; totalCac: number }>();
  for (const customer of customers) {
    const key_products = [...customer.products30Days].sort();
    if (key_products.length === 0) continue;
    const key = key_products.join(" + ");
    const existing = comboMap.get(key) ?? { key_products, customers: 0, totalProfit: 0, totalCac: 0 };
    existing.customers += 1;
    existing.totalProfit += customer.totalProfit;
    existing.totalCac += customer.totalCac;
    comboMap.set(key, existing);
  }

  const product_combinations: ProductCombination[] = [...comboMap.entries()]
    .map(([product_combination, value]) => {
      const avgProfit = value.customers > 0 ? value.totalProfit / value.customers : 0;
      const avgCac = value.customers > 0 ? value.totalCac / value.customers : 0;
      return {
        product_combination,
        key_products: value.key_products,
        customers: value.customers,
        avg_profit_ltv: avgProfit,
        avg_cac: avgCac,
        ltv_cac_ratio: safeRatio(avgProfit, avgCac),
      };
    })
    .filter((item) => item.customers >= 5)
    .sort((a, b) => b.customers - a.customers)
    .slice(0, 5);

  const micro_segments: MicroSegment[] = [...comboMap.values()]
    .map((value) => {
      const avgProfit = value.customers > 0 ? value.totalProfit / value.customers : 0;
      const avgCac = value.customers > 0 ? value.totalCac / value.customers : 0;
      return {
        key_products: value.key_products,
        customers: value.customers,
        profit_ltv: avgProfit,
        avg_cac: avgCac,
        ltv_cac_ratio: safeRatio(avgProfit, avgCac),
      };
    })
    .filter((segment) => segment.customers >= 3 && segment.profit_ltv > overallAvgLtv)
    .sort((a, b) => b.profit_ltv - a.profit_ltv)
    .slice(0, 5);

  return { first_product_affinities, product_combinations, micro_segments };
}
