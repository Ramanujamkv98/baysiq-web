"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LlmSummaryResult } from "@/lib/types";

type SummaryCardProps = {
  title: string;
  generateLabel: string;
  onGenerate: () => void | Promise<void>;
  loading: boolean;
  result: LlmSummaryResult | null;
};

export function SummaryCard({
  title,
  generateLabel,
  onGenerate,
  loading,
  result,
}: SummaryCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onGenerate}
          disabled={loading}
        >
          {loading ? "Generating…" : generateLabel}
        </Button>
        {result && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="space-y-2 text-sm"
          >
            {result.bullets.length > 0 && (
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                {result.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}
            {result.recommendation && (
              <p className="font-medium text-foreground">{result.recommendation}</p>
            )}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
