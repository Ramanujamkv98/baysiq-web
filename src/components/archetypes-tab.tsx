"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { TabSummaryCard } from "./tab-summary-card";
import type { Archetype as ArchetypeType, ComputeResult } from "@/lib/types";

type ArchetypesTabProps = {
  data: ComputeResult;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function ArchetypesTab({ data }: ArchetypesTabProps) {
  const [archetypes, setArchetypes] = useState<ArchetypeType[]>(data.archetypes);

  useEffect(() => {
    setArchetypes(data.archetypes);
  }, [data.archetypes]);

  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleLabelWithAi = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/llm/archetypes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patterns: archetypes }),
      });

      const json = await res.json();

      if (!res.ok) {
        toast({
          title: "Error",
          description: json?.error ?? "Failed to label archetypes",
          variant: "destructive",
        });
        return;
      }

      const labeled = json.archetypes as Array<{
        name: string;
        description: string;
        items: string[];
      }>;

      if (Array.isArray(labeled)) {
        setArchetypes((prev) =>
          prev.map((p, i) => {
            const l = labeled[i];
            if (!l) return p;
            return {
              ...p,
              name: l.name,
              description: l.description,
              items: l.items?.length ? l.items : p.items,
            };
          })
        );
        toast({ title: "Done", description: "Archetypes labeled." });
      }
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Request failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const metrics = {
    archetypesCount: archetypes.length,
    totalCustomers: archetypes.reduce((s, a) => s + a.customers, 0),
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <TabSummaryCard tab="Archetypes" metrics={metrics} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Top product archetypes (first 30 days)</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLabelWithAi}
            disabled={loading || archetypes.length === 0}
          >
            {loading ? "Labeling…" : "Label with AI"}
          </Button>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            {archetypes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No archetypes detected.</p>
            ) : (
              archetypes.map((a) => (
                <div key={a.key} className="rounded-lg border p-4 space-y-1">
                  <div className="font-medium">{a.name ?? a.items.join(" + ")}</div>

                  {a.description && (
                    <p className="text-sm text-muted-foreground">{a.description}</p>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Items: {a.items.join(", ")} · Customers: {a.customers} · Profit LTV:{" "}
                    {typeof a.profitLtv === "number" ? formatCurrency(a.profitLtv) : "—"}
                  </p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
