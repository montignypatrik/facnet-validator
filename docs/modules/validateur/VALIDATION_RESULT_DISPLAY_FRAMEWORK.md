# Framework for Validation Result Display

**Version:** 1.0
**Date:** 2025-01-13
**Status:** Proposed Standard

---

## Executive Summary

This document establishes a standardized framework for how validation results are structured, stored, and displayed in the RAMQ billing validation system. The goal is to ensure consistency across all validation rules and provide billing employees with all necessary information to correct errors efficiently.

### Key Problems Addressed
1. Inconsistent data types and field names across rules
2. Variable information density in error messages
3. Mixed language display (French/English)
4. Unpredictable UI rendering based on rule type
5. Lack of standard template for new rule development

---

## Part 1: Data Structure Standards

### 1.1 Core Result Schema (Database)

All validation results MUST include these fields:

```typescript
interface ValidationResult {
  // Identity
  id: string;                    // UUID
  validationRunId: string;       // UUID
  ruleId: string;                // Kebab-case identifier (e.g., "office-fee-validation")

  // Classification
  severity: "error" | "warning" | "info" | "optimization";
  category: string;              // Kebab-case (e.g., "office-fees", "gmf-forfait")

  // Core Message
  message: string;               // French, user-facing, complete sentence
  solution: string | null;       // French, specific action, or null for info

  // Record Association
  billingRecordId: string | null;  // Primary affected record
  affectedRecords: string[];       // All involved records
  idRamq: string;                  // For grouping by invoice

  // Rule-Specific Data
  ruleData: RuleDataObject;      // Typed per rule category

  // Timestamps
  createdAt: Date;
}
```

### 1.2 Extended Result (Runtime)

When retrieved from storage layer, results are enhanced:

```typescript
interface ValidationResultWithMetadata extends ValidationResult {
  monetaryImpact: number;      // ALWAYS a number, calculated from ruleData
  ruleName: string;            // French display name from registry
}
```

### 1.3 Standard RuleData Structure

**REQUIRED fields in ALL ruleData objects:**

```typescript
interface BaseRuleData {
  monetaryImpact: number;      // ALWAYS number, NEVER string
                               // Positive = gain, Negative = loss, Zero = neutral

  // Contextual identifiers (redacted if PHI enabled)
  doctor?: string;             // When doctor-specific
  patient?: string;            // When patient-specific
  date?: string;               // ISO date (YYYY-MM-DD)

  // Affected entities
  affectedInvoices?: string[]; // RAMQ IDs
}
```

**STANDARD field naming conventions:**

```typescript
interface RuleDataConventions {
  // Financial fields - ALWAYS numbers
  monetaryImpact: number;           // The canonical monetary value
  currentAmount?: number;           // What was billed
  expectedAmount?: number;          // What should be billed
  potentialRevenue?: number;        // Future opportunity
  unpaidAmount?: number;            // Revenue at risk

  // Codes and identifiers
  code?: string;                    // Primary billing code
  currentCode?: string;             // Code that was used
  suggestedCode?: string;           // Code that should be used
  suggestedCodes?: string[];        // Multiple alternatives

  // Counts and metrics
  totalCount?: number;              // Total items
  validCount?: number;              // Valid items
  invalidCount?: number;            // Invalid items
  requiredCount?: number;           // Minimum required
  actualCount?: number;             // Actual found

  // Thresholds and limits
  limit?: number;                   // Maximum allowed
  threshold?: number;               // Minimum required
  exceeded?: number;                // Amount over limit

  // Dates and times
  date?: string;                    // ISO date (YYYY-MM-DD)
  year?: number;                    // Calendar year
  startTime?: string;               // HH:MM format
  endTime?: string;                 // HH:MM format
  duration?: number;                // Minutes or units
}
```

**PROHIBITED patterns:**

```typescript
// ❌ DO NOT USE:
monetaryImpact: "32.10"           // String - use number instead
gain: 32.10                       // Duplicate - use monetaryImpact
potentialRevenue: "64.20"         // String - use number
revenue: 100                      // Ambiguous - use monetaryImpact

// ✅ USE INSTEAD:
monetaryImpact: 32.10             // Number, canonical field
```

