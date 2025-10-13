# Validation Result Display Components

**Location:** `client/src/components/validation/`
**Created:** 2025-01-13
**Framework:** See `docs/modules/validateur/VALIDATION_RESULT_DISPLAY_FRAMEWORK.md`

This directory contains the standardized validation result card system for displaying RAMQ billing validation results.

---

## Components

### Main Component

#### `ValidationResultCard.tsx`
The primary template component for displaying validation results.

**Usage:**
```tsx
import { ValidationResultCard } from "@/components/validation/ValidationResultCard";

<ValidationResultCard result={validationResult} showDetails={true} />
```

**Features:**
- Automatic severity-based styling
- Rule-specific content rendering
- Expandable/collapsible details
- Type-safe implementation

---

### Sub-Components

#### `MonetaryImpactBadge.tsx`
Displays financial impact with color-coded styling.

```tsx
<MonetaryImpactBadge amount={-10.50} size="md" />
// → "Perte: 10,50$" (red badge)
```

#### `BillingDetailsBox.tsx`
Displays billing code, amount, type, and context status.

```tsx
<BillingDetailsBox
  code="19928"
  amount="16,55$"
  type="Cabinet enregistré"
  hasContext={false}
/>
```

#### `VisitStatisticsGrid.tsx`
Displays patient visit counts in a 2x2 grid.

```tsx
<VisitStatisticsGrid
  registeredPaid={3}
  registeredUnpaid={1}
  walkinPaid={2}
  walkinUnpaid={0}
/>
```

#### `SolutionBox.tsx`
Displays action recommendations with severity-specific styling.

```tsx
<SolutionBox
  solution="Utiliser le code 19928 pour les visites enregistrées."
  severity="error"
/>
```

---

### Utilities

#### `severityStyles.ts`
Centralized styling configuration and helper functions.

**Exports:**
- `SEVERITY_STYLES` - Severity-based styling configuration
- `getSeverityStyle()` - Get style config for severity level
- `formatCurrency()` - Quebec French currency formatting (32,10$)
- `getCategoryDisplayName()` - French category names
- `getRuleDisplayName()` - French rule names

```typescript
import { getSeverityStyle, formatCurrency } from "./severityStyles";

const style = getSeverityStyle("error");
const formatted = formatCurrency(32.10); // "32,10$"
```

---

## Type System

All types are defined in `client/src/types/validation.ts`:

- `ValidationResult` - Complete validation result structure
- `ValidationSeverity` - Severity levels (error, warning, info, optimization)
- `RuleData` - Union type for all rule-specific data
- `OfficeFeeRuleData` - Office fee rule specifics
- `InterventionCliniqueRuleData` - Intervention clinique specifics
- `GmfForfaitRuleData` - GMF forfait specifics
- `AnnualLimitRuleData` - Annual limit specifics

---

## Documentation

### Quick Start
See [VALIDATION_RESULT_CARD_EXAMPLES.md](../../../docs/modules/validateur/VALIDATION_RESULT_CARD_EXAMPLES.md) for:
- Basic usage examples
- Rule-specific implementations
- Custom detail boxes
- Integration guide
- Testing examples

### Framework
See [VALIDATION_RESULT_DISPLAY_FRAMEWORK.md](../../../docs/modules/validateur/VALIDATION_RESULT_DISPLAY_FRAMEWORK.md) for:
- Data structure standards
- Message templates
- Design specifications
- Migration plan
- Quality checklists

### Analysis
See [VALIDATION_DISPLAY_ANALYSIS_SUMMARY.md](../../../VALIDATION_DISPLAY_ANALYSIS_SUMMARY.md) for:
- Current state assessment
- Problem identification
- Recommended solutions
- Implementation roadmap

---

## Design Principles

### 1. Consistency
All validation results use the same visual language, regardless of rule type.

### 2. French-First
All user-facing text is in Quebec French with proper formatting.

### 3. Type Safety
Full TypeScript support with type guards for rule-specific data.

### 4. Accessibility
Semantic HTML, proper ARIA labels, keyboard navigation support.

### 5. Dark Mode
All components support dark mode out of the box.

### 6. Expandable Details
Primary information always visible, additional details on demand.

---

## Component Architecture

