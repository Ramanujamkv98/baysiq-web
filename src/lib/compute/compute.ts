function computeArchetypes(
  orderRows: OrderRow[],
  customerFirstOrder: Map<string, string>
): Archetype[] {
  // Convert cohort month (YYYY-MM) into a timestamp representing the 1st day of that month.
  // NOTE: This is an approximation if the CSV has real day-level first orders, but works for MVP.
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
      profitLtv: set.size > 0 ? totalProfit / set.size : 0, // optional, safe
    });
  }

  // Sort by customer count desc, keep top 5
  archetypeList.sort((a, b) => b.customers - a.customers);
  return archetypeList.slice(0, 5);
}
