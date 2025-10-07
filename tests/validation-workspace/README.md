# Validation Workspace - Agent Communication System

This directory facilitates communication between validation agents during test-driven development of RAMQ validation rules.

## Purpose

When multiple AI agents work together to develop and test validation rules, they need a way to share context and results. This workspace provides structured JSON files for agent-to-agent communication.

## Files

### 1. `current-task.json`
**Written by**: User or validation-expert
**Read by**: All agents
**Purpose**: Describes the current validation rule being developed or tested

**Schema**:
```typescript
{
  taskId: string;           // Unique task identifier
  taskType: string;         // Type of task (create_rule, debug_rule, etc.)
  rule: {
    name: string;
    ruleType: string;
    code: string;
    condition: object;
  };
  status: 'pending' | 'testing' | 'debugging' | 'completed' | 'failed';
  assignedAgent: string | null;
  created: string;          // ISO timestamp
  lastUpdated: string;      // ISO timestamp
}
```

---

### 2. `test-results.json`
**Written by**: validation-tester agent
**Read by**: validation-debugger, validation-expert
**Purpose**: Reports test execution results and failures

**Schema**:
```typescript
{
  taskId: string;
  testRun: {
    passed: number;
    failed: number;
    total: number;
    duration: number;       // milliseconds
    timestamp: string;
  };
  failures: Array<{
    testName: string;
    expected: string;
    actual: string;
    fixture: string;        // Path to test fixture
    billingRecords?: string[];  // Affected record IDs
    errorMessage?: string;
  }>;
  summary: {
    hasFailures: boolean;
    requiresDebugging: boolean;
  };
}
```

---

### 3. `analysis-report.json`
**Written by**: validation-debugger agent
**Read by**: validation-expert
**Purpose**: Provides diagnostic analysis and fix suggestions for test failures

**Schema**:
```typescript
{
  taskId: string;
  analysisDate: string;
  failureAnalysis: Array<{
    testName: string;
    rootCause: string;
    affectedRecords: string[];
    databaseFindings: object;
    suggestedFix: string;
    codeSnippet?: string;
    sqlFix?: string;
    confidence: 'high' | 'medium' | 'low';
    nextSteps: string[];
  }>;
  summary: {
    totalFailures: number;
    analyzedFailures: number;
    highConfidenceFixes: number;
    mediumConfidenceFixes: number;
    lowConfidenceFixes: number;
    databaseQueriesRun: number;
  };
  recommendations: string[];
}
```

---

### 4. `rule-dependencies.json`
**Written by**: rule-analyzer agent
**Read by**: validation-expert, validation-tester
**Purpose**: Maps rule dependencies and test coverage for impact analysis

**Schema**:
```typescript
{
  generatedDate: string;
  rules: Array<{
    ruleId: string;
    ruleName: string;
    dependsOn: string[];    // Related codes, contexts, establishments
    conflicts: string[];    // Potential conflicting rules
    coverage: {
      totalScenarios: number;
      testedScenarios: number;
      coveragePercent: number;
      gaps: string[];
    };
  }>;
  dependencies: Array<{
    from: string;           // Rule ID
    to: string;             // Rule ID
    type: string;           // Type of dependency
    description: string;
  }>;
  conflicts: Array<{
    rule1: string;
    rule2: string;
    conflictType: string;
    severity: 'error' | 'warning';
    resolution: string;
  }>;
  globalCoverage: {
    totalRules: number;
    rulesWithTests: number;
    coveragePercent: number;
    untested: string[];
  };
}
```

## Agent Workflow Example

### Scenario: Creating a new weekly visit limit rule

**Step 1: validation-expert creates rule**
```json
// Writes current-task.json
{
  "taskId": "weekly-visit-limit-15804",
  "taskType": "create_validation_rule",
  "rule": {
    "name": "Weekly Visit Limit for Code 15804",
    "code": "15804",
    "condition": {
      "type": "frequency_limit",
      "maxVisitsPerWeek": 5
    }
  },
  "status": "pending",
  "assignedAgent": "validation-expert"
}
```

