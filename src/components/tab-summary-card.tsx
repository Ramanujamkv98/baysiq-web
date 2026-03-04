"use client";

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { LlmSummaryResult } from "@/lib/types";
import { SummaryCard } from "./summary-card";

type TabSummaryCardProps = {
  tab: string;
  metrics: Record<string, unknown>;
};

export function TabSummaryCard({ tab, metrics }: TabSummaryCardProps) {
  const [result, setResult] = useState<LlmSummaryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generate = async () => {
    if (!tab) {
      toast({
        title: "Error",
        description: "Missing tab context",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/llm/summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tab,
          metrics: metrics ?? {},
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          title: "Summary generation failed",
          description: data?.error ?? "Unknown error",
          variant: "destructive",
        });
        return;
      }

      setResult(data);
    } catch (err) {
      toast({
        title: "Network error",
        description: err instanceof Error ? err.message : "Request failed",
        variant: "destructive",
      });
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
