/**
 * ComparisonBox - Display before/after comparison for optimization scenarios
 * Used for showing current vs suggested billing codes
 */

import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { formatCurrency } from "./severityStyles";

interface ComparisonBoxProps {
  currentCode: string;
  suggestedCode: string;
  currentAmount: number;
  expectedAmount: number;
  monetaryImpact: number;
}

export function ComparisonBox({
  currentCode,
  suggestedCode,
  currentAmount,
  expectedAmount,
  monetaryImpact,
}: ComparisonBoxProps) {
  return (
    <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
      <CardContent className="pt-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-3">
            Comparaison
          </div>

          {/* Comparison Grid */}
          <div className="grid grid-cols-3 gap-3 items-center">
            {/* Current State */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                Actuel
              </div>
              <div className="font-mono font-bold text-lg text-gray-900 dark:text-gray-100">
                {currentCode}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {formatCurrency(currentAmount)}
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <ArrowRight className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>

            {/* Suggested State */}
            <div className="bg-amber-100 dark:bg-amber-900/30 rounded-lg p-3 border border-amber-300 dark:border-amber-700">
              <div className="text-xs text-amber-700 dark:text-amber-300 mb-1">
                Suggéré
              </div>
              <div className="font-mono font-bold text-lg text-amber-900 dark:text-amber-100">
                {suggestedCode}
              </div>
              <div className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                {formatCurrency(expectedAmount)}
              </div>
            </div>
          </div>

          {/* Impact Summary */}
          <div className="pt-2 border-t border-amber-200 dark:border-amber-800">
            <div className="flex justify-between items-center text-sm">
              <span className="text-amber-700 dark:text-amber-300 font-medium">
                Gain potentiel:
              </span>
              <span className="font-bold text-lg text-green-600 dark:text-green-400">
                +{formatCurrency(monetaryImpact)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