**Step 2: validation-tester generates and runs tests**
```json
// Writes test-results.json
{
  "taskId": "weekly-visit-limit-15804",
  "testRun": {
    "passed": 3,
    "failed": 2,
    "total": 5
  },
  "failures": [
    {
      "testName": "should flag 6 visits in one week",
      "expected": "1 validation error",
      "actual": "0 validation errors",
      "fixture": "tests/fixtures/ramq-billing/weekly-6-visits.json"
    }
  ]
}
```

**Step 3: validation-debugger analyzes failures**
```json
// Writes analysis-report.json
{
  "taskId": "weekly-visit-limit-15804",
  "failureAnalysis": [
    {
      "testName": "should flag 6 visits in one week",
      "rootCause": "Rule not filtering walk-in patients (context #AR)",
      "suggestedFix": "Add walk-in context filter",
      "codeSnippet": "const registered = records.filter(r => !['G160', 'AR'].includes(r.elementDeContexte));",
      "confidence": "high",
      "nextSteps": [
        "1. Update ruleTypeHandlers.ts",
        "2. Add walk-in filter",
        "3. Re-run tests"
      ]
    }
  ]
}
```

**Step 4: validation-expert implements fix**
- Reads analysis-report.json
- Implements suggested fix
- Updates current-task.json status to "testing"

**Step 5: Loop until all tests pass**
- validation-tester re-runs tests
- If pass: Mark task as "completed"
- If fail: Repeat debugging cycle

## File Lifecycle

```
current-task.json (created by user/expert)
    ↓
test-results.json (created by validation-tester)
    ↓
analysis-report.json (created by validation-debugger)
    ↓
current-task.json (updated by validation-expert)
    ↓
[Repeat until tests pass]
```

## Best Practices

### For Agents Writing to Workspace:

1. **Always update timestamps**:
   ```typescript
   json.lastUpdated = new Date().toISOString();
   ```

2. **Include task ID for tracking**:
   ```typescript
   json.taskId = currentTask.taskId;
   ```

3. **Be specific in descriptions**:
   - ❌ "Fix the logic"
   - ✅ "Add filter for walk-in contexts (#G160, #AR) in patient count"

4. **Provide actionable next steps**:
   ```typescript
   nextSteps: [
     "1. Update server/modules/validateur/validation/ruleTypeHandlers.ts:145",
     "2. Add: const registered = records.filter(r => !walkInContexts.includes(r.elementDeContexte))",
     "3. Run: npm run test:validation"
   ]
   ```

### For Agents Reading from Workspace:

1. **Check file exists before reading**:
   ```typescript
   if (fs.existsSync('tests/validation-workspace/test-results.json')) {
     const results = JSON.parse(await fs.readFile(...));
   }
   ```

2. **Validate task ID matches**:
   ```typescript
   if (testResults.taskId !== currentTask.taskId) {
     console.warn('Task ID mismatch - results may be stale');
   }
   ```

3. **Handle empty/missing data gracefully**:
   ```typescript
   const failures = testResults.failures || [];
   ```

## Human Interaction

Developers can inspect these files to:
- **Understand what agents are working on** (current-task.json)
- **See test results** (test-results.json)
- **Review diagnostic analysis** (analysis-report.json)
- **Check rule dependencies** (rule-dependencies.json)

Example:
```bash
# Check current task
cat tests/validation-workspace/current-task.json

# See latest test results
cat tests/validation-workspace/test-results.json | jq '.failures'

# Review debugging analysis
cat tests/validation-workspace/analysis-report.json | jq '.failureAnalysis[]'
```

## Maintenance

These files should be:
- ✅ Committed to version control (track agent workflow history)
- ✅ Updated atomically (write to temp file, then rename)
- ✅ Validated against schemas before use
- ❌ Not manually edited (use agents or proper tooling)

## Future Enhancements

- [ ] Add workflow status dashboard
- [ ] Implement agent task queue
- [ ] Add automated task prioritization
- [ ] Create visualization of agent collaboration
- [ ] Add webhook notifications for task completion
