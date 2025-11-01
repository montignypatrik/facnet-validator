/**
 * DoctorCalendar Component
 *
 * Displays a calendar grid for a single doctor showing daily validation results
 */

import { useState } from "react";
import { DoctorCalendarProps } from "../../types/validation";
import { CalendarDay } from "./CalendarDay";
import { DayDetailsModal } from "./DayDetailsModal";
import {
  generateMonthDays,
  findDayData,
  getMonthName,
} from "./helpers/calendarHelpers";
import { ChevronLeft, ChevronRight, User } from "lucide-react";
import { Button } from "../ui/button";

export function DoctorCalendar({ doctor, days, currentMonth }: DoctorCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewMonth, setViewMonth] = useState<Date>(currentMonth);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();

  // Generate all days for the current month
  const monthDays = generateMonthDays(year, month);

  // Handle day click
  const handleDayClick = (date: Date) => {
    const dayData = findDayData(days, date);
    if (dayData) {
      setSelectedDate(date);
    }
  };

  // Navigate to previous month
  const handlePrevMonth = () => {
    setViewMonth(new Date(year, month - 1, 1));
  };

  // Navigate to next month
  const handleNextMonth = () => {
    setViewMonth(new Date(year, month + 1, 1));
  };

  // Get selected day data for modal
  const selectedDayData = selectedDate ? findDayData(days, selectedDate) : null;

  // Week day names
  const weekDays = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      {/* Doctor Header */}
      <div className="flex items-center gap-2 mb-4">
        <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {doctor}
        </h3>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrevMonth}
          className="gap-1"
        >
          <ChevronLeft className="w-4 h-4" />
          Précédent
        </Button>
        <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {getMonthName(month)} {year}
        </h4>
        <Button
          variant="outline"
          size="sm"
          onClick={handleNextMonth}
          className="gap-1"
        >
          Suivant
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
        {/* Week day headers */}
        <div className="grid grid-cols-7 bg-gray-100 dark:bg-gray-800">
          {weekDays.map((day) => (
            <div
              key={day}
              className="p-2 text-center text-sm font-semibold text-gray-700 dark:text-gray-300 border-r border-gray-300 dark:border-gray-600 last:border-r-0"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7">
          {monthDays.map((date, index) => {
            const isCurrentMonth = date.getMonth() === month;
            const dayData = isCurrentMonth ? findDayData(days, date) : null;

            return (
              <CalendarDay
                key={index}
                dayData={dayData}
                date={date}
                onClick={() => handleDayClick(date)}
              />
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-gray-700 dark:text-gray-300">Erreur</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-gray-700 dark:text-gray-300">Optimisation</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-gray-700 dark:text-gray-300">Réussi</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-gray-700 dark:text-gray-300">Aucune activité</span>
        </div>
      </div>

      {/* Day Details Modal */}
      <DayDetailsModal
        isOpen={selectedDate !== null}
        onClose={() => setSelectedDate(null)}
        dayData={selectedDayData}
      />
    </div>
  );
}
