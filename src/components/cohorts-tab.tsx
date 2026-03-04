"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabSummaryCard } from "./tab-summary-card";
import type { ComputeResult } from "@/lib/types";

type CohortsTabProps = {
  data: ComputeResult;
};

export function CohortsTab({ data }: CohortsTabProps) {
  const { cohortRetention, cohortProfitLtv } = data;

  const heatmapGrid = useMemo(() => {
    const byCohort = new Map<string, { monthIndex: number; retentionPct: number }[]>();
    for (const c of cohortRetention) {
      let arr = byCohort.get(c.cohortMonth);
      if (!arr) {
        arr = [];
        byCohort.set(c.cohortMonth, arr);
      }
      arr.push({ monthIndex: c.monthIndex, retentionPct: c.retentionPct });
    }
    const cohorts = [...byCohort.keys()].sort();
    const maxMi = Math.max(0, ...cohortRetention.map((c) => c.monthIndex));
    return { cohorts, maxMi, byCohort };
  }, [cohortRetention]);

  const metrics = useMemo(
    () => ({
      cohorts: heatmapGrid.cohorts.length,
      retentionCells: cohortRetention.length,
      cohortProfitLtvRows: cohortProfitLtv.length,
    }),
    [heatmapGrid.cohorts.length, cohortRetention.length, cohortProfitLtv.length]
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <TabSummaryCard tab="Cohorts" metrics={metrics} />

      <Card>
        <CardHeader>
          <CardTitle>Cohort retention (by month index)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Rows = cohort month, columns = month index (0 = first month). Cell = retention %.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-2 border-b font-medium">Cohort</th>
                  {Array.from({ length: heatmapGrid.maxMi + 1 }, (_, i) => (
                    <th key={i} className="p-2 border-b font-medium text-center">
                      M{i}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmapGrid.cohorts.map((cohort) => {
                  const cells = heatmapGrid.byCohort.get(cohort) ?? [];
                  const byMi = new Map(cells.map((c) => [c.monthIndex, c.retentionPct]));
                  return (
                    <tr key={cohort}>
                      <td className="p-2 border-b font-mono text-muted-foreground">{cohort}</td>
                      {Array.from({ length: heatmapGrid.maxMi + 1 }, (_, mi) => {
                        const pct = byMi.get(mi) ?? 0;
                        const intensity = Math.min(1, pct / 100);
                        return (
                          <td
                            key={mi}
                            className="p-2 border-b text-center"
                            style={{
                              backgroundColor: `hsl(199 89% 48% / ${0.15 + intensity * 0.85})`,
                              color: intensity > 0.5 ? "white" : "inherit",
                            }}
                            title={`${pct.toFixed(1)}%`}
                          >
                            {pct > 0 ? `${pct.toFixed(0)}%` : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cohort profit LTV summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-2 border-b font-medium">Cohort</th>
                  <th className="text-right p-2 border-b font-medium">Size</th>
                  <th className="text-right p-2 border-b font-medium">Profit LTV</th>
                </tr>
              </thead>
              <tbody>
                {cohortProfitLtv.map((r) => (
                  <tr key={r.cohortMonth}>
                    <td className="p-2 border-b font-mono">{r.cohortMonth}</td>
                    <td className="p-2 border-b text-right">{r.cohortSize}</td>
                    <td className="p-2 border-b text-right">
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 0,
                      }).format(r.profitLtv)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
