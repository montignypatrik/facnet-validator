# Validation Results Display Behavior

## Overview

This document describes the visual display behavior for validation results based on severity type, specifically for the office fee rule (19928/19929) implementation.

## Display Behavior by Severity

### 1. PASS Scenarios (severity: "info")

**Visual State:**
- Collapsed by default
- Blue border (left border: 4px)
- Blue background tint
- Check circle icon (✅)
- Shows expand/collapse button

**When Expanded:**
- Visit statistics grid (if available)
- Billing details box (if available)
- Generic metadata section

**User Interaction:**
- User can click "Afficher les détails" to expand
- User can click "Masquer les détails" to collapse
- Toggle button shows chevron icons (up/down)

**Example Scenarios:**
- P1: Valid Code 19928 - Registered Patients
- P2: Valid Code 19928 - Walk-In Patients
- P3: Valid Code 19929 - Registered Patients
- P4: Valid Code 19929 - Walk-In Patients
- P5-P11: Various valid billing scenarios

---

### 2. ERROR Scenarios (severity: "error")

**Visual State:**
- **Always expanded** (cannot collapse)
- Red border (left border: 4px)
- Red/pink background tint
- X circle icon (❌)
- No expand/collapse button shown

**Always Shows:**
- Error message (prominent)
- Solution box (highlighted in red/pink)
- Billing details box
- Visit statistics grid
- Temporal information (date, doctor)

**User Interaction:**
- No collapse functionality
- User must see the error and solution at all times

**Example Scenarios:**
- E1: Insufficient Registered Patients (19928)
- E2: Insufficient Walk-In Patients (19928)
- E3: Insufficient Registered Patients (19929)
- E4: Insufficient Walk-In Patients (19929)
- E5: Daily Maximum Exceeded
- E6-E8: Strategic maximum errors

---

### 3. OPTIMIZATION Scenarios (severity: "optimization")

**Visual State:**
- **Always expanded** (cannot collapse)
- Amber/yellow border (left border: 4px)
- Amber/yellow background tint
- Trending up icon (💡)
- No expand/collapse button shown

**Always Shows:**
- Optimization message
- **Monetary gain badge** (prominent, larger size: "lg")
- Solution box (highlighted in amber/yellow)
- **Comparison box** (current vs suggested)
- Visit statistics grid
- Billing details box

**Monetary Impact Badge:**
- Size: Large (lg)
- Color: Green background with green text
- Shows: "+32.40$" format
- Label: "Gain: +32.40$"
- Icon: Trending up arrow

**Comparison Box:**
- Shows current code vs suggested code
- Current amount vs expected amount
- Visual arrow between states
- Highlighted gain amount at bottom

**User Interaction:**
- No collapse functionality
- User must see the opportunity and potential gain
- Comparison box helps visualize the change

**Example Scenarios:**
- O1: Could Use Higher Code (19928 → 19929) - Registered
- O2: Could Use Higher Code (19928 → 19929) - Walk-In
- O3-O6: Could Add Second Billing scenarios

---

## Component Structure

### Main Card Component
```
ValidationResultCard
├── CardHeader (always visible)
│   ├── Icon + RAMQ Badge + Rule Name
│   ├── Monetary Impact Badge (if monetaryImpact !== 0)
│   ├── Main message
│   └── Expand/Collapse button (only for "info" severity)
└── CardContent (expandable for "info", always visible for "error" and "optimization")
    ├── Solution Box (if solution exists)
    ├── Comparison Box (for optimization with code changes)
    ├── Billing Details Box
    ├── Visit Statistics Grid
    └── Metadata Section
```

### New Components Added

#### ComparisonBox
- **Purpose:** Show before/after comparison for optimization scenarios
- **Location:** `client/src/components/validation/ComparisonBox.tsx`
- **Display:**
  - Current code and amount (left, white background)
  - Arrow icon (center)
  - Suggested code and amount (right, amber background)
  - Gain amount summary at bottom