```
ValidationResultCard (Main)
├── Header (Always visible)
│   ├── Severity Badge
│   ├── Rule Name
│   ├── MonetaryImpactBadge
│   ├── Category & RAMQ ID
│   └── Main Message
│
└── Details (Expandable)
    ├── SolutionBox (if solution exists)
    ├── Rule-Specific Boxes (conditional)
    │   ├── BillingDetailsBox (office fees)
    │   ├── VisitStatisticsGrid (office fees)
    │   └── Custom boxes (other rules)
    └── Technical Metadata (collapsible)
```

---

## Adding New Rule Types

### 1. Define Rule Data Type

```typescript
// client/src/types/validation.ts

export interface YourNewRuleData extends BaseRuleData {
  customField1: string;
  customField2: number;
  // ... other fields
}

// Add to union type
export type RuleData =
  | OfficeFeeRuleData
  | YourNewRuleData
  | // ... other types
```

### 2. Create Detail Component (Optional)

```tsx
// YourNewRuleBox.tsx

export function YourNewRuleBox({ data }: { data: YourNewRuleData }) {
  return (
    <Card className="bg-gray-50 dark:bg-gray-900/50">
      <CardContent className="pt-4">
        {/* Your custom layout */}
      </CardContent>
    </Card>
  );
}
```

### 3. Add Type Guard to ValidationResultCard

```typescript
// ValidationResultCard.tsx

const isYourNewRule = (data: any): data is YourNewRuleData => {
  return 'customField1' in data;
};
```

### 4. Render Conditionally

```tsx
// In ValidationResultCard expandable section

{isYourNewRule(result.ruleData) && (
  <YourNewRuleBox data={result.ruleData} />
)}
```

---

## Migration from Old System

### Before
```tsx
// Hardcoded in RunDetails.tsx
<div className="border-l-4 border-red-500 bg-red-50 p-4">
  <span>Erreur: {result.message}</span>
  {/* Hardcoded detail boxes */}
</div>
```

### After
```tsx
import { ValidationResultCard } from "@/components/validation/ValidationResultCard";

<ValidationResultCard result={result} />
```

**Benefits:**
- 90% less code in RunDetails.tsx
- Consistent styling across all rules
- Easy to maintain and extend
- Type-safe implementation
- Reusable in other parts of the app

---

## Testing

Run tests:
```bash
npm test -- ValidationResultCard
```

Test coverage goals:
- Components: 80%+
- Utilities: 90%+
- Type guards: 100%

---

## Maintenance

### Adding French Translations

Update `severityStyles.ts`:

```typescript
export function getRuleDisplayName(ruleName: string): string {
  const ruleNames: Record<string, string> = {
    'Your Rule Name': 'Votre nom de règle',
    // Add here
  };
  return ruleNames[ruleName] || ruleName;
}
```

### Updating Severity Styles

Update `SEVERITY_STYLES` object in `severityStyles.ts`:

```typescript
export const SEVERITY_STYLES: Record<ValidationSeverity, SeverityStyleConfig> = {
  newSeverity: {
    border: "border-color-500",
    background: "bg-color-50 dark:bg-color-950/20",
    icon: IconComponent,
    iconColor: "text-color-600",
    badge: "bg-color-100 text-color-700 ...",
    headerText: "text-color-900 dark:text-color-100",
  },
};
```

---

## Best Practices

1. ✅ Always use `ValidationResultCard` for displaying results
2. ✅ Use type guards for rule-specific data access
3. ✅ Keep `monetaryImpact` as number type
4. ✅ Use helper functions for formatting and translations
5. ✅ Provide fallback values for optional fields
6. ✅ Test all severity levels and rule types
7. ✅ Follow Quebec French conventions (32,10$)
8. ✅ Support dark mode in custom components

---

## Support

- **Framework:** [VALIDATION_RESULT_DISPLAY_FRAMEWORK.md](../../../docs/modules/validateur/VALIDATION_RESULT_DISPLAY_FRAMEWORK.md)
- **Examples:** [VALIDATION_RESULT_CARD_EXAMPLES.md](../../../docs/modules/validateur/VALIDATION_RESULT_CARD_EXAMPLES.md)
- **Types:** [validation.ts](../../types/validation.ts)
- **GitHub Issues:** https://github.com/montignypatrik/facnet-validator/issues