---

## Part 2: Severity Level Standards

### 2.1 Severity Definitions

| Severity | Purpose | Monetary Impact | Solution Required | User Action |
|----------|---------|----------------|-------------------|-------------|
| **error** | RAMQ regulation violation that will cause claim rejection | Usually 0 or negative (revenue at risk) | REQUIRED | MUST fix before submission |
| **warning** | Potential issue requiring review | Variable | OPTIONAL | SHOULD review |
| **optimization** | Legitimate revenue opportunity being missed | ALWAYS positive (gain) | REQUIRED | SHOULD implement |
| **info** | Successful validation or summary statistics | Variable or N/A | N/A | No action needed |

### 2.2 Severity-Specific Requirements

#### Errors
```typescript
{
  severity: "error",
  monetaryImpact: 0 | negative,      // 0 if unpaid, negative if revenue at risk
  solution: string,                  // REQUIRED - specific fix action
  message: string,                   // Must explain what rule was violated
  ruleData: {
    monetaryImpact: number,          // MUST be present
    reason: string,                  // Why it's an error
    expected: any,                   // What was expected
    actual: any,                     // What was found
  }
}
```

#### Warnings
```typescript
{
  severity: "warning",
  monetaryImpact: number,            // Any value
  solution: string | null,           // OPTIONAL
  message: string,                   // Must explain the concern
  ruleData: {
    monetaryImpact: number,
    riskLevel?: "low" | "medium" | "high",
  }
}
```

#### Optimizations
```typescript
{
  severity: "optimization",
  monetaryImpact: number,            // MUST be positive
  solution: string,                  // REQUIRED - specific action
  message: string,                   // Must explain the opportunity
  ruleData: {
    monetaryImpact: number,          // MUST be positive
    currentCode?: string,            // What was billed
    suggestedCode?: string,          // What should be billed
    currentAmount?: number,          // Current revenue
    expectedAmount?: number,         // Potential revenue
  }
}
```

#### Info
```typescript
{
  severity: "info",
  monetaryImpact: number | 0,        // Summary amounts or 0
  solution: null,                    // ALWAYS null
  message: string,                   // Summary or success message
  ruleData: {
    monetaryImpact: number,          // Total processed, or 0
    // Summary statistics
  }
}
```

---

## Part 3: Message Templates

### 3.1 Message Structure Standard

All messages MUST follow this pattern:

```
[CONTEXT] + [PROBLEM/OBSERVATION] + [IMPACT]
```

**Examples:**

✅ **Error:**
```
"Code 19929 (avec rendez-vous) nécessite minimum 12 patients avec rendez-vous
mais seulement 8 trouvé(s) pour Dr. Smith le 2025-02-05"

Context: Code 19929 (avec rendez-vous)
Problem: nécessite minimum 12 patients mais seulement 8 trouvé(s)
Impact: (implied - claim will be rejected)
```

✅ **Optimization:**
```
"Optimisation de revenus: Dr. Smith a vu 15 patients avec rendez-vous le 2025-02-05
et a facturé 19928 (32,10$), mais pourrait facturer 19929 (64,20$)"

Context: Dr. Smith le 2025-02-05
Observation: a vu 15 patients et facturé 19928
Impact: pourrait facturer 19929 pour 64,20$ (gain de 32,10$)
```

✅ **Info:**
```
"Validation interventions cliniques complétée: 25 intervention(s) facturée(s)
(20 payée(s)) pour 450 minutes totales. Montant: 375,50$"

Context: Validation interventions cliniques
Observation: 25 facturées, 20 payées, 450 minutes
Impact: Montant total 375,50$
```

### 3.2 Solution Structure Standard

Solutions MUST be:
1. **Specific** - Tell exactly what to do
2. **Actionable** - User can complete without additional research
3. **Complete** - Include all necessary details (codes, amounts, conditions)

**Template:**

```
[ACTION VERB] + [SPECIFIC CHANGE] + [CONDITION/CONTEXT]
```

