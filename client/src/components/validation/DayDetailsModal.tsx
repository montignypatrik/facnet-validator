/**
 * DayDetailsModal Component
 *
 * Modal dialog showing detailed validation results for a specific day
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { DayDetailsModalProps } from "../../types/validation";
import { ValidationResultCard } from "./ValidationResultCard";
import { formatCurrency, getStatusLabel } from "./helpers/calendarHelpers";
import { Badge } from "../ui/badge";
import { Calendar, Users, DollarSign } from "lucide-react";

export function DayDetailsModal({ isOpen, onClose, dayData }: DayDetailsModalProps) {
  if (!dayData) return null;

  // Parse the date - add time to prevent timezone shift
  // dayData.date is "YYYY-MM-DD", adding "T00:00:00" makes it parse as local time
  const date = new Date(dayData.date + 'T00:00:00');
  const dateString = date.toLocaleDateString('fr-CA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Calculate total visits
  const totalVisits =
    dayData.registeredPaidCount +
    dayData.registeredUnpaidCount +
    dayData.walkInPaidCount +
    dayData.walkInUnpaidCount;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {dateString}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Doctor */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Médecin:</span>
            <span className="font-semibold">{dayData.doctor}</span>
          </div>

          {/* Summary Statistics */}
          <div className="grid grid-cols-3 gap-4">
            {/* Total Visits */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Visites totales</span>
              </div>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {totalVisits}
              </div>
            </div>

            {/* Total Billed */}
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-700">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Total facturé</span>
              </div>
              <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                {formatCurrency(dayData.totalBilled)}
              </div>
            </div>

            {/* Potential Gain */}
            {dayData.potentialGain > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-700">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Gain potentiel</span>
                </div>
                <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                  +{formatCurrency(dayData.potentialGain)}
                </div>
              </div>
            )}
          </div>

          {/* Visit Statistics Grid */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold mb-3">Détails des visites</h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Registered Patients */}
              <div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  Patients inscrits
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Payées</span>
                    <Badge variant="secondary" className="bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-100">
                      {dayData.registeredPaidCount}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Non payées</span>
                    <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-700">
                      {dayData.registeredUnpaidCount}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Walk-in Patients */}
              <div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  Patients sans rendez-vous
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Payées</span>
                    <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100">
                      {dayData.walkInPaidCount}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Non payées</span>
                    <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-700">
                      {dayData.walkInUnpaidCount}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Validation Status */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Statut:</span>
            <Badge
              variant={
                dayData.status === 'error' ? 'destructive' :
                dayData.status === 'optimization' ? 'default' :
                'secondary'
              }
            >
              {getStatusLabel(dayData.status)}
            </Badge>
            {dayData.errorCount > 0 && (
              <span className="text-sm text-red-600 dark:text-red-400">
                {dayData.errorCount} erreur{dayData.errorCount > 1 ? 's' : ''}
              </span>
            )}
            {dayData.optimizationCount > 0 && (
              <span className="text-sm text-amber-600 dark:text-amber-400">
                {dayData.optimizationCount} optimisation{dayData.optimizationCount > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Validation Results */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">
              Résultats de validation ({dayData.results.length})
            </h3>
            <div className="space-y-3">
              {dayData.results.map((result) => (
                <ValidationResultCard
                  key={result.id}
                  result={result}
                  showDetails={true}
                />
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
