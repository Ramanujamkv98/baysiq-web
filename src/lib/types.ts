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

export type CostInputs = {
  cogsPct: number; // 0–100
  shippingPerOrder: number;
  paymentProcessingPct: number; // 0–100
  fixedTransactionFee: number;
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
  net_revenue: number;
  order_profit: number;
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
 * Step 1: product pairs discovered within first 30 days
 * Later steps may add LTV metrics and AI labeling
 */
export type Archetype = {
  /** Stable identifier for React keys and LLM caching */
  key: string; // e.g. "Vitamin C Serum|Retinol Cream"

  /** Products involved in the archetype */
  items: string[];

  /** Number of unique customers exhibiting this pattern */
  customers: number;

  /** Step 2+ (optional for now) */
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