**Examples:**

✅ **Good Solutions:**
```
"Facturer 19929 au lieu de 19928 pour un gain de 32,10$"
(Action: Facturer, Change: 19929 au lieu de 19928, Context: gain de 32,10$)

"Ajouter le contexte #G160 ou #AR pour que cette réclamation soit payée"
(Action: Ajouter, Change: #G160 ou #AR, Context: pour que réclamation soit payée)

"Annuler 2 facturation(s) excédentaire(s) du code 08481. Maximum 1 fois/an"
(Action: Annuler, Change: 2 facturations du code 08481, Context: Maximum 1 fois/an)
```

❌ **Bad Solutions:**
```
"Vérifier le code"                    // Too vague
"Corriger cette erreur"               // Not specific
"Voir le manuel RAMQ"                 // Not actionable
"Peut-être changer pour 19929"        // Uncertain
```

### 3.3 Language Standards

**REQUIRED:**
- All `message` fields in French
- All `solution` fields in French
- All `ruleName` in French
- Use Quebec French conventions (facturé, facturation, montant, etc.)

**PROHIBITED:**
- English in user-facing fields
- Mixed language in same message
- Technical jargon without explanation

**Currency formatting:**
- Use comma as decimal separator: `32,10$` (not `32.10$`)
- Dollar sign after amount: `32,10$` (not `$32.10`)
- Always 2 decimal places for amounts

---

## Part 4: Display Standards

### 4.1 Information Hierarchy

**Level 1 - Always Visible (Header):**
1. Rule name (French, bold)
2. Monetary impact badge (if non-zero)
3. Severity icon
4. RAMQ ID grouping

**Level 2 - Primary Content:**
5. Error/optimization message
6. Solution/action (if applicable)

**Level 3 - Expandable Details:**
7. Current billing details
8. Visit/patient statistics
9. Code comparisons
10. Temporal information (dates, times)

**Level 4 - Technical (Optional):**
11. Affected record IDs
12. Rule category
13. Full ruleData JSON

### 4.2 Visual Standards

#### Color Coding
```typescript
const SEVERITY_STYLES = {
  error: {
    border: "border-red-500",
    background: "bg-red-50 dark:bg-red-950",
    icon: "XCircle",
    iconColor: "text-red-500",
    badge: "bg-red-100 text-red-700"
  },
  warning: {
    border: "border-yellow-500",
    background: "bg-yellow-50 dark:bg-yellow-950",
    icon: "AlertTriangle",
    iconColor: "text-yellow-500",
    badge: "bg-yellow-100 text-yellow-700"
  },
  optimization: {
    border: "border-amber-500",
    background: "bg-amber-50 dark:bg-amber-950",
    icon: "TrendingUp",
    iconColor: "text-amber-500",
    badge: "bg-amber-100 text-amber-700"
  },
  info: {
    border: "border-blue-500",
    background: "bg-blue-50 dark:bg-blue-950",
    icon: "CheckCircle",
    iconColor: "text-blue-500",
    badge: "bg-blue-100 text-blue-700"
  }
};
```

#### Monetary Impact Badge
```typescript
const MONETARY_BADGE_STYLES = {
  positive: {
    // Gain/opportunity
    background: "bg-green-100 dark:bg-green-900",
    text: "text-green-700 dark:text-green-300",
    icon: "TrendingUp",
    prefix: "Gain: "
  },
  negative: {
    // Loss/risk
    background: "bg-red-100 dark:bg-red-900",
    text: "text-red-700 dark:text-red-300",
    icon: "TrendingDown",
    prefix: "Perte: "
  },
  neutral: {
    // Zero impact
    background: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-700 dark:text-gray-300",
    icon: "Minus",
    prefix: "Impact: "
  }
};

// Display format
function formatMonetaryImpact(amount: number): string {
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toFixed(2).replace('.', ',');

  if (amount > 0) return `Gain: ${formatted}$`;
  if (amount < 0) return `Perte: ${formatted}$`;
  return `Impact: ${formatted}$`;
}
```

