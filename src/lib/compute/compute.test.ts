import { describe, it, expect } from "vitest";
import { compute } from "./compute";

const sampleCsv = `order_id,customer_id,order_date,product_id,product_name,gross_revenue,discount,refund,utm_source,country
ord-1,cust-A,2024-01-05,prod-1,Widget A,100,5,0,google,US
ord-2,cust-A,2024-02-10,prod-2,Widget B,80,0,0,google,US
ord-3,cust-B,2024-01-15,prod-1,Widget A,100,10,0,facebook,CA`;

const costs = {
  cogsPct: 10,
  shippingPerOrder: 5,
  paymentProcessingPct: 2,
  fixedTransactionFee: 0.3,
};

describe("compute", () => {
  it("returns KPIs and cohort data for valid CSV", () => {
    const result = compute({ csvText: sampleCsv, costs });
    if ("error" in result) {
      expect.fail(result.error);
    }
    expect(result.kpis.orders).toBe(3);
    expect(result.kpis.customers).toBe(2);
    expect(result.kpis.revenue).toBe(95 + 80 + 90);
    expect(result.cohortProfitLtv.length).toBeGreaterThan(0);
    expect(result.profitLtvByCohort.length).toBeGreaterThan(0);
  });

  it("returns error for empty CSV", () => {
    const result = compute({ csvText: "", costs });
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("empty");
    }
  });

  it("returns error for missing required columns", () => {
    const badCsv = "order_id,customer_id\n1,2";
    const result = compute({ csvText: badCsv, costs });
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.toLowerCase()).toMatch(/missing|column/);
    }
  });
});
