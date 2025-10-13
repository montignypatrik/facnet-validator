/**
 * VisitStatisticsGrid - Display patient visit counts in a grid layout
 * Based on VALIDATION_RESULT_DISPLAY_FRAMEWORK.md Part 7.2
 */

import { Card, CardContent } from "@/components/ui/card";
import { Users, UserCheck, UserX } from "lucide-react";
import { VisitStatisticsBoxProps } from "@/types/validation";

export function VisitStatisticsGrid({
  registeredPaid,
  registeredUnpaid,
  walkinPaid,
  walkinUnpaid,
}: VisitStatisticsBoxProps) {
  const total = registeredPaid + registeredUnpaid + walkinPaid + walkinUnpaid;

  return (
    <Card className="bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700">
      <CardContent className="pt-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            <Users className="w-4 h-4" />
            <span>Statistiques de visites</span>
            <span className="ml-auto text-gray-900 dark:text-gray-100">Total: {total}</span>
          </div>

          {/* Statistics Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Registered - Paid */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-1">
                <UserCheck className="w-4 h-4 text-green-600" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Inscrits payés</span>
              </div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {registeredPaid}
              </div>
            </div>

            {/* Registered - Unpaid */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-1">
                <UserX className="w-4 h-4 text-red-600" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Inscrits non payés</span>
              </div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {registeredUnpaid}
              </div>
            </div>

            {/* Walk-in - Paid */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-1">
                <UserCheck className="w-4 h-4 text-green-600" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Sans RDV payés</span>
              </div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {walkinPaid}
              </div>
            </div>

            {/* Walk-in - Unpaid */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-1">
                <UserX className="w-4 h-4 text-red-600" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Sans RDV non payés</span>
              </div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {walkinUnpaid}
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
              <span>Total inscrits: {registeredPaid + registeredUnpaid}</span>
              <span>Total sans RDV: {walkinPaid + walkinUnpaid}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-1">
              <span>Total payés: {registeredPaid + walkinPaid}</span>
              <span>Total non payés: {registeredUnpaid + walkinUnpaid}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
