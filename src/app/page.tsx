"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { UploadCard } from "@/components/upload-card";
import { CostInputsCard } from "@/components/cost-inputs-card";
import { ResultsCard } from "@/components/results-card";
import type { CostInputs, ComputeResult } from "@/lib/types";

const defaultCosts: CostInputs = {
  cogsPct: 0,
  shippingPerOrder: 0,
  paymentProcessingPct: 0,
  fixedTransactionFee: 0,
};

export default function Home() {
  const [csvText, setCsvText] = useState("");
  const [costs, setCosts] = useState<CostInputs>(defaultCosts);
  const [result, setResult] = useState<ComputeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const updateResults = useCallback(async () => {
    if (!csvText.trim()) {
      toast({
        title: "No data",
        description: "Upload a CSV first.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText, costs }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Error",
          description: data?.error ?? "Compute failed",
          variant: "destructive",
        });
        return;
      }
      setResult(data);
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Request failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [csvText, costs, toast]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-10 max-w-6xl">
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Baysiq
          </h1>
          <p className="text-muted-foreground mt-2">
            Upload orders → discover cohorts → archetypes → profit LTV.
          </p>
        </motion.header>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <UploadCard csvText={csvText} onCsvChange={setCsvText} />
          <CostInputsCard
            costs={costs}
            onCostsChange={setCosts}
            onUpdateResults={updateResults}
            loading={loading}
          />
        </div>

        <ResultsCard data={result} loading={loading} />
      </div>
    </main>
  );
}
