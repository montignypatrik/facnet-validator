# Validation Result Card - Implementation Examples

**Created:** 2025-01-13
**Status:** ✅ Complete
**Related:** `VALIDATION_RESULT_DISPLAY_FRAMEWORK.md`

This document provides practical examples for using the ValidationResultCard component system.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Component Overview](#component-overview)
3. [Basic Usage](#basic-usage)
4. [Rule-Specific Implementations](#rule-specific-implementations)
5. [Custom Detail Boxes](#custom-detail-boxes)
6. [Styling Customization](#styling-customization)
7. [Integration with RunDetails](#integration-with-rundetails)

---

## Quick Start

### Installation

All components are located in `client/src/components/validation/`:

```
validation/
├── ValidationResultCard.tsx      # Main card component
├── MonetaryImpactBadge.tsx       # Financial impact display
├── BillingDetailsBox.tsx         # Billing information box
├── VisitStatisticsGrid.tsx       # Patient visit counts
├── SolutionBox.tsx               # Action recommendations
└── severityStyles.ts             # Styling configuration & helpers
```

### Basic Import

```typescript
import { ValidationResultCard } from "@/components/validation/ValidationResultCard";
import { ValidationResult } from "@/types/validation";
```

### Minimal Example

```tsx
export function MyValidationResults({ results }: { results: ValidationResult[] }) {
  return (
    <div className="space-y-4">
      {results.map((result) => (
        <ValidationResultCard key={result.id} result={result} />
      ))}
    </div>
  );
}
```

---

## Component Overview

### ValidationResultCard (Main Component)

The main template component that automatically renders appropriate sub-components based on rule type.

**Props:**
```typescript
interface ValidationResultCardProps {
  result: ValidationResult;
  showDetails?: boolean;  // Default: false
}
```

**Features:**
- Automatic severity-based styling
- Expandable/collapsible details section
- Rule-specific content rendering
- Monetary impact display
- French-first language support

### Sub-Components

#### MonetaryImpactBadge

Displays financial impact with color-coded styling.

```tsx
import { MonetaryImpactBadge } from "@/components/validation/MonetaryImpactBadge";

<MonetaryImpactBadge amount={result.monetaryImpact} size="md" />
```

**Styling:**
- `amount > 0` → Green badge with "Gain"
- `amount < 0` → Red badge with "Perte"
- `amount === 0` → Gray badge with "Impact"

#### BillingDetailsBox

Displays billing code, amount, type, and context status.

```tsx
import { BillingDetailsBox } from "@/components/validation/BillingDetailsBox";

<BillingDetailsBox
  code="19928"
  amount="16,55$"
  type="Cabinet enregistré"
  hasContext={false}
/>
```

#### VisitStatisticsGrid

Displays patient visit counts in a 2x2 grid.

```tsx
import { VisitStatisticsGrid } from "@/components/validation/VisitStatisticsGrid";

<VisitStatisticsGrid
  registeredPaid={3}
  registeredUnpaid={1}
  walkinPaid={2}
  walkinUnpaid={0}
/>
```

#### SolutionBox

Displays action recommendations with severity-specific styling.

```tsx
import { SolutionBox } from "@/components/validation/SolutionBox";

<SolutionBox
  solution="Utiliser le code 19929 pour les visites de cabinet non enregistrées."
  severity="error"
/>
```

---

## Basic Usage

### Display Single Result

```tsx
import { ValidationResultCard } from "@/components/validation/ValidationResultCard";

export function SingleResult({ result }: { result: ValidationResult }) {
  return (
    <div className="max-w-2xl mx-auto p-4">
      <ValidationResultCard result={result} showDetails={true} />
    </div>
  );
}
```

### Display List of Results

```tsx
export function ValidationResultList({ results }: { results: ValidationResult[] }) {
  return (
    <div className="space-y-4">
      {results.map((result) => (
        <ValidationResultCard
          key={result.id}
          result={result}
          showDetails={false}
        />
      ))}
    </div>
  );
}
```

### Display Results by Severity

```tsx
export function ResultsBySeverity({ results }: { results: ValidationResult[] }) {
  const errors = results.filter((r) => r.severity === "error");
  const optimizations = results.filter((r) => r.severity === "optimization");
  const infos = results.filter((r) => r.severity === "info");

  return (
    <div className="space-y-6">
      {/* Errors */}
      {errors.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-red-700 mb-3">
            Erreurs ({errors.length})
          </h2>
          <div className="space-y-4">
            {errors.map((result) => (
              <ValidationResultCard key={result.id} result={result} />
            ))}
          </div>
        </section>
      )}

      {/* Optimizations */}
      {optimizations.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-amber-700 mb-3">
            Optimisations ({optimizations.length})
          </h2>
          <div className="space-y-4">
            {optimizations.map((result) => (
              <ValidationResultCard key={result.id} result={result} />
            ))}
          </div>
        </section>
      )}

      {/* Infos */}
      {infos.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-blue-700 mb-3">
            Informations ({infos.length})
          </h2>
          <div className="space-y-4">
            {infos.map((result) => (
              <ValidationResultCard key={result.id} result={result} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

### Display Results Grouped by RAMQ ID

```tsx
export function ResultsByRamqId({ results }: { results: ValidationResult[] }) {
  // Group results by RAMQ ID
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.idRamq]) {
      acc[result.idRamq] = [];
    }
    acc[result.idRamq].push(result);
    return acc;
  }, {} as Record<string, ValidationResult[]>);

  return (
    <div className="space-y-6">
      {Object.entries(groupedResults).map(([ramqId, groupResults]) => (
        <div key={ramqId} className="border rounded-lg p-4">
          <h3 className="text-lg font-bold mb-3">RAMQ: {ramqId}</h3>
          <div className="space-y-3">
            {groupResults.map((result) => (
              <ValidationResultCard key={result.id} result={result} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## Rule-Specific Implementations

### Office Fee Rule Result

The ValidationResultCard automatically detects office fee rules and displays billing details and visit statistics.

```typescript
const officeFeeResult: ValidationResult = {
  id: "uuid-123",
  validationRunId: "run-456",
  ruleId: "office-fee-rule",
  severity: "error",
  category: "office-fees",
  message: "Code de frais de cabinet incorrect utilisé pour une visite enregistrée.",
  solution: "Utiliser le code 19928 pour les visites de cabinet enregistrées.",
  billingRecordId: "billing-789",
  affectedRecords: ["billing-789"],
  idRamq: "RAMQ12345",
  monetaryImpact: -3.30,
  ruleName: "Office Fee Validation (19928/19929)",
  createdAt: "2025-01-13T10:30:00Z",
  ruleData: {
    monetaryImpact: -3.30,
    code: "19929",
    billedCode: "19929",
    billedAmount: "16,55$",
    hasContext: false,
    registeredPaidCount: 3,
    registeredUnpaidCount: 1,
    walkInPaidCount: 2,
    walkInUnpaidCount: 0,
    date: "2025-01-10",
    doctor: "DR***",
    patient: "P***ABC",
  },
};

// Usage
<ValidationResultCard result={officeFeeResult} showDetails={true} />
```

**Rendered Output:**
- ✅ Error severity badge (red)
- ✅ Rule name: "Frais de cabinet (19928/19929)"
- ✅ Monetary impact: "Perte: 3,30$" (red)
- ✅ Error message
- ✅ Solution box with action
- ✅ BillingDetailsBox showing code, amount, type, context
- ✅ VisitStatisticsGrid showing patient counts

### GMF Forfait Rule Result

```typescript
const gmfForfaitResult: ValidationResult = {
  id: "uuid-456",
  validationRunId: "run-456",
  ruleId: "gmf-forfait-8875",
  severity: "optimization",
  category: "gmf-forfait",
  message: "Patient éligible pour GMF forfait 8875 non facturé.",
  solution: "Facturer le code 8875 pour maximiser les revenus GMF.",
  billingRecordId: null,
  affectedRecords: [],
  idRamq: "RAMQ67890",
  monetaryImpact: 180.00,
  ruleName: "GMF Forfait 8875",
  createdAt: "2025-01-13T10:30:00Z",
  ruleData: {
    monetaryImpact: 180.00,
    patient: "P***XYZ",
    year: 2024,
    visitCount: 6,
    firstVisitDate: "2024-03-15",
    potentialRevenue: 180.00,
    gmfEstablishments: ["11111"],
  },
};

// Usage
<ValidationResultCard result={gmfForfaitResult} showDetails={true} />
```

**Rendered Output:**
- ✅ Optimization severity badge (amber)
- ✅ Rule name: "GMF forfait 8875"
- ✅ Monetary impact: "Gain: 180,00$" (green)
- ✅ Optimization message
- ✅ Solution box with recommendation
- ✅ GMF-specific detail box showing patient, year, visit count, first visit date

### Generic Rule Result

For rules without specific detail components:

```typescript
const genericResult: ValidationResult = {
  id: "uuid-789",
  validationRunId: "run-456",
  ruleId: "annual-billing-limit",
  severity: "error",
  category: "annual-limit",
  message: "Limite annuelle de facturation dépassée pour le code 8233.",
  solution: "Vérifier les enregistrements et retirer les codes en excès.",
  billingRecordId: "billing-999",
  affectedRecords: ["billing-999", "billing-998"],
  idRamq: "RAMQ99999",
  monetaryImpact: 0,
  ruleName: "Annual Billing Code Limit",
  createdAt: "2025-01-13T10:30:00Z",
  ruleData: {
    monetaryImpact: 0,
    date: "2024-12-31",
    doctor: "DR***",
    patient: "P***DEF",
  },
};

// Usage
<ValidationResultCard result={genericResult} showDetails={true} />
```

**Rendered Output:**
- ✅ Error severity badge (red)
- ✅ Rule name in English (translation pending)
- ✅ No monetary impact badge (amount = 0)
- ✅ Error message
- ✅ Solution box
- ✅ Generic detail box showing date, doctor, patient

---

## Custom Detail Boxes

### Creating a Rule-Specific Detail Component

For rules that need custom presentation:

```tsx
// client/src/components/validation/InterventionCliniqueBox.tsx

import { Card, CardContent } from "@/components/ui/card";
import { Clock, AlertTriangle } from "lucide-react";
import { InterventionCliniqueRuleData } from "@/types/validation";

interface InterventionCliniqueBoxProps {
  data: InterventionCliniqueRuleData;
}

export function InterventionCliniqueBox({ data }: InterventionCliniqueBoxProps) {
  return (
    <Card className="bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700">
      <CardContent className="pt-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            <Clock className="w-4 h-4" />
            <span>Détails de l'intervention</span>
          </div>

          {data.totalMinutes && (
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Durée totale:
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {data.totalMinutes} minutes
              </span>
            </div>
          )}

          {data.excessMinutes && data.excessMinutes > 0 && (
            <div className="flex justify-between items-center bg-red-50 dark:bg-red-900/20 p-2 rounded">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span className="text-sm text-red-600 dark:text-red-400">
                  Minutes en excès:
                </span>
              </div>
              <span className="text-sm font-bold text-red-600 dark:text-red-400">
                {data.excessMinutes} minutes
              </span>
            </div>
          )}

          {data.interventionCount && (
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Nombre d'interventions:
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {data.interventionCount}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

### Using Custom Detail Component in ValidationResultCard

Update the ValidationResultCard to include the new component:

```tsx
// In ValidationResultCard.tsx, add type guard and rendering

import { InterventionCliniqueBox } from "./InterventionCliniqueBox";
import { InterventionCliniqueRuleData } from "@/types/validation";

// Add type guard
const isInterventionCliniqueRule = (data: any): data is InterventionCliniqueRuleData => {
  return 'totalMinutes' in data || 'interventionCount' in data;
};

// In the expandable details section, add:
{isInterventionCliniqueRule(result.ruleData) && (
  <InterventionCliniqueBox data={result.ruleData} />
)}
```

---

## Styling Customization

### Using Severity Styles

All components use the centralized `severityStyles.ts` helper:

```typescript
import { getSeverityStyle, formatCurrency, getCategoryDisplayName } from "./severityStyles";

const style = getSeverityStyle("error");
// Returns: { border, background, icon, iconColor, badge, headerText }

const amount = formatCurrency(32.10);
// Returns: "32,10$"

const category = getCategoryDisplayName("office_fees");
// Returns: "Frais de cabinet"
```

### Custom Severity Configuration

To add a new severity level, update `severityStyles.ts`:

```typescript
export const SEVERITY_STYLES: Record<ValidationSeverity, SeverityStyleConfig> = {
  // ... existing severities
  critical: {
    border: "border-purple-500",
    background: "bg-purple-50 dark:bg-purple-950/20",
    icon: AlertOctagon,
    iconColor: "text-purple-600",
    badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    headerText: "text-purple-900 dark:text-purple-100",
  },
};
```

### Dark Mode Support

All components include dark mode variants using Tailwind's `dark:` prefix. No additional configuration needed.

---

## Integration with RunDetails

### Migrating from Old Implementation

**Before (RunDetails.tsx - Lines 373-841):**

```tsx
// Old hardcoded implementation
{errors.map((result) => (
  <div key={result.id} className="border-l-4 border-red-500 bg-red-50 p-4">
    <div className="flex items-center gap-2">
      <XCircle className="w-5 h-5 text-red-600" />
      <span className="font-semibold">Erreur</span>
    </div>
    <p>{result.message}</p>
    {/* ... hardcoded detail boxes ... */}
  </div>
))}
```

**After (Using ValidationResultCard):**

```tsx
import { ValidationResultCard } from "@/components/validation/ValidationResultCard";

{errors.map((result) => (
  <ValidationResultCard key={result.id} result={result} showDetails={false} />
))}
```

### Complete RunDetails Integration Example

```tsx
// client/src/pages/validator/RunDetails.tsx (simplified)

import { ValidationResultCard } from "@/components/validation/ValidationResultCard";
import { ValidationResult } from "@/types/validation";

export function RunDetails() {
  const { data: results } = useValidationResults(runId);

  // Group by severity
  const errors = results?.filter((r) => r.severity === "error") || [];
  const optimizations = results?.filter((r) => r.severity === "optimization") || [];
  const infos = results?.filter((r) => r.severity === "info") || [];

  return (
    <div className="p-6 space-y-6">
      {/* Errors Section */}
      {errors.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold text-red-700 mb-4">
            Erreurs ({errors.length})
          </h2>
          <div className="space-y-4">
            {errors.map((result) => (
              <ValidationResultCard key={result.id} result={result} />
            ))}
          </div>
        </section>
      )}

      {/* Optimizations Section */}
      {optimizations.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold text-amber-700 mb-4">
            Opportunités d'optimisation ({optimizations.length})
          </h2>
          <div className="space-y-4">
            {optimizations.map((result) => (
              <ValidationResultCard key={result.id} result={result} />
            ))}
          </div>
        </section>
      )}

      {/* Infos Section */}
      {infos.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold text-blue-700 mb-4">
            Informations ({infos.length})
          </h2>
          <div className="space-y-4">
            {infos.map((result) => (
              <ValidationResultCard key={result.id} result={result} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

---

## Best Practices

### 1. Always Use Type Guards

```typescript
// ✅ Good - Type-safe
const isOfficeFeeRule = (data: any): data is OfficeFeeRuleData => {
  return 'code' in data && 'billedAmount' in data;
};

if (isOfficeFeeRule(result.ruleData)) {
  // TypeScript knows ruleData is OfficeFeeRuleData here
}

// ❌ Bad - Unsafe
if (result.category === "office-fees") {
  // No type narrowing
}
```

### 2. Provide Fallbacks

```typescript
// ✅ Good
<span>{result.ruleData.billedAmount || "N/A"}</span>

// ❌ Bad
<span>{result.ruleData.billedAmount}</span> // Could be undefined
```

### 3. Use Optional Chaining

```typescript
// ✅ Good
{result.solution && <SolutionBox solution={result.solution} severity={result.severity} />}

// ❌ Bad
{result.solution ? <SolutionBox ... /> : null}
```

### 4. Keep monetaryImpact as Number

```typescript
// ✅ Good - Number type
const result: ValidationResult = {
  monetaryImpact: 32.10,
  ruleData: {
    monetaryImpact: 32.10, // Also number
  },
};

// ❌ Bad - String type
const result = {
  monetaryImpact: "32.10", // Should be number
};
```

### 5. French-First Translations

```typescript
// ✅ Good - Use helper functions
import { getRuleDisplayName } from "./severityStyles";
<span>{getRuleDisplayName(result.ruleName)}</span>

// ❌ Bad - Hardcoded translations
<span>{result.ruleName === "Office Fee" ? "Frais de cabinet" : result.ruleName}</span>
```

---

## Testing

### Unit Test Example

```typescript
// __tests__/components/validation/ValidationResultCard.test.tsx

import { render, screen } from "@testing-library/react";
import { ValidationResultCard } from "@/components/validation/ValidationResultCard";
import { ValidationResult } from "@/types/validation";

describe("ValidationResultCard", () => {
  const mockResult: ValidationResult = {
    id: "test-123",
    validationRunId: "run-456",
    ruleId: "office-fee-rule",
    severity: "error",
    category: "office-fees",
    message: "Test error message",
    solution: "Test solution",
    billingRecordId: null,
    affectedRecords: [],
    idRamq: "RAMQ12345",
    monetaryImpact: -10.50,
    ruleName: "Office Fee Validation",
    createdAt: "2025-01-13T10:00:00Z",
    ruleData: {
      monetaryImpact: -10.50,
      code: "19928",
    },
  };

  it("renders severity badge correctly", () => {
    render(<ValidationResultCard result={mockResult} />);
    expect(screen.getByText("ERROR")).toBeInTheDocument();
  });

  it("displays monetary impact", () => {
    render(<ValidationResultCard result={mockResult} />);
    expect(screen.getByText(/Perte: 10,50\$/)).toBeInTheDocument();
  });

  it("shows message", () => {
    render(<ValidationResultCard result={mockResult} />);
    expect(screen.getByText("Test error message")).toBeInTheDocument();
  });

  it("renders solution when expanded", () => {
    render(<ValidationResultCard result={mockResult} showDetails={true} />);
    expect(screen.getByText("Test solution")).toBeInTheDocument();
  });
});
```

---

## Troubleshooting

### Issue: Components not rendering

**Cause:** Missing imports or incorrect paths

**Solution:**
```typescript
// Ensure correct import paths
import { ValidationResultCard } from "@/components/validation/ValidationResultCard";
import { ValidationResult } from "@/types/validation";
```

### Issue: Styling not applying

**Cause:** Missing Tailwind classes or dark mode configuration

**Solution:** Ensure Tailwind is configured with dark mode:

```javascript
// tailwind.config.js
module.exports = {
  darkMode: 'class', // or 'media'
  // ...
};
```

### Issue: Type errors with ruleData

**Cause:** ruleData is flexible JSONB, TypeScript doesn't know the shape

**Solution:** Use type guards:

```typescript
const isOfficeFeeRule = (data: any): data is OfficeFeeRuleData => {
  return 'code' in data;
};

if (isOfficeFeeRule(result.ruleData)) {
  // Now TypeScript knows the type
  console.log(result.ruleData.code);
}
```

### Issue: French translations missing

**Cause:** Translation not added to helper functions

**Solution:** Update `severityStyles.ts`:

```typescript
export function getRuleDisplayName(ruleName: string): string {
  const ruleNames: Record<string, string> = {
    'Your New Rule': 'Votre nouvelle règle',
    // Add your translation here
  };
  return ruleNames[ruleName] || ruleName;
}
```

---

## Next Steps

1. **Integrate into RunDetails.tsx**: Replace hardcoded result display with ValidationResultCard
2. **Create rule-specific detail boxes**: For intervention clinique, annual limits, etc.
3. **Add more French translations**: Update `severityStyles.ts` with all rule names
4. **Write comprehensive tests**: Unit tests for all components
5. **Add Storybook stories**: Document component variants visually

---

## Related Documentation

- [VALIDATION_RESULT_DISPLAY_FRAMEWORK.md](./VALIDATION_RESULT_DISPLAY_FRAMEWORK.md) - Complete framework
- [VALIDATION_DISPLAY_ANALYSIS_SUMMARY.md](../../../VALIDATION_DISPLAY_ANALYSIS_SUMMARY.md) - Analysis summary
- [RULE_CREATION_GUIDE.md](./RULE_CREATION_GUIDE.md) - Creating new rules
- [validation.ts](../../../client/src/types/validation.ts) - TypeScript types

---

**Questions?** Refer to the main framework document or check the component source code for detailed implementation.
