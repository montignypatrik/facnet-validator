# RAMQ Validation Rule Creation Guide

Step-by-step guide for creating new validation rules with Claude.

---

## Quick Start (5 Minutes)

1. **Copy the template**: Open [`RULE_TEMPLATE.md`](./RULE_TEMPLATE.md)
2. **Fill in your rule details**: See [`RULE_EXAMPLE_OFFICE_FEE.md`](./RULE_EXAMPLE_OFFICE_FEE.md) for reference
3. **Send to Claude**: Share the completed template
4. **Claude will**:
   - Create the handler function
   - Register the route
   - Write comprehensive tests
   - Add the database entry
   - Run tests and verify

---

## Step-by-Step Process

### Step 1: Understand Your Requirement

Before filling the template, gather:
- ✅ **Business rule description** (what RAMQ requires)
- ✅ **Target billing codes** (which codes this affects)
- ✅ **Example scenarios** (passing and failing cases)
- ✅ **French error messages** (what users should see)
- ✅ **Test data** (real CSV examples if available)

### Step 2: Choose the Right Rule Type

Match your requirement to an existing type or create new:

| Your Requirement | Rule Type | Example |
|------------------|-----------|---------|
| "Codes X and Y can't be billed together" | `prohibition` | Codes 15804 + 15820 forbidden |
| "Code only valid on weekends" | `time_restriction` | After-hours codes |
| "Code requires visit code" | `requirement` | Procedure needs consultation |
| "Code only in emergency dept" | `location_restriction` | Urgence-only codes |
| "Code only for children" | `age_restriction` | Pediatric codes |
| "Max $100/day" | `amount_limit` | Daily billing cap |
| "Only one annual exam/year" | `mutual_exclusion` | Annual vs periodic |
| "Patient missing annual visit" | `missing_annual_opportunity` | Revenue optimization |
| "Code once per year (simple)" | `annual_limit` | Basic annual rule |
| "Code once per year (by leaf field)" | `annual_billing_code` | Advanced annual |
| Something else | `[NEW_TYPE]` | Describe your custom logic |

### Step 3: Fill the Template

Open [`RULE_TEMPLATE.md`](./RULE_TEMPLATE.md) and fill each section:

#### Required Sections (Must Complete):
- ✅ Rule Information (name, ID, type, severity)
- ✅ Rule Logic Description
- ✅ Target Data (codes, contexts, establishments)
- ✅ Error Messages (French)
- ✅ Test Scenarios (at least 2 pass, 2 fail)

#### Optional Sections (If Applicable):
- Thresholds & Limits
- Additional Requirements
- Examples from Real Data
- Implementation Priority

#### Tips for Each Section:

**Rule Name**:
```
✅ Good: "Frais de bureau (19928/19929)"
✅ Good: "Code à facturation annuel"
❌ Bad: "Rule 1" or "New validation"
```

**Rule Logic**:
```
✅ Good: "Ensures code 15815 billed max once per patient per calendar year"
❌ Bad: "Validates annual codes"

Be specific! Include:
- What field is checked (code, leaf, context, establishment)
- What condition triggers error (> max, < min, missing, duplicate)
- What time period applies (daily, annually, per invoice)
```

**Error Messages**:
```
✅ Good French with dynamic values:
"Code annuel {code} facturé {totalCount} fois en {year}. Maximum: 1 par an."

❌ Bad static message:
"Error: Code is wrong"

Include placeholders: {code}, {count}, {date}, {amount}, etc.
```

**Test Scenarios**:
```
✅ Good: Specific test data with expected outcome
Patient: PATIENT-001
Code: 15815
Date 1: 2025-01-10, Paid: 49.15
Date 2: 2025-06-15, Paid: 49.15
Expected: Error (2 billings in same year)

❌ Bad: Vague description
"Test when code is used twice"
```

### Step 4: Share with Claude

Copy your completed template and send message:

```
I want to create a new RAMQ validation rule. Here's the completed template:

[Paste your filled template here]

Please create the rule using all relevant agents.
```

Claude will:
1. ✅ Analyze your requirements
2. ✅ Create handler function in `ruleTypeHandlers.ts`
3. ✅ Register route in `databaseRuleLoader.ts`
4. ✅ Write comprehensive Vitest tests
5. ✅ Insert database rule entry
6. ✅ Run tests and verify (aim for 90%+ passing)

### Step 5: Review & Test

Claude will provide:
- ✅ **Test results summary** (X/Y tests passing)
- ✅ **File locations** with line numbers
- ✅ **Example error messages** in French
- ✅ **Database rule verification**

If tests fail:
1. Claude will explain what's wrong
2. Provide suggestions for fixes
3. Iterate until tests pass

### Step 6: Integration Testing

After unit tests pass, test with real data:

1. **Restart server**: Kill old process, run `npm run dev`
2. **Upload CSV**: Use Validateur page to upload test file
3. **Check results**: Verify error messages match template
4. **Verify solutions**: Ensure French messages are helpful

---

## Template Sections Explained

### Rule Information
Basic metadata about the rule.

**Rule Name**: What users see in UI (French)
**Rule ID**: Database identifier (UPPERCASE_SNAKE_CASE)
**Rule Type**: Maps to handler function
**Severity**: How critical is this violation
**Category**: For grouping related rules

### Rule Logic Description
The "why" and "when" of your rule.

**What This Rule Validates**: Plain English explanation
**When Should This Trigger**: Specific conditions causing error
**When Should This NOT Trigger**: Valid scenarios that pass

### Target Data
Which billing codes/contexts/establishments are affected.

