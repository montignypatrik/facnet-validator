/**
 * CalendarView Component
 *
 * Main container for calendar-based validation results display
 * Shows one calendar per doctor with daily validation status
 */

import { CalendarViewProps } from "../../types/validation";
import { DoctorCalendar } from "./DoctorCalendar";
import {
  aggregateByDoctorAndDate,
  getDefaultMonth,
} from "./helpers/calendarHelpers";
import { Calendar as CalendarIcon, AlertCircle } from "lucide-react";

export function CalendarView({ results }: CalendarViewProps) {
  // Aggregate results by doctor and date
  const doctorCalendars = aggregateByDoctorAndDate(results);

  // Get default month to display
  const defaultMonth = getDefaultMonth(results);

  // If no results, show empty state
  if (doctorCalendars.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-full p-4 mb-4">
          <CalendarIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Aucune donnée de calendrier
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
          Il n'y a pas de résultats de validation avec des données de date pour afficher dans le calendrier.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
        <CalendarIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Calendrier de validation
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Vue mensuelle des frais de bureau par médecin
          </p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-semibold text-blue-900 dark:text-blue-100">
              Comment utiliser le calendrier
            </h4>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>• Cliquez sur un jour pour voir les détails complets de validation</li>
              <li>• Les couleurs indiquent le statut: Rouge (erreur), Jaune (optimisation), Vert (réussi), Bleu (aucune activité)</li>
              <li>• Chaque jour affiche le nombre de visites et les frais facturés</li>
              <li>• Utilisez les boutons de navigation pour changer de mois</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Doctor Calendars */}
      <div className="space-y-8">
        {doctorCalendars.map((doctorCalendar) => (
          <DoctorCalendar
            key={doctorCalendar.doctor}
            doctor={doctorCalendar.doctor}
            days={doctorCalendar.days}
            currentMonth={defaultMonth}
          />
        ))}
      </div>

      {/* Summary Footer */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {doctorCalendars.length} médecin{doctorCalendars.length > 1 ? 's' : ''} •{' '}
            {doctorCalendars.reduce((sum, dc) => sum + dc.days.length, 0)} jour{doctorCalendars.reduce((sum, dc) => sum + dc.days.length, 0) > 1 ? 's' : ''} avec activité
          </div>
        </div>
      </div>
    </div>
  );
}
