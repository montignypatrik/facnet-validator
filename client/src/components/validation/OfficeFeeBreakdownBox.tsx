import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";

interface FeeWithPatient {
  code: string;
  amount: number;
  idRamq: string;
  paid: number;  // Amount paid by RAMQ
}

interface OfficeFeeBreakdownBoxProps {
  feeBreakdownWithPatients: FeeWithPatient[];
  totalAmount: string;
  maximum: string;
  overage: string;
  patientCount: number;
  likelyDataError?: boolean;  // NEW: indicates all fees are paid (CSV data error)
}

export function OfficeFeeBreakdownBox({
  feeBreakdownWithPatients,
  totalAmount,
  maximum,
  overage,
  patientCount,
  likelyDataError = false
}: OfficeFeeBreakdownBoxProps) {
  return (
    <Card className="bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700">
      <CardContent className="pt-4">
        {/* Data Error Warning Banner */}
        {likelyDataError && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  Anomalie de données détectée
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                  Toutes les facturations sont déjà payées par la RAMQ. Vérifier l'exactitude du fichier CSV.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Frais de Bureau Facturés ({patientCount} patient{patientCount > 1 ? 's' : ''})
          </span>
        </div>

        {/* Fee Breakdown - Each fee with its patient and payment status */}
        <div className="space-y-2 mb-4">
          {feeBreakdownWithPatients.map((fee, idx) => (
            <div
              key={idx}
              className="flex justify-between items-center text-sm border-b border-gray-200 dark:border-gray-700 pb-1"
            >
              <span className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                Code {fee.code} - {fee.idRamq}
                {fee.paid > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs font-medium">
                    <CheckCircle className="w-3 h-3" />
                    PAYÉ
                  </span>
                )}
              </span>
              <span className="font-mono text-gray-900 dark:text-gray-100">
                {fee.amount.toFixed(2).replace('.', ',')}$
              </span>
            </div>
          ))}

          {/* Separator */}
          <div className="border-t-2 border-gray-300 dark:border-gray-600 my-2"></div>

          {/* Total */}
          <div className="flex justify-between text-sm font-semibold">
            <span className="text-gray-700 dark:text-gray-300">
              Total ({patientCount} patient{patientCount > 1 ? 's' : ''}):
            </span>
            <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
              {totalAmount} ❌
            </span>
          </div>

          {/* Maximum */}
          <div className="flex justify-between text-sm">
            <span className="text-gray-700 dark:text-gray-300">Maximum quotidien:</span>
            <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
              {maximum} ✓
            </span>
          </div>

          {/* Overage */}
          <div className="flex justify-between text-sm font-semibold">
            <span className="text-gray-700 dark:text-gray-300">Excédent:</span>
            <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {overage}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
