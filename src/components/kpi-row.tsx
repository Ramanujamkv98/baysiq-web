"use client";

import { motion } from "framer-motion";
import {
  Users,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Kpi = {
  customers: number;
  orders: number;
  revenue: number;
  profit: number;
  repeatPurchaseRate: number;
};

type KpiRowProps = {
  kpis: Kpi;
  className?: string;
};

const formatNum = (n: number, decimals = 0) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const items: { key: keyof Kpi; label: string; icon: React.ElementType; format: (n: number) => string }[] = [
  { key: "customers", label: "Customers", icon: Users, format: formatNum },
  { key: "orders", label: "Orders", icon: ShoppingCart, format: formatNum },
  { key: "revenue", label: "Net revenue", icon: DollarSign, format: formatCurrency },
  { key: "profit", label: "Profit", icon: TrendingUp, format: formatCurrency },
  { key: "repeatPurchaseRate", label: "Repeat %", icon: RefreshCw, format: (n) => formatNum(n, 1) + "%" },
];

export function KpiRow({ kpis, className }: KpiRowProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className={cn("grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4", className)}
    >
      {items.map(({ key, label, icon: Icon, format }) => (
        <div
          key={key}
          className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm"
        >
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Icon className="h-4 w-4" />
            {label}
          </div>
          <p className="mt-1 text-xl font-semibold">{format(Number(kpis[key]))}</p>
        </div>
      ))}
    </motion.div>
  );
}
