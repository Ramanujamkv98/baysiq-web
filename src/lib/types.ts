/** Raw row from CSV (keys normalized to lowercase, trimmed) */
export type CsvRow = Record<string, string>;

/** Required CSV columns (case-insensitive) */
export const REQUIRED_CSV_COLUMNS = [
  "order_id",
  "customer_id",
  "order_date",
  "product_id",
  "product_name",
  "gross_revenue",
  "discount",
  "refund",
  "utm_source",
  "country",
] as const;

export type CacBySource = Record<string, number>;

export type CostInputs = {
  cogsPct: number; // 0–100
  shippingPerOrder: number;
  paymentProcessingPct: number; // 0–100
  fixedTransactionFee: number;

  /**
   * Fallback refund assumption when you do not trust / do not have true refund data.
   * If actual refund > 0 on the row, actual refund wins.
   * If actual refund = 0, this assumed % can be applied to post-discount revenue.
   */
  defaultRefundRatePct?: number; // 0–100

  /**
   * CAC keyed by normalized utm_source, e.g.
   * { meta: 18, google: 22, email: 2, organic: 0 }
   */
  cacBySource?: CacBySource;
};

export type OrderRow = {
  order_id: string;
  customer_id: string;
  order_date: string;
  product_id: string;
  product_name: string;
  gross_revenue: number;
  discount: number;
  refund: number;
  utm_source: string;
  country: string;

  /** Refund actually used by the engine (actual refund or fallback assumption) */
  effective_refund: number;

  net_revenue: number;
  order_profit: number;

  /** CAC applied only on first valid order row for the customer */
  acquisition_cost: number;

  /** Whether this row had an actual refund value > 0 */
  is_true_refund: boolean;

  order_month: string; // YYYY-MM
  cohort_month: string; // YYYY-MM (customer first order month)
  month_index: number; // 0, 1, 2, ...
};

export type CohortRetentionCell = {
  cohortMonth: string;
  monthIndex: number;
  retentionPct: number;
  activeCustomers: number;
  cohortSize: number;
};

export type CohortProfitLtvRow = {
  cohortMonth: string;
  cohortSize: number;
  profitLtv: number;
};

/**
 * Archetype = customer product behavior pattern
 * Step 1: product sets discovered within first 30 days
 * Later steps may add LTV metrics and AI labeling
 */
export type Archetype = {
  /** Stable identifier for React keys + later caching */
  key: string;

  /** Products involved in the archetype */
  items: string[];

  /** Number of unique customers exhibiting this pattern */
  customers: number;

  /** Average profit LTV across customers in this archetype */
  profitLtv?: number;

  /** Step 3+ LLM labeling */
  name?: string;
  description?: string;
};

export type ComputeResult = {
  kpis: {
    customers: number;
    orders: number;
    revenue: number;
    profit: number;
    repeatPurchaseRate: number; // 0–100
  };

  cohortRetention: CohortRetentionCell[];
  cohortProfitLtv: CohortProfitLtvRow[];
  archetypes: Archetype[];
  profitLtvByCohort: { cohortMonth: string; profitLtv: number }[];

  /** Distinct normalized source labels found in the CSV */
  detectedSources: string[];

  /** Small refund diagnostics for UI/debugging */
  refundDiagnostics: {
    rowsWithTrueRefunds: number;
    rowsUsingRefundAssumption: number;
  };
};

export type LlmArchetypeLabel = {
  name: string;
  description: string;
  items: string[];
};

export type LlmSummaryResult = {
  bullets: string[];
  recommendation: string;
};
