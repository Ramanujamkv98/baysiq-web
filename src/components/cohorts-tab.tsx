"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabSummaryCard } from "./tab-summary-card";
import type { ComputeResult } from "@/lib/types";

type CohortsTabProps = {
  data: ComputeResult;
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

// 0% -> red, 50% -> orange, 100% -> green
function retentionBg(pct: number | null) {
  if (pct === null || Number.isNaN(pct)) return "transparent";

  const t = clamp01(pct / 100);

  const hue =
    t < 0.5
      ? 0 + (t / 0.5) * 30 // red -> orange
      : 30 + ((t - 0.5) / 0.5) * 90; // orange -> green

  const sat = 85;
  const light = 92 - t * 35;

  return `hsl(${hue} ${sat}% ${light}%)`;
}

function retentionText(pct: number | null) {
  if (pct === null) return "text-slate-500";
  // background is never super dark with our lightness settings, so dark text stays readable
  return "text-slate-900";
}

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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Use the API tab key to avoid casing issues */}
      <TabSummaryCard tab="cohorts" metrics={metrics} />

      <Card>
        <CardHeader>
          <CardTitle>Cohort retention by first purchase month</CardTitle>
          <p className="text-sm text-muted-foreground">
            Rows = month customers were acquired. Columns = months after first purchase.
          </p>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-muted/40">
                <tr>
                  {/* Sticky cohort column */}
                  <th className="sticky left-0 z-10 bg-muted/40 text-left p-2 border-b font-medium">
                    Cohort
                  </th>
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
                    <tr key={cohort} className="hover:bg-muted/20">
                      <td className="sticky left-0 z-10 bg-background p-2 border-b font-mono text-muted-foreground">
                        {cohort}
                      </td>

                      {Array.from({ length: heatmapGrid.maxMi + 1 }, (_, mi) => {
                        const pct = byMi.get(mi);
                        const isMissing = pct === undefined;

                        const displayPct = isMissing ? null : pct;
                        const bg = retentionBg(displayPct);

                        return (
                          <td
                            key={mi}
                            className={`p-2 border-b text-center font-medium ${retentionText(
                              displayPct
                            )}`}
                            style={{ backgroundColor: bg }}
                            title={
                              displayPct === null
                                ? "Not enough data yet"
                                : `${displayPct.toFixed(1)}%`
                            }
                          >
                            {displayPct === null ? "—" : `${displayPct.toFixed(0)}%`}
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
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left p-2 border-b font-medium">Cohort</th>
                  <th className="text-right p-2 border-b font-medium">Size</th>
                  <th className="text-right p-2 border-b font-medium">Profit LTV</th>
                </tr>
              </thead>
              <tbody>
                {cohortProfitLtv.map((r) => (
                  <tr key={r.cohortMonth} className="hover:bg-muted/20">
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
