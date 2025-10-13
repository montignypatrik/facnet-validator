/**
 * MonetaryImpactBadge - Reusable badge for displaying monetary impact
 * Based on VALIDATION_RESULT_DISPLAY_FRAMEWORK.md Part 4.2
 */

import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatCurrency } from "./severityStyles";
import { MonetaryImpactBadgeProps } from "@/types/validation";

export function MonetaryImpactBadge({ amount, size = "md" }: MonetaryImpactBadgeProps) {
  // Determine badge styling based on amount
  const isPositive = amount > 0;
  const isNegative = amount < 0;
  const isNeutral = amount === 0;

  // Size variants
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-0.5",
    lg: "text-base px-3 py-1",
  };

  // Icon size variants
  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  // Get icon component
  const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

  // Get styling classes
  const badgeClasses = isPositive
    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-300 dark:border-green-700"
    : isNegative
    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-300 dark:border-red-700"
    : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-600";

  // Get label
  const label = isPositive ? "Gain" : isNegative ? "Perte" : "Impact";

  return (
    <Badge className={`${badgeClasses} ${sizeClasses[size]} flex items-center gap-1 font-medium`}>
      <Icon className={iconSizes[size]} />
      <span>
        {label}: {formatCurrency(Math.abs(amount))}
      </span>
    </Badge>
  );
}
