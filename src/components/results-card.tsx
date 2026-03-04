"use client";

import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiRow } from "./kpi-row";
import { CohortsTab } from "./cohorts-tab";
import { ArchetypesTab } from "./archetypes-tab";
import { LtvTab } from "./ltv-tab";
import type { ComputeResult } from "@/lib/types";

type ResultsCardProps = {
  data: ComputeResult | null;
  loading?: boolean;
};

function SkeletonLines({ n = 5 }: { n?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: n }).map((_, i) => (
        <motion.div
          key={i}
          className="h-4 rounded bg-muted"
          initial={{ opacity: 0.5 }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          style={{ width: `${80 - i * 10}%` }}
        />
      ))}
    </div>
  );
}

export function ResultsCard({ data, loading }: ResultsCardProps) {
  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-xl border bg-card p-6 shadow"
      >
        <CardTitle className="mb-4">Results</CardTitle>
        <SkeletonLines n={8} />
      </motion.div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <KpiRow kpis={data.kpis} />

          <Tabs defaultValue="cohorts" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="cohorts">Cohorts</TabsTrigger>
              <TabsTrigger value="archetypes">Archetypes</TabsTrigger>
              <TabsTrigger value="ltv">LTV</TabsTrigger>
            </TabsList>
            <TabsContent value="cohorts" className="mt-4">
              <CohortsTab data={data} />
            </TabsContent>
            <TabsContent value="archetypes" className="mt-4">
              <ArchetypesTab data={data} />
            </TabsContent>
            <TabsContent value="ltv" className="mt-4">
              <LtvTab data={data} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
}
