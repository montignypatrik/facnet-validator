/**
 * Calendar Helper Functions
 *
 * Utilities for aggregating validation results into calendar view data
 */

import {
  ValidationResult,
  CalendarDayData,
  DoctorCalendarData,
  CalendarDayStatus,
  OfficeFeeRuleData
} from "../../../types/validation";

/**
 * Type guard to check if rule data is office fee data
 */
function isOfficeFeeData(ruleData: any): ruleData is OfficeFeeRuleData {
  return ruleData && typeof ruleData.date === 'string';
}

/**
 * Aggregate validation results by doctor and date
 */
export function aggregateByDoctorAndDate(results: ValidationResult[]): DoctorCalendarData[] {
  // First, group by doctor
  const byDoctor = new Map<string, ValidationResult[]>();

  for (const result of results) {
    if (!isOfficeFeeData(result.ruleData)) continue;

    const doctor = result.ruleData.doctor || 'Unknown';
    if (!byDoctor.has(doctor)) {
      byDoctor.set(doctor, []);
    }
    byDoctor.get(doctor)!.push(result);
  }

  // Then aggregate each doctor's results by date
  const doctorCalendars: DoctorCalendarData[] = [];

  for (const [doctor, doctorResults] of byDoctor.entries()) {
    const days = aggregateByDate(doctorResults);
    doctorCalendars.push({ doctor, days });
  }

  return doctorCalendars;
}

/**
 * Aggregate validation results by date
 */
export function aggregateByDate(results: ValidationResult[]): CalendarDayData[] {
  const byDate = new Map<string, CalendarDayData>();

  for (const result of results) {
    if (!isOfficeFeeData(result.ruleData)) continue;

    const date = result.ruleData.date;
    if (!date) continue;

    if (!byDate.has(date)) {
      byDate.set(date, {
        date,
        doctor: result.ruleData.doctor || 'Unknown',
        registeredPaidCount: result.ruleData.registeredPaidCount || 0,
        registeredUnpaidCount: result.ruleData.registeredUnpaidCount || 0,
        walkInPaidCount: result.ruleData.walkInPaidCount || 0,
        walkInUnpaidCount: result.ruleData.walkInUnpaidCount || 0,
        totalBilled: result.ruleData.totalAmount || 0,
        potentialGain: 0,
        status: 'none',
        errorCount: 0,
        optimizationCount: 0,
        passCount: 0,
        results: []
      });
    }

    const dayData = byDate.get(date)!;
    dayData.results.push(result);

    // Update counts and status based on severity
    if (result.severity === 'error') {
      dayData.errorCount++;
      dayData.status = 'error'; // Highest priority
    } else if (result.severity === 'optimization') {
      dayData.optimizationCount++;
      dayData.potentialGain += result.monetaryImpact || 0;
      if (dayData.status !== 'error') {
        dayData.status = 'optimization';
      }
    } else if (result.severity === 'info') {
      // Check if this is a "no office fee qualified" scenario
      const scenarioId = result.ruleData?.scenarioId;
      if (scenarioId === 'NO_OFFICE_FEE_QUALIFIED') {
        // Keep status as 'none' (blue) for days that don't qualify for office fees
        // Don't change status
      } else {
        dayData.passCount++;
        if (dayData.status === 'none') {
          dayData.status = 'pass';
        }
      }
    }
  }

  return Array.from(byDate.values());
}

/**
 * Get the status color for a day
 */
export function getStatusColor(status: CalendarDayStatus): string {
  switch (status) {
    case 'error':
      return 'bg-red-500';
    case 'optimization':
      return 'bg-amber-500';
    case 'pass':
      return 'bg-green-500';
    case 'none':
    default:
      return 'bg-blue-500';
  }
}

/**
 * Get the status label for a day
 */
export function getStatusLabel(status: CalendarDayStatus): string {
  switch (status) {
    case 'error':
      return 'Erreur';
    case 'optimization':
      return 'Optimisation';
    case 'pass':
      return 'Réussi';
    case 'none':
    default:
      return 'Aucune activité';
  }
}

/**
 * Generate all days in a month (including empty days)
 */
export function generateMonthDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const days: Date[] = [];

  // Add leading empty days for alignment
  const firstDayOfWeek = firstDay.getDay();
  for (let i = 0; i < firstDayOfWeek; i++) {
    const emptyDay = new Date(year, month, -(firstDayOfWeek - i - 1));
    days.push(emptyDay);
  }

  // Add all days in the month
  for (let day = 1; day <= lastDay.getDate(); day++) {
    days.push(new Date(year, month, day));
  }

  // Add trailing empty days to complete the week
  const lastDayOfWeek = lastDay.getDay();
  for (let i = 1; i < 7 - lastDayOfWeek; i++) {
    days.push(new Date(year, month + 1, i));
  }

  return days;
}

/**
 * Find day data for a specific date
 */
export function findDayData(
  days: CalendarDayData[],
  date: Date
): CalendarDayData | null {
  const dateString = formatDate(date);
  return days.find(d => d.date === dateString) || null;
}

/**
 * Format a date as ISO string (YYYY-MM-DD)
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get the month with most activity from validation results
 */
export function getDefaultMonth(results: ValidationResult[]): Date {
  const dates: Date[] = [];

  for (const result of results) {
    if (!isOfficeFeeData(result.ruleData)) continue;
    if (result.ruleData.date) {
      dates.push(new Date(result.ruleData.date));
    }
  }

  if (dates.length === 0) {
    return new Date(); // Default to current month if no data
  }

  // Return the earliest date
  dates.sort((a, b) => a.getTime() - b.getTime());
  return dates[0];
}

/**
 * Format currency in Canadian dollars
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(amount);
}

/**
 * Get month name in French
 */
export function getMonthName(month: number): string {
  const months = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  return months[month];
}