- **Styling:** Amber theme to match optimization severity

---

## Styling Constants

### Severity Colors

**Error (severity: "error"):**
- Border: `border-red-500`
- Background: `bg-red-50 dark:bg-red-950/20`
- Icon Color: `text-red-600`
- Badge: Red background with red text

**Optimization (severity: "optimization"):**
- Border: `border-amber-500`
- Background: `bg-amber-50 dark:bg-amber-950/20`
- Icon Color: `text-amber-600`
- Badge: Amber background with amber text

**Info (severity: "info"):**
- Border: `border-blue-500`
- Background: `bg-blue-50 dark:bg-blue-950/20`
- Icon Color: `text-blue-600`
- Badge: Blue background with blue text

### Monetary Impact Badge Sizes

- **Small (sm):** `text-xs px-2 py-0.5`, icon: `w-3 h-3`
- **Medium (md):** `text-sm px-2.5 py-0.5`, icon: `w-4 h-4`
- **Large (lg):** `text-base px-3 py-1`, icon: `w-5 h-5`

Used for:
- Error/Info: Medium (md)
- Optimization: Large (lg) - more prominent

---

## Implementation Details

### Files Modified
1. `ValidationResultCard.tsx` - Updated to handle collapsible behavior based on severity
2. `ComparisonBox.tsx` - New component for optimization scenarios

### Key Logic Changes

**Default Expansion State:**
```typescript
const isAlwaysExpanded = result.severity === "error" || result.severity === "optimization";
const defaultExpanded = isAlwaysExpanded || showDetails;
const [isExpanded, setIsExpanded] = useState(defaultExpanded);
```

**Conditional Expand/Collapse Button:**
```typescript
{result.severity === "info" && (
  <Button onClick={() => setIsExpanded(!isExpanded)}>
    {isExpanded ? "Masquer les détails" : "Afficher les détails"}
  </Button>
)}
```

**Conditional Comparison Box:**
```typescript
const needsComparisonBox = (data: any): boolean => {
  return result.severity === "optimization" &&
         'currentCode' in data &&
         'suggestedCode' in data &&
         'currentAmount' in data &&
         'expectedAmount' in data;
};
```

---

## Testing Recommendations

### Manual Testing Scenarios

1. **PASS Scenarios (info):**
   - Verify card is collapsed by default
   - Click expand button, verify details show
   - Click collapse button, verify details hide
   - Verify visit statistics display correctly when expanded

2. **ERROR Scenarios (error):**
   - Verify card is always expanded
   - Verify no expand/collapse button is shown
   - Verify solution box has red/destructive styling
   - Verify monetary impact shows correctly (if negative)

3. **OPTIMIZATION Scenarios (optimization):**
   - Verify card is always expanded
   - Verify no expand/collapse button is shown
   - Verify monetary impact badge is large and prominent
   - Verify comparison box displays correctly
   - Verify gain amount is highlighted in green
   - Verify solution box has amber/warning styling

### Visual Regression Testing

Test in both light and dark modes:
- Error cards (red theme)
- Optimization cards (amber theme)
- Info cards (blue theme)
- Monetary impact badges (all sizes)
- Comparison box layout

---

## Accessibility Considerations

1. **Collapsible Controls:**
   - Clear button labels in French ("Afficher les détails" / "Masquer les détails")
   - Visual icons (ChevronDown/ChevronUp) complement text
   - Keyboard accessible (button element)

2. **Color Contrast:**
   - All severity colors meet WCAG AA contrast requirements
   - Dark mode variants maintain readability

3. **Semantic HTML:**
   - Proper use of Card components
   - Badges for metadata
   - Details/summary for technical metadata

---

## Future Enhancements

1. Add animation transitions for expand/collapse (CSS transitions)
2. Add print-friendly styles for validation reports
3. Consider adding "Expand All" / "Collapse All" functionality at list level
4. Add keyboard shortcuts (e.g., Space to toggle expansion)
