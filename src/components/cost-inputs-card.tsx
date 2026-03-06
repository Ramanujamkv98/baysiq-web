"use client";

import { motion } from "framer-motion";
import { Calculator } from "lucide-react";
import Papa from "papaparse";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CostInputs } from "@/lib/types";

type CostInputsCardProps = {
  costs: CostInputs;
  onCostsChange: (costs: CostInputs) => void;
  onUpdateResults: () => void;
  loading?: boolean;
  disabled?: boolean;
  csvText?: string;
};

function normalizeSource(source: string): string {
  return source.trim().toLowerCase() || "unknown";
}

function detectSourcesFromCsv(csvText: string): string[] {
  const trimmed = csvText.trim();
  if (!trimmed) return [];

  const parsed = Papa.parse<Record<string, string>>(trimmed, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  if (parsed.errors.length > 0) return [];

  const sources = new Set<string>();

  for (const row of parsed.data) {
    const raw = row?.utm_source ?? "";
    const normalized = normalizeSource(String(raw));
    if (normalized) {
      sources.add(normalized);
    }
  }

  return [...sources].sort();
}

export function CostInputsCard({
  costs,
  onCostsChange,
  onUpdateResults,
  loading = false,
  disabled = false,
  csvText = "",
}: CostInputsCardProps) {
  const set = (key: keyof CostInputs, value: number) => {
    onCostsChange({ ...costs, [key]: value });
  };

  const setCacForSource = (source: string, value: number) => {
    onCostsChange({
      ...costs,
      cacBySource: {
        ...(costs.cacBySource ?? {}),
        [source]: value,
      },
    });
  };

  const detectedSources = detectSourcesFromCsv(csvText);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Cost inputs
          </CardTitle>
          <CardDescription>
            Enter product and transaction costs, optional refund assumption, and CAC by source.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="grid gap-2">
            <Label htmlFor="cogs">COGS % (0–100)</Label>
            <Input
              id="cogs"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={costs.cogsPct}
              onChange={(e) => set("cogsPct", parseFloat(e.target.value) || 0)}
              disabled={disabled}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="shipping">Shipping cost per order</Label>
            <Input
              id="shipping"
              type="number"
              min={0}
              step={0.01}
              value={costs.shippingPerOrder}
              onChange={(e) => set("shippingPerOrder", parseFloat(e.target.value) || 0)}
              disabled={disabled}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="processing">Payment processing % (0–100)</Label>
            <Input
              id="processing"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={costs.paymentProcessingPct}
              onChange={(e) =>
                set("paymentProcessingPct", parseFloat(e.target.value) || 0)
              }
              disabled={disabled}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="fixed">Fixed transaction fee</Label>
            <Input
              id="fixed"
              type="number"
              min={0}
              step={0.01}
              value={costs.fixedTransactionFee}
              onChange={(e) =>
                set("fixedTransactionFee", parseFloat(e.target.value) || 0)
              }
              disabled={disabled}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="refund-rate">Default refund % (optional fallback)</Label>
            <Input
              id="refund-rate"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={costs.defaultRefundRatePct ?? 0}
              onChange={(e) =>
                set("defaultRefundRatePct", parseFloat(e.target.value) || 0)
              }
              disabled={disabled}
            />
            <p className="text-xs text-muted-foreground">
              Used only when a row does not contain a true refund amount.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <Label>CAC by source</Label>
              <p className="text-xs text-muted-foreground mt-1">
                CAC is applied only to the first order for each customer.
              </p>
            </div>

            {detectedSources.length > 0 ? (
              <div className="grid gap-3">
                {detectedSources.map((source) => (
                  <div key={source} className="grid gap-2">
                    <Label htmlFor={`cac-${source}`}>
                      CAC — {source}
                    </Label>
                    <Input
                      id={`cac-${source}`}
                      type="number"
                      min={0}
                      step={0.01}
                      value={costs.cacBySource?.[source] ?? 0}
                      onChange={(e) =>
                        setCacForSource(source, parseFloat(e.target.value) || 0)
                      }
                      disabled={disabled}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Upload a CSV to detect source labels like meta, google, email, and organic.
              </p>
            )}
          </div>

          <Button
            onClick={onUpdateResults}
            disabled={disabled || loading}
            className="w-full mt-2"
          >
            {loading ? "Updating…" : "Update results"}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
