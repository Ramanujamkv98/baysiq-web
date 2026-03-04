"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabSummaryCard } from "./tab-summary-card";
import type { ComputeResult } from "@/lib/types";

type LtvTabProps = {
  data: ComputeResult;
};

export function LtvTab({ data }: LtvTabProps) {
  const { profitLtvByCohort } = data;

  const chartData = useMemo(
    () =>
      profitLtvByCohort.map((r) => ({
        name: r.cohortMonth,
        profitLtv: Math.round(r.profitLtv * 100) / 100,
      })),
    [profitLtvByCohort]
  );

  const metrics = useMemo(
    () => ({
      cohorts: profitLtvByCohort.length,
      avgLtv:
        profitLtvByCohort.length > 0
          ? profitLtvByCohort.reduce((s, r) => s + r.profitLtv, 0) / profitLtvByCohort.length
          : 0,
    }),
    [profitLtvByCohort]
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <TabSummaryCard tab="LTV" metrics={metrics} />

      <Card>
        <CardHeader>
          <CardTitle>Profit LTV by cohort</CardTitle>
          <p className="text-sm text-muted-foreground">Bar chart and table below.</p>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  formatter={(v: number) => [
                    new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                      maximumFractionDigits: 0,
                    }).format(v),
                    "Profit LTV",
                  ]}
                />
                <Bar dataKey="profitLtv" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profit LTV table</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-2 border-b font-medium">Cohort</th>
                  <th className="text-right p-2 border-b font-medium">Profit LTV</th>
                </tr>
              </thead>
              <tbody>
                {profitLtvByCohort.map((r) => (
                  <tr key={r.cohortMonth}>
                    <td className="p-2 border-b font-mono">{r.cohortMonth}</td>
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
