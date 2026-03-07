"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { TabSummaryCard } from "./tab-summary-card";
import type { ComputeResult, MicroSegment } from "@/lib/types";

type ArchetypesTabProps = {
  data: ComputeResult;
};

type LabeledSegment = {
  segment_name: string;
  insight: string;
  action: string;
};

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`;
}

function formatRatio(value: number) {
  return value.toFixed(2);
}

export function ArchetypesTab({ data }: ArchetypesTabProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [microSegments, setMicroSegments] = useState<MicroSegment[]>(data.micro_segments);

  useEffect(() => {
    setMicroSegments(data.micro_segments);
  }, [data.micro_segments]);

  const handleLabelWithAi = async () => {
    setLoading(true);

    try {
      const res = await fetch("/api/llm/archetypes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segments: microSegments }),
      });

      const json = await res.json();

      if (!res.ok) {
        toast({
          title: "Error",
          description: json?.error ?? "Failed to generate micro-segment labels",
          variant: "destructive",
        });
        return;
      }

      const labeled = json.segments as LabeledSegment[];

      if (Array.isArray(labeled)) {
        setMicroSegments((prev) =>
          prev.map((segment, index) => ({
            ...segment,
            segment_name: labeled[index]?.segment_name ?? segment.segment_name,
            insight: labeled[index]?.insight ?? segment.insight,
            action: labeled[index]?.action ?? segment.action,
          }))
        );

        toast({
          title: "Done",
          description: "Micro segments enriched with AI labels.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Request failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const topFirstProductAffinities = useMemo(
    () =>
      data.first_product_affinities.slice(0, 5).map((row) => ({
        firstProduct: row.first_product,
        customers: row.customers,
        profitLtv: row.avg_profit_ltv,
        avgCac: row.avg_cac,
        ltvCacRatio: row.ltv_cac_ratio,
        topChannel: row.top_acquisition_channel,
      })),
    [data.first_product_affinities]
  );

  const topProductCombinations = useMemo(
    () =>
      data.product_combinations.slice(0, 5).map((row) => ({
        productCombination: row.product_combination,
        keyProducts: row.key_products,
        customers: row.customers,
        profitLtv: row.avg_profit_ltv,
        avgCac: row.avg_cac,
        ltvCacRatio: row.ltv_cac_ratio,
      })),
    [data.product_combinations]
  );

  const metrics = useMemo(
    () => ({
      firstProductAffinitiesCount: data.first_product_affinities.length,
      productCombinationsCount: data.product_combinations.length,
      microSegmentsCount: microSegments.length,
      productCombinationDefinition:
        "A product combination is the grouped set of products repeatedly purchased together by the same customer (order sequence ignored).",
      topFirstProductAffinities,
      topProductCombinations,
    }),
    [
      data.first_product_affinities.length,
      data.product_combinations.length,
      microSegments.length,
      topFirstProductAffinities,
      topProductCombinations,
    ]
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <TabSummaryCard tab="archetypes" metrics={metrics} />

      <Card>
        <CardHeader>
          <CardTitle>Top First Product Affinities</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th>First Product</th>
                <th>Customers</th>
                <th>Profit LTV</th>
                <th>Avg CAC</th>
                <th>LTV/CAC</th>
                <th>Top Channel</th>
              </tr>
            </thead>
            <tbody>
              {data.first_product_affinities.slice(0, 5).map((row) => (
                <tr key={row.first_product} className="border-b">
                  <td>{row.first_product}</td>
                  <td>{row.customers}</td>
                  <td>{formatCurrency(row.avg_profit_ltv)}</td>
                  <td>{formatCurrency(row.avg_cac)}</td>
                  <td>{formatRatio(row.ltv_cac_ratio)}</td>
                  <td>{row.top_acquisition_channel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Product Combinations</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th>Product Combination</th>
                <th>Customers</th>
                <th>Profit LTV</th>
                <th>Avg CAC</th>
                <th>LTV/CAC</th>
              </tr>
            </thead>
            <tbody>
              {data.product_combinations.slice(0, 5).map((row) => (
                <tr key={row.product_combination} className="border-b">
                  <td>{row.product_combination}</td>
                  <td>{row.customers}</td>
                  <td>{formatCurrency(row.avg_profit_ltv)}</td>
                  <td>{formatCurrency(row.avg_cac)}</td>
                  <td>{formatRatio(row.ltv_cac_ratio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Emerging High-Profit Micro Segments</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLabelWithAi}
            disabled={loading || microSegments.length === 0}
          >
            {loading ? "Generating…" : "Generate AI Insights"}
          </Button>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th>Segment</th>
                <th>Customers</th>
                <th>Profit LTV</th>
                <th>Avg CAC</th>
                <th>LTV/CAC</th>
                <th>Key Products</th>
                <th>Insight</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {microSegments.slice(0, 5).map((row, index) => (
                <tr key={`${row.key_products.join("|")}-${index}`} className="border-b align-top">
                  <td>{row.segment_name ?? `Segment ${index + 1}`}</td>
                  <td>{row.customers}</td>
                  <td>{formatCurrency(row.profit_ltv)}</td>
                  <td>{formatCurrency(row.avg_cac)}</td>
                  <td>{formatRatio(row.ltv_cac_ratio)}</td>
                  <td>{row.key_products.join(", ")}</td>
                  <td>{row.insight ?? "—"}</td>
                  <td>{row.action ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </motion.div>
  );
}
