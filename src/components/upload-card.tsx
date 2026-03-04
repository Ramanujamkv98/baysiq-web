"use client";

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { Upload, FileSpreadsheet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type UploadCardProps = {
  csvText: string;
  onCsvChange: (text: string) => void;
  disabled?: boolean;
};

export function UploadCard({ csvText, onCsvChange, disabled }: UploadCardProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFile = useCallback(
    (file: File | null) => {
      if (!file || disabled) return;
      if (!file.name.toLowerCase().endsWith(".csv")) {
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const text = typeof reader.result === "string" ? reader.result : "";
        onCsvChange(text);
      };
      reader.readAsText(file);
    },
    [onCsvChange, disabled]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      handleFile(file || null);
    },
    [handleFile]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const onBrowse = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      handleFile(file || null);
      e.target.value = "";
    },
    [handleFile]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn("overflow-hidden", isDragOver && "ring-2 ring-primary")}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload orders CSV
          </CardTitle>
          <CardDescription>
            Required columns: order_id, customer_id, order_date, product_id, product_name,
            gross_revenue, discount, refund, utm_source, country
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className={cn(
              "rounded-lg border-2 border-dashed p-6 text-center transition-colors",
              isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 bg-muted/30",
              disabled && "pointer-events-none opacity-60"
            )}
          >
            <input
              type="file"
              accept=".csv"
              onChange={onBrowse}
              className="hidden"
              id="csv-upload"
            />
            {csvText ? (
              <div className="flex flex-col items-center gap-2">
                <FileSpreadsheet className="h-10 w-10 text-primary" />
                <p className="text-sm font-medium">
                  {csvText.split(/\r?\n/).filter(Boolean).length} rows loaded
                </p>
                <label
                  htmlFor="csv-upload"
                  className="text-sm text-muted-foreground underline cursor-pointer hover:text-foreground"
                >
                  Replace file
                </label>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-2">
                  Drag & drop your CSV here, or
                </p>
                <label
                  htmlFor="csv-upload"
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 cursor-pointer"
                >
                  Browse
                </label>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
