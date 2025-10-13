/**
 * BillingDetailsBox - Display billing code, amount, and type information
 * Based on VALIDATION_RESULT_DISPLAY_FRAMEWORK.md Part 7.1
 */

import { Card, CardContent } from "@/components/ui/card";
import { FileText, DollarSign, Calendar, Check, X } from "lucide-react";
import { BillingDetailsBoxProps } from "@/types/validation";

export function BillingDetailsBox({ code, amount, type, hasContext }: BillingDetailsBoxProps) {
  return (
    <Card className="bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700">
      <CardContent className="pt-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            <FileText className="w-4 h-4" />
            <span>Détails de facturation</span>
          </div>

          {/* Code */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Code facturé:</span>
            </div>
            <span className="text-sm font-mono font-semibold text-gray-900 dark:text-gray-100">
              {code}
            </span>
          </div>

          {/* Amount */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Montant:</span>
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {amount}
            </span>
          </div>

          {/* Visit Type */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Type de visite:</span>
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {type}
            </span>
          </div>

          {/* Context Status (if provided) */}
          {hasContext !== undefined && (
            <div className="flex items-start justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                {hasContext ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <X className="w-4 h-4 text-red-600" />
                )}
                <span className="text-sm text-gray-600 dark:text-gray-400">Éléments de contexte:</span>
              </div>
              <span className={`text-sm font-semibold ${
                hasContext
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}>
                {hasContext ? "Présents" : "Manquants"}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