### 4.3 Component Structure Standard

Every validation result card MUST have:

```tsx
<ValidationResultCard>
  {/* Header - Always visible */}
  <CardHeader>
    <SeverityIcon />
    <RuleName />
    <MonetaryImpactBadge />
    <ExpandButton />
  </CardHeader>

  {/* Primary content - Always visible */}
  <CardContent>
    <Message />
    {solution && <SolutionBox />}
  </CardContent>

  {/* Details - Expandable */}
  <CardDetails expanded={isExpanded}>
    <CurrentBillingDetails />
    <StatisticsGrid />
    <TemporalInformation />
  </CardDetails>

  {/* Technical - Collapsed by default */}
  <CardTechnical expanded={showTechnical}>
    <AffectedRecordsList />
    <RuleDataJson />
  </CardTechnical>
</ValidationResultCard>
```

### 4.4 Grouping and Sorting

**Primary grouping:** By severity
```
1. Errors (must fix)
2. Warnings (should review)
3. Optimizations (revenue opportunities)
4. Info (summaries)
```

**Secondary grouping:** By RAMQ ID
```
Within each severity, group by idRamq for workflow efficiency
```

**Sorting within groups:**
```
1. By monetary impact (highest first)
2. By date (most recent first)
3. By rule name (alphabetical)
```

---

## Part 5: Rule Development Template

### 5.1 New Rule Checklist

When creating a new validation rule, use this checklist:

- [ ] Rule ID follows kebab-case convention
- [ ] Rule name in French for display
- [ ] Category assigned from standard list
- [ ] All results include `monetaryImpact` as NUMBER
- [ ] Error messages follow template structure
- [ ] Solutions are specific and actionable
- [ ] All currency uses Quebec French format (32,10$)
- [ ] ruleData follows standard field naming
- [ ] No duplicate fields (gain/potentialRevenue/monetaryImpact)
- [ ] PHI fields properly redacted
- [ ] Tests cover all severity paths
- [ ] Documentation updated in RULES_INDEX.md

### 5.2 Rule Result Factory Pattern

```typescript
class ValidationResultBuilder {
  private result: Partial<ValidationResult> = {};

  constructor(
    private ruleId: string,
    private validationRunId: string,
    private category: string
  ) {
    this.result.ruleId = ruleId;
    this.result.validationRunId = validationRunId;
    this.result.category = category;
    this.result.createdAt = new Date();
  }

  /**
   * Create an error result
   */
  error(params: {
    message: string;
    solution: string;
    monetaryImpact?: number;  // Defaults to 0
    billingRecordId?: string;
    affectedRecords: string[];
    idRamq: string;
    ruleData: Record<string, any>;
  }): ValidationResult {
    return {
      ...this.result,
      severity: "error",
      monetaryImpact: params.monetaryImpact ?? 0,
      ...params,
      ruleData: {
        ...params.ruleData,
        monetaryImpact: params.monetaryImpact ?? 0  // Ensure in ruleData
      }
    } as ValidationResult;
  }

  /**
   * Create an optimization result
   */
  optimization(params: {
    message: string;
    solution: string;
    monetaryImpact: number;    // REQUIRED, must be > 0
    billingRecordId?: string;
    affectedRecords: string[];
    idRamq: string;
    ruleData: Record<string, any>;
  }): ValidationResult {
    if (params.monetaryImpact <= 0) {
      throw new Error("Optimization monetaryImpact must be positive");
    }

    return {
      ...this.result,
      severity: "optimization",
      ...params,
      ruleData: {
        ...params.ruleData,
        monetaryImpact: params.monetaryImpact  // Ensure in ruleData
      }
    } as ValidationResult;
  }

  /**
   * Create an info result
   */
  info(params: {
    message: string;
    monetaryImpact?: number;   // Optional, for summaries
    affectedRecords: string[];
    idRamq: string;
    ruleData: Record<string, any>;
  }): ValidationResult {
    return {
      ...this.result,
      severity: "info",
      solution: null,  // Always null for info
      billingRecordId: null,
      monetaryImpact: params.monetaryImpact ?? 0,
      ...params,
      ruleData: {
        ...params.ruleData,
        monetaryImpact: params.monetaryImpact ?? 0
      }
    } as ValidationResult;
  }

  /**
   * Create a warning result
   */
  warning(params: {
    message: string;
    solution?: string;
    monetaryImpact?: number;
    billingRecordId?: string;
    affectedRecords: string[];
    idRamq: string;
    ruleData: Record<string, any>;
  }): ValidationResult {
    return {
      ...this.result,
      severity: "warning",
      monetaryImpact: params.monetaryImpact ?? 0,
      ...params,
      ruleData: {
        ...params.ruleData,
        monetaryImpact: params.monetaryImpact ?? 0
      }
    } as ValidationResult;
  }
}

// Usage example
const builder = new ValidationResultBuilder(
  "office-fee-validation",
  runId,
  "office-fees"
);

const errorResult = builder.error({
  message: "Code 19929 nécessite minimum 12 patients avec rendez-vous mais seulement 8 trouvé(s)",
  solution: "Facturer 19928 au lieu de 19929 ou ajouter des patients",
  monetaryImpact: 0,
  affectedRecords: [recordId],
  idRamq: invoice.idRamq,
  ruleData: {
    code: "19929",
    required: 12,
    actual: 8,
    doctor: "Dr. Smith",
    date: "2025-02-05"
  }
});
```