**Target Billing Codes**:
- Specific codes: `["19928", "19929"]`
- By leaf field: `leafPatterns: ["Visite de prise en charge"]`
- By description: `descriptionPattern: "Visite de suivi"`
- All codes: Leave empty

**Required Context Elements**:
- Context codes like `["G160", "AR"]` for walk-ins
- Used to identify specific visit types

**Establishment Restrictions**:
- Cabinet only: `allowedEstablishments: ["cabinet"]`
- Exclude urgence: `excludedEstablishments: ["urgence"]`

### Thresholds & Limits
Numeric constraints for your rule.

**Daily Maximum**: Dollar amount or count per day
**Patient Count Requirements**: Min/max patients
**Time Periods**: daily, weekly, monthly, annually

### Error Messages
What users see when rule triggers.

**Primary Message**: Describe the violation
**Solution Message**: How to fix it
**Different Scenarios**: Multiple messages for different cases

### Test Scenarios
Prove your rule works correctly.

**Pass Scenarios**: Valid data that shouldn't error
**Fail Scenarios**: Invalid data that should error
**Edge Cases**: Boundary conditions and special cases

---

## Common Patterns

### Pattern 1: Once Per Period Rule
```
Rule Type: annual_limit or annual_billing_code
Target: Specific codes or leaf patterns
Logic: Group by patient + period, check count > 1
Message: "Code {code} facturé {count} fois (maximum: 1 par {period})"
```

### Pattern 2: Minimum Requirement Rule
```
Rule Type: requirement or custom
Target: Specific codes
Logic: Check condition (count, amount, presence)
Message: "Code {code} exige {requirement}"
```

### Pattern 3: Mutual Exclusion Rule
```
Rule Type: prohibition or mutual_exclusion
Target: List of conflicting codes
Logic: Check if >1 code from group on same invoice/period
Message: "Codes {codes} ne peuvent être facturés ensemble"
```

### Pattern 4: Location Restriction
```
Rule Type: location_restriction
Target: Specific codes
Logic: Check establishment field matches allowed types
Message: "Code {code} réservé pour {location}"
```

### Pattern 5: Daily Limit
```
Rule Type: amount_limit or custom
Target: Codes with daily cap
Logic: Sum amounts per doctor per day, check > limit
Message: "Maximum quotidien de {limit}$ dépassé"
```

---

## Troubleshooting

### Issue: Tests Failing

**Problem**: Claude reports "9 out of 14 tests failing"

**Solutions**:
1. Check if database has expected data (leaf values, codes, etc.)
2. Verify French accents in leaf patterns match database
3. Review test expectations vs actual rule logic
4. Ask Claude to debug specific failing test

### Issue: Rule Not Triggering

**Problem**: Uploaded CSV doesn't show expected errors

**Solutions**:
1. Verify rule is enabled in database: `SELECT * FROM rules WHERE rule_id = 'YOUR_RULE_ID'`
2. Check if target codes match CSV data
3. Restart server to reload rules from database
4. Review console logs for rule execution messages

### Issue: Wrong Error Message

**Problem**: Error message doesn't match template

**Solutions**:
1. Check if rule condition JSON has correct messages
2. Verify French language has proper accents
3. Update database rule entry with correct messages
4. Clear cache and restart server

### Issue: Performance Problems

**Problem**: Validation takes too long

**Solutions**:
1. Check if rule queries database in loop (anti-pattern)
2. Use batch queries or cache reference data
3. Reduce complexity of rule logic
4. Add indexes on frequently queried fields

---

## Best Practices

### ✅ DO:
- Use clear, descriptive rule names in French
- Provide multiple test scenarios (pass, fail, edge cases)
- Include real CSV examples when possible
- Write French error messages that help users fix issues
- Test with production-like data before deploying
- Document business impact and priority

### ❌ DON'T:
- Use English for user-facing messages
- Create overly complex rules (split into multiple rules)
- Hardcode values that might change (use config)
- Skip test scenarios (causes bugs in production)
- Forget to handle NULL/missing data
- Ignore performance for large datasets

---

## Examples

See complete examples:
- [`RULE_EXAMPLE_OFFICE_FEE.md`](./RULE_EXAMPLE_OFFICE_FEE.md) - Complex rule with multiple thresholds
- [`RULE_TEMPLATE.md`](./RULE_TEMPLATE.md) - Blank template to copy

---

## Getting Help

If you're stuck:

1. **Check existing rules**: Look at `server/modules/validateur/validation/ruleTypeHandlers.ts` for examples
2. **Review test files**: See `tests/validation-rules/` for test patterns
3. **Ask Claude**: "How do I create a rule that checks [your requirement]?"
4. **Start simple**: Create basic version first, add complexity later

---

## Rule Lifecycle

```
1. Business Requirement
   ↓
2. Fill Template
   ↓
3. Send to Claude
   ↓
4. Claude Creates Implementation
   ↓
5. Unit Tests (Automated)
   ↓
6. Integration Testing (Manual CSV Upload)
   ↓
7. Production Deployment
   ↓
8. Monitoring & Refinement
```

Each step should be verified before moving to next.

---

## Quick Checklist

Before sending template to Claude:

- [ ] Rule name in French
- [ ] Rule ID in UPPERCASE_SNAKE_CASE
- [ ] Rule type selected or new type described
- [ ] Severity chosen (error/warning/info/optimization)
- [ ] Target codes/patterns specified
- [ ] French error message written
- [ ] French solution message written
- [ ] At least 2 passing test scenarios
- [ ] At least 2 failing test scenarios
- [ ] Edge cases considered
- [ ] Real CSV example (if available)
- [ ] Business impact described

---

That's it! You're ready to create RAMQ validation rules. 🚀
