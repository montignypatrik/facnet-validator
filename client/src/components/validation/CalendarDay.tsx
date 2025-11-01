/**
 * CalendarDay Component
 *
 * Individual day cell in the calendar showing visit statistics and validation status
 */

import { CalendarDayProps } from "../../types/validation";
import { getStatusColor, formatCurrency } from "./helpers/calendarHelpers";

export function CalendarDay({ dayData, date, onClick }: CalendarDayProps) {
  const isCurrentMonth = dayData !== null;
  const dayNumber = date.getDate();

  // Empty day (outside current month or no data)
  if (!dayData) {
    return (
      <div className="border border-gray-200 dark:border-gray-700 p-2 h-32 bg-gray-50 dark:bg-gray-800/50">
        <div className="text-sm text-gray-400 dark:text-gray-600">{dayNumber}</div>
      </div>
    );
  }

  // Day with data
  const statusColor = getStatusColor(dayData.status);
  const hasVisits =
    dayData.registeredPaidCount > 0 ||
    dayData.registeredUnpaidCount > 0 ||
    dayData.walkInPaidCount > 0 ||
    dayData.walkInUnpaidCount > 0;

  return (
    <div
      onClick={onClick}
      className={`
        border border-gray-300 dark:border-gray-600 p-2 h-32
        cursor-pointer hover:shadow-lg transition-shadow
        ${dayData.status === 'error' ? 'bg-red-50 dark:bg-red-900/10' : ''}
        ${dayData.status === 'optimization' ? 'bg-amber-50 dark:bg-amber-900/10' : ''}
        ${dayData.status === 'pass' ? 'bg-green-50 dark:bg-green-900/10' : ''}
        ${dayData.status === 'none' ? 'bg-blue-50 dark:bg-blue-900/10' : ''}
      `}
    >
      {/* Day number and status indicator */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
          {dayNumber}
        </div>
        <div className={`w-3 h-3 rounded-full ${statusColor}`} />
      </div>

      {/* Visit statistics */}
      {hasVisits ? (
        <div className="space-y-1 text-xs">
          {/* Registered visits */}
          {(dayData.registeredPaidCount > 0 || dayData.registeredUnpaidCount > 0) && (
            <div className="text-gray-700 dark:text-gray-300">
              <span className="font-semibold text-green-600 dark:text-green-400">
                {dayData.registeredPaidCount}R₊
              </span>
              {dayData.registeredUnpaidCount > 0 && (
                <span className="ml-1 text-gray-500">
                  {dayData.registeredUnpaidCount}R₋
                </span>
              )}
            </div>
          )}

          {/* Walk-in visits */}
          {(dayData.walkInPaidCount > 0 || dayData.walkInUnpaidCount > 0) && (
            <div className="text-gray-700 dark:text-gray-300">
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {dayData.walkInPaidCount}W₊
              </span>
              {dayData.walkInUnpaidCount > 0 && (
                <span className="ml-1 text-gray-500">
                  {dayData.walkInUnpaidCount}W₋
                </span>
              )}
            </div>
          )}

          {/* Total billed */}
          {dayData.totalBilled > 0 && (
            <div className="font-semibold text-gray-900 dark:text-gray-100">
              {formatCurrency(dayData.totalBilled)}
            </div>
          )}

          {/* Potential gain (for optimizations) */}
          {dayData.potentialGain > 0 && (
            <div className="text-amber-600 dark:text-amber-400 font-semibold">
              +{formatCurrency(dayData.potentialGain)}
            </div>
          )}

          {/* Result count badge */}
          {dayData.results.length > 1 && (
            <div className="mt-1">
              <span className="inline-block px-1.5 py-0.5 text-xs rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                {dayData.results.length} résultats
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Aucune activité
        </div>
      )}
    </div>
  );
}
