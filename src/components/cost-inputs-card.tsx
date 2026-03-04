"use client";

import { motion } from "framer-motion";
import { Calculator } from "lucide-react";
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
};

export function CostInputsCard({
  costs,
  onCostsChange,
  onUpdateResults,
  loading = false,
  disabled = false,
}: CostInputsCardProps) {
  const set = (key: keyof CostInputs, value: number) => {
    onCostsChange({ ...costs, [key]: value });
  };

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
            COGS %, shipping, payment processing, and fixed fee per order
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
              onChange={(e) => set("paymentProcessingPct", parseFloat(e.target.value) || 0)}
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
              onChange={(e) => set("fixedTransactionFee", parseFloat(e.target.value) || 0)}
              disabled={disabled}
            />
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