---

## Part 6: Standard Rule Categories

### 6.1 Official Category List

All rules MUST use one of these categories:

| Category | Description | Example Rules |
|----------|-------------|---------------|
| `office-fees` | Office fee codes (19928/19929) | Daily maximum, patient count requirements |
| `intervention-clinique` | Intervention clinique (8857/8859) | 180-minute daily limit |
| `gmf-forfait` | GMF forfait (8875) | Annual limit, eligibility |
| `annual-limit` | Annual billing limits | Once-per-year codes |
| `revenue-optimization` | Visit duration optimization | Intervention vs consultation |
| `context-validation` | Context element requirements | Missing #G160, MTA13 exclusions |
| `code-compatibility` | Code combination rules | Incompatible code pairs |
| `establishment-validation` | Establishment restrictions | GMF vs non-GMF locations |
| `temporal-validation` | Date/time rules | Service date requirements |
| `amount-validation` | Amount calculations | Incorrect montant values |

### 6.2 Adding New Categories

To add a new category:
1. Propose in docs/modules/validateur/RULES_INDEX.md
2. Update this document
3. Update category type definitions in shared/schema.ts
4. Update UI filtering in RunDetails.tsx

---

## Part 7: Standard Detail Boxes

### 7.1 Billing Details Box

**When to show:** Errors and optimizations involving specific billing codes

```tsx
<BillingDetailsBox>
  <Label>Code facturé</Label>
  <Value>{ruleData.code}</Value>

  <Label>Montant</Label>
  <Value>{formatCurrency(ruleData.currentAmount)}</Value>

  <Label>Type</Label>
  <Value>{ruleData.type}</Value>

  {ruleData.context && (
    <>
      <Label>Contexte</Label>
      <Value>{ruleData.context || "Aucun"}</Value>
    </>
  )}
</BillingDetailsBox>
```

### 7.2 Visit Statistics Box

**When to show:** Office fee and intervention clinique rules

```tsx
<VisitStatisticsGrid>
  <StatCard label="Inscrits payés" value={ruleData.registeredPaid} />
  <StatCard label="Inscrits non payés" value={ruleData.registeredUnpaid} />
  <StatCard label="Sans RDV payés" value={ruleData.walkinPaid} />
  <StatCard label="Sans RDV non payés" value={ruleData.walkinUnpaid} />
</VisitStatisticsGrid>
```

### 7.3 Temporal Information Box

**When to show:** Date-sensitive or time-duration rules

