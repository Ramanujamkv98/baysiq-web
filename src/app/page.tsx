"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { UploadCard } from "@/components/upload-card";
import { CostInputsCard } from "@/components/cost-inputs-card";
import { ResultsCard } from "@/components/results-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const scrollToApp = useCallback(() => {
    document.getElementById("app")?.scrollIntoView({ behavior: "smooth" });
  }, []);

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
      <div className="container mx-auto px-4 py-10 max-w-6xl space-y-20">
        {/* HERO */}
        <motion.section
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6"
        >
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Baysiq</p>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-foreground">
              Turn raw Shopify exports into cohort retention + profit LTV — in minutes.
            </h1>
          </div>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload orders CSV. Add costs. Get cohorts, archetypes, and LTV. No setup.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Button size="lg" onClick={scrollToApp}>
              Upload CSV
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                // simple "demo" action: scroll to preview section
                document.getElementById("preview")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              View demo
            </Button>
          </div>
        </motion.section>

        {/* TRUST STRIP */}
        <section className="text-center text-sm text-muted-foreground space-y-1">
          <p>Works locally in your browser. Optional AI summaries.</p>
          <p>No data stored unless you deploy with your own backend.</p>
        </section>

        {/* PREVIEW */}
        <section id="preview" className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-semibold">See what you’ll get</h2>
            <p className="text-sm text-muted-foreground">
              Static preview—your real results appear after you upload your CSV.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>KPI Snapshot</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Revenue</span>
                  <span className="font-medium">$124,500</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gross Profit</span>
                  <span className="font-medium">$42,800</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Repeat Rate</span>
                  <span className="font-medium">37%</span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Cohort Heatmap</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-muted-foreground">2025-03</span>
                    <span className="font-medium">100% · 39% · 20% · 11%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-muted-foreground">2025-04</span>
                    <span className="font-medium">100% · 30% · 14% · 7%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-muted-foreground">2025-05</span>
                    <span className="font-medium">100% · 67% · — · —</span>
                  </div>
                  <p className="text-xs text-muted-foreground pt-2">
                    Rows = acquisition month. Columns = months after first purchase.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Customer Archetypes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Loyal repeat buyers</span>
                  <span className="font-medium">High LTV</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">One-time trial users</span>
                  <span className="font-medium">High churn</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Seasonal buyers</span>
                  <span className="font-medium">Spiky</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-semibold">How it works</h2>
            <p className="text-sm text-muted-foreground">
              Three steps to clarity—no integrations required.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">1) Upload CSV</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Export orders from Shopify and drop the file in.
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">2) Enter costs</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Add COGS, shipping, and payment fees to compute profit.
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">3) Explore insights</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                View cohorts, archetypes, and profit LTV in a single dashboard.
              </CardContent>
            </Card>
          </div>
        </section>

        {/* FAQ */}
        <section className="space-y-6 max-w-3xl mx-auto">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-semibold">FAQ</h2>
          </div>

          <div className="space-y-5 text-sm">
            <div className="space-y-1">
              <p className="font-medium">What CSV format do you need?</p>
              <p className="text-muted-foreground">
                A Shopify orders export (or equivalent) with order date, order amount, and a stable
                customer identifier. If your columns differ, we can map them in a later version.
              </p>
            </div>

            <div className="space-y-1">
              <p className="font-medium">Do you store data?</p>
              <p className="text-muted-foreground">
                The upload and analysis run in your app session. If you deploy with your own backend,
                storage behavior depends on your setup.
              </p>
            </div>

            <div className="space-y-1">
              <p className="font-medium">What does “profit LTV” mean?</p>
              <p className="text-muted-foreground">
                Lifetime value after subtracting COGS, shipping, and payment processing fees—so you
                can see what customers are worth in profit, not just revenue.
              </p>
            </div>
          </div>
        </section>

        {/* APP */}
        <section id="app" className="space-y-8 scroll-mt-24">
          <motion.header
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-2"
          >
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Try it on your CSV
            </h2>
            <p className="text-muted-foreground">
              Upload orders → compute cohorts → archetypes → profit LTV.
            </p>
          </motion.header>

          <div className="grid md:grid-cols-2 gap-6">
            <UploadCard csvText={csvText} onCsvChange={setCsvText} />
            <CostInputsCard
              costs={costs}
              onCostsChange={setCosts}
              onUpdateResults={updateResults}
              loading={loading}
            />
          </div>

          <ResultsCard data={result} loading={loading} />
        </section>
      </div>
    </main>
  );
}
