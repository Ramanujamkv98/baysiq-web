"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { LlmSummaryResult } from "@/lib/types";
import { SummaryCard } from "./summary-card";

type SummaryCardProps = {
  tab: string;
  metrics: Record<string, unknown>;
};

export function TabSummaryCard({ tab, metrics }: SummaryCardProps) {
  const [result, setResult] = useState<LlmSummaryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generate = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/llm/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tab, metrics }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Error", description: data?.error ?? "Failed to generate summary", variant: "destructive" });
        return;
      }
      setResult(data);
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Request failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SummaryCard
      title="Summary"
      generateLabel="Generate summary"
      onGenerate={generate}
      loading={loading}
      result={result}
    />
  );
}