```tsx
<TemporalInfoBox>
  <Label>Date de service</Label>
  <Value>{formatDate(ruleData.date)}</Value>

  {ruleData.startTime && (
    <>
      <Label>Début</Label>
      <Value>{ruleData.startTime}</Value>

      <Label>Fin</Label>
      <Value>{ruleData.endTime}</Value>

      <Label>Durée</Label>
      <Value>{ruleData.duration} minutes</Value>
    </>
  )}
</TemporalInfoBox>
```

### 7.4 Comparison Box

**When to show:** Optimizations showing current vs suggested

```tsx
<ComparisonBox>
  <CurrentState>
    <Label>État actuel</Label>
    <Code>{ruleData.currentCode}</Code>
    <Amount>{formatCurrency(ruleData.currentAmount)}</Amount>
  </CurrentState>

  <Arrow>→</Arrow>

  <SuggestedState>
    <Label>Suggestion</Label>
    <Code>{ruleData.suggestedCode}</Code>
    <Amount>{formatCurrency(ruleData.expectedAmount)}</Amount>
  </SuggestedState>

  <Gain>
    <Label>Gain</Label>
    <Amount className="text-green-600">
      +{formatCurrency(ruleData.monetaryImpact)}
    </Amount>
  </Gain>
</ComparisonBox>
```

---

## Part 8: Migration Plan

### 8.1 Existing Rules to Update

**Priority 1 - Data Structure (Breaking Changes):**
- [ ] officeFeeRule.ts - Change monetaryImpact to number in ruleData
- [ ] interventionCliniqueRule.ts - Change monetaryImpact to number
- [ ] gmfForfait8875Rule.ts - Use monetaryImpact (number) instead of potentialRevenue
- [ ] visitDurationOptimizationRule.ts - Remove duplicate gain/potentialRevenue fields
- [ ] annualBillingCodeRule.ts - Add monetaryImpact: 0 to errors

**Priority 2 - Message Standardization:**
- [ ] All rules - Ensure messages follow template structure
- [ ] All rules - Ensure solutions are specific and actionable
- [ ] All rules - Use Quebec French currency format (32,10$)

**Priority 3 - Rule Names:**
- [ ] Update rule registry with French display names
- [ ] Remove hardcoded translation in RunDetails.tsx

### 8.2 Database Migration

```sql
-- No schema changes required
-- monetaryImpact is calculated at runtime in storage.ts

-- However, recommend adding a validation constraint:
ALTER TABLE validation_results
ADD CONSTRAINT check_optimization_has_positive_impact
CHECK (
  severity != 'optimization' OR
  (ruleData->>'monetaryImpact')::numeric > 0
);
```

### 8.3 UI Components to Create

**New reusable components:**
- [ ] `ValidationResultCard` - Base card component
- [ ] `SeverityBadge` - Consistent severity display
- [ ] `MonetaryImpactBadge` - Consistent financial display
- [ ] `BillingDetailsBox` - Reusable billing info
- [ ] `VisitStatisticsGrid` - Reusable visit counts
- [ ] `TemporalInfoBox` - Reusable date/time display
- [ ] `ComparisonBox` - Reusable before/after comparison
- [ ] `SolutionBox` - Reusable solution display

### 8.4 Backward Compatibility

During migration:
1. **storage.ts** already handles string-to-number conversion
2. Keep fallback logic for old field names (gain, potentialRevenue)
3. Add deprecation warnings in development mode
4. Plan cutover date after all rules updated

---

## Part 9: Quality Assurance

### 9.1 Validation Rule Quality Checklist

Every rule MUST pass this checklist before deployment:

**Data Quality:**
- [ ] monetaryImpact is always a number (never string)
- [ ] No duplicate financial fields
- [ ] All amounts use 2 decimal precision
- [ ] PHI fields properly redacted

**Message Quality:**
- [ ] Messages follow template structure
- [ ] Messages are in Quebec French
- [ ] Currency formatted as XX,XX$ (not $XX.XX)
- [ ] No English terms in user-facing text

**Solution Quality:**
- [ ] Solutions are specific (not "vérifier" or "corriger")
- [ ] Solutions are actionable (can be done without research)
- [ ] Solutions include all necessary codes/values
- [ ] Errors always have solutions, info never has solutions

