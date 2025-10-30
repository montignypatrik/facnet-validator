/**
 * TypeScript types for validation result display components
 * Based on VALIDATION_RESULT_DISPLAY_FRAMEWORK.md
 */

// Validation result severity levels
export type ValidationSeverity = "error" | "warning" | "info" | "optimization";

// Validation result category types
export type ValidationCategory =
  | "office-fees"
  | "intervention-clinique"
  | "gmf-forfait"
  | "annual-limit"
  | "revenue-optimization"
  | "context-validation"
  | "code-compatibility"
  | "establishment-validation"
  | "temporal-validation"
  | "amount-validation";

// Base validation result type (from database with runtime enhancements)
export interface ValidationResult {
  // Identity
  id: string;
  validationRunId: string;
  ruleId: string;

  // Classification
  severity: ValidationSeverity;
  category: string;

  // Core Message
  message: string;
  solution: string | null;

  // Record Association
  billingRecordId: string | null;
  affectedRecords: string[];
  idRamq: string;

  // Rule-Specific Data
  ruleData: RuleData;

  // Metadata (added at runtime)
  monetaryImpact: number;  // Always a number
  ruleName: string;        // French display name

  // Timestamps
  createdAt: string;
}

// Base rule data structure (all rules should include these)
export interface BaseRuleData {
  monetaryImpact: number;  // Canonical financial impact field
  doctor?: string;         // Redacted doctor info
  patient?: string;        // Redacted patient info
  date?: string;           // ISO date (YYYY-MM-DD)
  affectedInvoices?: string[];
}

// Office fee rule data
export interface OfficeFeeRuleData extends BaseRuleData {
  code: string;
  billedCode?: string;
  billedAmount?: string;
  hasContext?: boolean;
  registeredPaidCount?: number;
  registeredUnpaidCount?: number;
  walkInPaidCount?: number;
  walkInUnpaidCount?: number;
  required?: number;
  actual?: number;
  currentCode?: string;
  suggestedCode?: string;
  currentAmount?: number;
  expectedAmount?: number;
  potentialRevenue?: number;
  // E5 daily maximum error fields
  affectedRamqIds?: string[];
  feeBreakdownWithPatients?: any;
  // O1, O2 optimization fields
  affectedRecordsDetails?: Array<{
    id: string;
    ids?: string[]; // All record IDs if duplicate
    idRamq: string;
    date: string;
    code: string;
    amount: number;
    paid: number;
    count?: number; // Number of duplicate records
    isDuplicate?: boolean; // True if count > 1
    totalAmount?: number; // Total amount for all duplicates
  }>;
  totalAmount?: string;
  maximum?: string;
  overage?: string;
  patientCount?: number;
  likelyDataError?: boolean;
}

// Intervention clinique rule data
export interface InterventionCliniqueRuleData extends BaseRuleData {
  totalMinutes?: number;
  excessMinutes?: number;
  interventionCount?: number;
  paidCount?: number;
  unpaidCount?: number;
  totalAmount?: string;
  unpaidAmount?: string;
  limitViolations?: number;
}

// GMF forfait rule data
export interface GmfForfaitRuleData extends BaseRuleData {
  patient: string;
  year: number;
  totalCount?: number;
  paidCount?: number;
  firstPaidDate?: string;
  visitCount?: number;
  firstVisitDate?: string;
  potentialRevenue?: number;
  gmfEstablishments?: string[];
}

// Annual limit rule data
export interface AnnualLimitRuleData extends BaseRuleData {
  patientYear: string;
  patient: string;
  year: number;
  code: string;
  totalCount: number;
  paidCount?: number;
  unpaidCount?: number;
  billingDates?: string[];
  dates?: string[];
  amounts?: number[];
  // E1 scenario fields
  totalPaidAmount?: number;
  // E2 scenario fields - one paid + unpaid billings
  paidIdRamq?: string;
  paidDate?: string;
  paidAmount?: number;
  unpaidIdRamqs?: string[];
  unpaidDates?: string[];
  unpaidAmounts?: number[];
  // E3 scenario fields - all unpaid billings
  totalUnpaidAmount?: number;
  tariffValue?: number;
}

// Union type for all rule data
export type RuleData =
  | OfficeFeeRuleData
  | InterventionCliniqueRuleData
  | GmfForfaitRuleData
  | AnnualLimitRuleData
  | BaseRuleData;

// Severity styling configuration
export interface SeverityStyle {
  border: string;
  background: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  badge: string;
}

// Component props types
export interface ValidationResultCardProps {
  result: ValidationResult;
  showDetails?: boolean;
}

export interface MonetaryImpactBadgeProps {
  amount: number;
  size?: "sm" | "md" | "lg";
}

export interface BillingDetailsBoxProps {
  code: string;
  amount: string;
  type: string;
  hasContext?: boolean;
}

export interface VisitStatisticsBoxProps {
  registeredPaid: number;
  registeredUnpaid: number;
  walkinPaid: number;
  walkinUnpaid: number;
}

export interface SolutionBoxProps {
  solution: string;
  severity: ValidationSeverity;
}

// Calendar view types
export type CalendarDayStatus = "none" | "pass" | "optimization" | "error";

export interface CalendarDayData {
  date: string; // ISO date string (YYYY-MM-DD)
  doctor: string; // Redacted doctor name

  // Visit counts
  registeredPaidCount: number;
  registeredUnpaidCount: number;
  walkInPaidCount: number;
  walkInUnpaidCount: number;

  // Financial summary
  totalBilled: number; // Total office fees billed
  potentialGain: number; // Sum of optimization gains

  // Validation summary
  status: CalendarDayStatus;
  errorCount: number;
  optimizationCount: number;
  passCount: number;

  // Detailed results (for modal)
  results: ValidationResult[];
}

export interface DoctorCalendarData {
  doctor: string;
  days: CalendarDayData[];
}

export interface CalendarViewProps {
  results: ValidationResult[];
}

export interface DoctorCalendarProps {
  doctor: string;
  days: CalendarDayData[];
  currentMonth: Date;
}

export interface CalendarDayProps {
  dayData: CalendarDayData | null; // null for empty days
  date: Date;
  onClick: () => void;
}

export interface DayDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  dayData: CalendarDayData | null;
}
