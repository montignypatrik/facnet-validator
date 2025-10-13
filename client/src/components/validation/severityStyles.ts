/**
 * Severity styling configuration for validation results
 * Based on VALIDATION_RESULT_DISPLAY_FRAMEWORK.md Part 4.2
 */

import { XCircle, AlertTriangle, CheckCircle, TrendingUp, type LucideIcon } from "lucide-react";
import { ValidationSeverity } from "@/types/validation";

export interface SeverityStyleConfig {
  border: string;
  background: string;
  icon: LucideIcon;
  iconColor: string;
  badge: string;
  headerText: string;
}

export const SEVERITY_STYLES: Record<ValidationSeverity, SeverityStyleConfig> = {
  error: {
    border: "border-red-500",
    background: "bg-red-50 dark:bg-red-950/20",
    icon: XCircle,
    iconColor: "text-red-600",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-300 dark:border-red-700",
    headerText: "text-red-900 dark:text-red-100",
  },
  warning: {
    border: "border-yellow-500",
    background: "bg-yellow-50 dark:bg-yellow-950/20",
    icon: AlertTriangle,
    iconColor: "text-yellow-600",
    badge: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700",
    headerText: "text-yellow-900 dark:text-yellow-100",
  },
  optimization: {
    border: "border-amber-500",
    background: "bg-amber-50 dark:bg-amber-950/20",
    icon: TrendingUp,
    iconColor: "text-amber-600",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300 dark:border-amber-700",
    headerText: "text-amber-900 dark:text-amber-100",
  },
  info: {
    border: "border-blue-500",
    background: "bg-blue-50 dark:bg-blue-950/20",
    icon: CheckCircle,
    iconColor: "text-blue-600",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300 dark:border-blue-700",
    headerText: "text-blue-900 dark:text-blue-100",
  },
};

/**
 * Get styling configuration for a given severity level
 */
export function getSeverityStyle(severity: ValidationSeverity): SeverityStyleConfig {
  return SEVERITY_STYLES[severity] || SEVERITY_STYLES.info;
}

/**
 * Format currency in Quebec French format (32,10$)
 */
export function formatCurrency(amount: number): string {
  return amount.toFixed(2).replace('.', ',') + '$';
}

/**
 * Get French display name for rule category
 */
export function getCategoryDisplayName(category: string): string {
  const categoryNames: Record<string, string> = {
    'office_fees': 'Frais de cabinet',
    'intervention-clinique': 'Interventions cliniques',
    'gmf-forfait': 'GMF forfait',
    'annual-limit': 'Limites annuelles',
    'revenue-optimization': 'Optimisation de revenus',
    'context-validation': 'Validation de contexte',
    'code-compatibility': 'Compatibilité des codes',
    'establishment-validation': 'Validation d\'établissement',
    'temporal-validation': 'Validation temporelle',
    'amount-validation': 'Validation des montants',
  };

  return categoryNames[category] || category;
}

/**
 * Get French display name for common rule names
 * Fallback to English name if no translation available
 */
export function getRuleDisplayName(ruleName: string): string {
  const ruleNames: Record<string, string> = {
    'Office Fee Validation (19928/19929)': 'Frais de cabinet (19928/19929)',
    'Intervention Clinique Validation': 'Validation interventions cliniques',
    'GMF Forfait 8875': 'GMF forfait 8875',
    'Annual Billing Code Limit': 'Limite annuelle de facturation',
    'Visit Duration Optimization': 'Optimisation durée de visite',
  };

  return ruleNames[ruleName] || ruleName;
}