**UI Quality:**
- [ ] Results render correctly in all severity sections
- [ ] Monetary impact badge shows with correct color
- [ ] Detail boxes show appropriate information
- [ ] RAMQ ID grouping works correctly

**Technical Quality:**
- [ ] Unit tests cover all severity paths
- [ ] Integration tests verify result structure
- [ ] Performance tested with large datasets
- [ ] Error handling for edge cases

### 9.2 Code Review Checklist

When reviewing validation rule PRs:

- [ ] Follows ValidationResultBuilder pattern
- [ ] Uses standard category from approved list
- [ ] ruleData uses standard field names
- [ ] French messages and solutions
- [ ] Tests included
- [ ] RULES_INDEX.md updated
- [ ] MONETARY_IMPACT_GUIDE.md updated (if financial)

---

## Part 10: Examples

### 10.1 Complete Rule Example (Good)

```typescript
import { ValidationResultBuilder } from "./ValidationResultBuilder";
import { phiRedact } from "./phiRedaction";

export async function myNewRule(
  records: BillingRecord[],
  validationRunId: string
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  const builder = new ValidationResultBuilder(
    "my-new-rule",
    validationRunId,
    "my-category"
  );

  for (const record of records) {
    // Validation logic
    const patientCount = calculatePatientCount(record);
    const requiredCount = 12;

    if (patientCount < requiredCount) {
      // ERROR - Regulatory violation
      results.push(builder.error({
        message: `Code ${record.code} nécessite minimum ${requiredCount} patients ` +
                 `mais seulement ${patientCount} trouvé(s) pour ${phiRedact(record.doctor)} ` +
                 `le ${record.date}`,
        solution: `Facturer un code différent ou ajouter ${requiredCount - patientCount} ` +
                  `patient(s) supplémentaire(s)`,
        monetaryImpact: 0,  // No revenue if unpaid claim
        billingRecordId: record.id,
        affectedRecords: [record.id],
        idRamq: record.idRamq,
        ruleData: {
          monetaryImpact: 0,
          code: record.code,
          required: requiredCount,
          actual: patientCount,
          doctor: phiRedact(record.doctor),
          date: record.date,
        }
      }));
    } else if (patientCount >= 20) {
      // OPTIMIZATION - Could use higher-paying code
      const currentAmount = 32.10;
      const betterAmount = 64.20;
      const gain = betterAmount - currentAmount;

      results.push(builder.optimization({
        message: `Optimisation de revenus: ${phiRedact(record.doctor)} a vu ` +
                 `${patientCount} patients le ${record.date} et a facturé ${record.code} ` +
                 `(${formatCurrency(currentAmount)}), mais pourrait facturer 19929 ` +
                 `(${formatCurrency(betterAmount)})`,
        solution: `Facturer 19929 au lieu de ${record.code} pour un gain de ` +
                  `${formatCurrency(gain)}`,
        monetaryImpact: gain,
        billingRecordId: record.id,
        affectedRecords: [record.id],
        idRamq: record.idRamq,
        ruleData: {
          monetaryImpact: gain,
          currentCode: record.code,
          suggestedCode: "19929",
          currentAmount: currentAmount,
          expectedAmount: betterAmount,
          actual: patientCount,
          doctor: phiRedact(record.doctor),
          date: record.date,
        }
      }));
    }
  }

  // INFO - Summary
  results.push(builder.info({
    message: `Validation complétée: ${records.length} enregistrement(s) traité(s), ` +
             `${results.filter(r => r.severity === "error").length} erreur(s) trouvée(s)`,
    affectedRecords: [],
    idRamq: "SUMMARY",
    ruleData: {
      monetaryImpact: 0,
      totalRecords: records.length,
      errorCount: results.filter(r => r.severity === "error").length,
      optimizationCount: results.filter(r => r.severity === "optimization").length,
    }
  }));

  return results;
}

// Currency formatter
function formatCurrency(amount: number): string {
  return amount.toFixed(2).replace('.', ',') + '$';
}
```

### 10.2 Before/After Comparison

**BEFORE (Inconsistent):**
```typescript
// ❌ Mixed types, duplicate fields, unclear structure
{
  severity: "optimization",
  message: "You should bill code 19929",  // English!
  solution: null,  // Missing for optimization!
  ruleData: {
    gain: "32.10",               // String
    potentialRevenue: "64.20",   // String, duplicate concept
    monetaryImpact: "32.10",     // String, duplicate value
    currentCode: "19928",
    doctor: "Dr. Smith",         // Not redacted!
  }
}
```

**AFTER (Standard Compliant):**
```typescript
// ✅ Consistent types, single canonical field, clear structure
{
  severity: "optimization",
  message: "Optimisation de revenus: Dr. [REDACTED] a vu 15 patients le 2025-02-05 " +
           "et a facturé 19928 (32,10$), mais pourrait facturer 19929 (64,20$)",
  solution: "Facturer 19929 au lieu de 19928 pour un gain de 32,10$",
  ruleData: {
    monetaryImpact: 32.10,       // Number, canonical field
    currentCode: "19928",
    suggestedCode: "19929",
    currentAmount: 32.10,
    expectedAmount: 64.20,
    actual: 15,
    doctor: "Dr. [REDACTED]",    // PHI redacted
    date: "2025-02-05",
  }
}
```

---

## Part 11: Appendices

### A. Standard Error Codes

For programmatic error handling:

```typescript
enum ValidationErrorCode {
  INSUFFICIENT_PATIENTS = "insufficient_patients",
  DAILY_LIMIT_EXCEEDED = "daily_limit_exceeded",
  ANNUAL_LIMIT_EXCEEDED = "annual_limit_exceeded",
  MISSING_CONTEXT = "missing_context",
  INVALID_CODE_COMBINATION = "invalid_code_combination",
  INCORRECT_AMOUNT = "incorrect_amount",
}
```

### B. Monetary Impact Calculation Reference

```typescript
// Error impact calculation
function calculateErrorImpact(record: BillingRecord): number {
  if (record.montantPaye > 0) {
    // Revenue at risk if claim gets rejected
    return -record.montantPaye;
  } else {
    // No impact if not yet paid
    return 0;
  }
}

// Optimization impact calculation
function calculateOptimizationImpact(
  currentAmount: number,
  betterAmount: number
): number {
  // Always positive
  return betterAmount - currentAmount;
}

// Warning impact calculation (varies by context)
function calculateWarningImpact(record: BillingRecord): number {
  // Could be positive, negative, or zero depending on risk
  return estimatedImpact;
}
```

### C. Quebec French Terminology Reference

| English | French | Notes |
|---------|--------|-------|
| Billing | Facturation | |
| To bill | Facturer | |
| Amount | Montant | |
| Paid | Payé | |
| Unpaid | Non payé | |
| Registered patient | Patient inscrit | With appointment |
| Walk-in patient | Sans rendez-vous | Without appointment |
| Context element | Élément de contexte | e.g., #G160, MTA13 |
| Gain | Gain | Revenue opportunity |
| Loss | Perte | Revenue at risk |
| Solution | Solution | For errors |
| Action | Action recommandée | For optimizations |
| Office fee | Frais de cabinet | Codes 19928/19929 |
| Clinical intervention | Intervention clinique | Codes 8857/8859 |
| Forfeit | Forfait | Flat fee, e.g., 8875 |

---

## Conclusion

This framework provides a comprehensive standard for validation result display that ensures:

1. **Consistency** - All rules follow the same patterns
2. **Clarity** - Users get all information needed to fix issues
3. **Efficiency** - Information hierarchy prioritizes actionable data
4. **Maintainability** - Standard templates make rule development easier
5. **Quality** - Checklists ensure high standards

All new validation rules MUST follow this framework. Existing rules SHOULD be migrated according to the timeline in Part 8.

---

**Document Control:**
- **Owner:** Development Team
- **Reviewers:** Product, QA, Compliance
- **Next Review:** Q2 2025
- **Change Log:** See git history
