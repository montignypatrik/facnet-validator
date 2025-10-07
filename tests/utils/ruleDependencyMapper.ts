/**
 * Rule Dependency Mapper
 *
 * Maps dependencies between RAMQ validation rules for impact analysis.
 * Used by rule-analyzer agent to predict effects of rule changes.
 */

import { storage } from '../../server/core/storage.js';
import type { Rule } from '@shared/schema';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface RuleDependencies {
  codes: string[];
  contexts: string[];
  establishments: string[];
  otherRules: string[];
}

export interface RuleConflict {
  rule1: string;
  rule2: string;
  conflictType: 'overlapping_validation' | 'contradictory_thresholds' | 'missing_dependency';
  severity: 'error' | 'warning';
  description: string;
  resolution: string;
}

export interface CoverageReport {
  totalScenarios: number;
  testedScenarios: number;
  coveragePercent: number;
  gaps: string[];
}

export interface ImpactAnalysis {
  affectedRules: number;
  affectedTests: number;
  riskLevel: 'low' | 'medium' | 'high';
  recommendation: string;
}

export interface DependencyReport {
  generatedDate: string;
  targetRule: {
    ruleId: string;
    ruleName: string;
    ruleType: string;
  };
  dependencies: RuleDependencies;
  conflicts: RuleConflict[];
  impactAnalysis: ImpactAnalysis;
  coverage: CoverageReport;
}

export class RuleDependencyMapper {
  /**
   * Extract dependencies from a validation rule
   */
  async extractRuleDependencies(rule: Rule): Promise<RuleDependencies> {
    const deps: RuleDependencies = {
      codes: [],
      contexts: [],
      establishments: [],
      otherRules: [],
    };

    // Extract codes from rule condition
    if (rule.condition?.codes) {
      deps.codes = Array.isArray(rule.condition.codes)
        ? rule.condition.codes
        : [rule.condition.codes];
    }

    // Extract contexts (walk-in contexts, etc.)
    if (rule.condition?.walkInContexts) {
      deps.contexts = Array.isArray(rule.condition.walkInContexts)
        ? rule.condition.walkInContexts
        : [rule.condition.walkInContexts];
    }

    // Extract establishments if specified
    if (rule.condition?.establishments) {
      deps.establishments = Array.isArray(rule.condition.establishments)
        ? rule.condition.establishments
        : [rule.condition.establishments];
    }

    // Find related rules with same codes or contexts
    const allRules = await storage.getAllRules();
    const relatedRules = allRules.filter(r => {
      if (r.id === rule.id) return false;
      if (!r.enabled) return false;

      const rCodes = r.condition?.codes || [];
      const rContexts = r.condition?.walkInContexts || [];

      // Check if any codes overlap
      const codesOverlap = deps.codes.some(c => rCodes.includes(c));

      // Check if any contexts overlap
      const contextsOverlap = deps.contexts.some(c => rContexts.includes(c));

      return codesOverlap || contextsOverlap;
    });

    deps.otherRules = relatedRules.map(r => r.name);

    return deps;
  }

  /**
   * Detect conflicts between rules
   */
  async detectConflicts(rule: Rule, deps: RuleDependencies): Promise<RuleConflict[]> {
    const conflicts: RuleConflict[] = [];

    // Get all rules that might conflict
    const allRules = await storage.getAllRules();

    for (const otherRule of allRules) {
      if (otherRule.id === rule.id || !otherRule.enabled) continue;

      // Check for overlapping validation (same codes, different logic)
      const otherCodes = otherRule.condition?.codes || [];
      const codesOverlap = deps.codes.some(c => otherCodes.includes(c));

      if (codesOverlap) {
        // Check if both are same rule type (potential conflict)
        if (rule.ruleType === otherRule.ruleType) {
          conflicts.push({
            rule1: rule.name,
            rule2: otherRule.name,
            conflictType: 'overlapping_validation',
            severity: 'warning',
            description: `Both rules validate codes ${deps.codes.join(', ')} with type "${rule.ruleType}"`,
            resolution: 'Review logic to ensure rules are complementary, not duplicative',
          });
        }
      }

      // Check for contradictory thresholds
      if (rule.threshold && otherRule.threshold && codesOverlap) {
        if (rule.threshold !== otherRule.threshold) {
          conflicts.push({
            rule1: rule.name,
            rule2: otherRule.name,
            conflictType: 'contradictory_thresholds',
            severity: 'error',
            description: `Rule "${rule.name}" has threshold ${rule.threshold} but "${otherRule.name}" has threshold ${otherRule.threshold} for overlapping codes`,
            resolution: 'Align thresholds or clarify which rule takes precedence',
          });
        }
      }
    }

    // Check for missing dependencies (referenced codes/contexts that don't exist)
    const codes = await storage.getCodes({ page: 1, pageSize: 10000 });
    const contexts = await storage.getContexts({ page: 1, pageSize: 1000 });

    const existingCodes = codes.data.map(c => c.code);
    const existingContexts = contexts.data.map(c => c.name);

    for (const code of deps.codes) {
      if (!existingCodes.includes(code)) {
        conflicts.push({
          rule1: rule.name,
          rule2: 'N/A',
          conflictType: 'missing_dependency',
          severity: 'error',
          description: `Rule references code "${code}" which does not exist in database`,
          resolution: `Add code "${code}" to RAMQ codes database or update rule condition`,
        });
      }
    }

    for (const context of deps.contexts) {
      if (!existingContexts.includes(context)) {
        conflicts.push({
          rule1: rule.name,
          rule2: 'N/A',
          conflictType: 'missing_dependency',
          severity: 'error',
          description: `Rule references context "${context}" which does not exist in database`,
          resolution: `Add context "${context}" to contexts database or update rule condition`,
        });
      }
    }

    return conflicts;
  }

  /**
   * Calculate test coverage for a rule
   */
  async calculateCoverage(ruleId: string): Promise<CoverageReport> {
    // Find test files in tests/validation-rules/
    const testDir = path.join(process.cwd(), 'tests', 'validation-rules');
    let testFiles: string[] = [];

    try {
      const files = await fs.readdir(testDir);
      testFiles = files
        .filter(f => f.endsWith('.test.ts'))
        .map(f => path.join(testDir, f));
    } catch (error) {
      console.warn(`[ANALYZER] Could not read test directory: ${error}`);
      return {
        totalScenarios: 0,
        testedScenarios: 0,
        coveragePercent: 0,
        gaps: ['No tests found'],
      };
    }

    let totalScenarios = 0;
    let testedScenarios = 0;

    // Count test scenarios in files
    for (const testFile of testFiles) {
      try {
        const content = await fs.readFile(testFile, 'utf-8');

        // Count "it()" test blocks
        const itBlocks = content.match(/it\s*\(['"]/g) || [];
        totalScenarios += itBlocks.length;

        // Count assertions (expect() calls)
        const expectations = content.match(/expect\s*\(/g) || [];
        testedScenarios += expectations.length;
      } catch (error) {
        console.warn(`[ANALYZER] Could not read test file ${testFile}:`, error);
      }
    }

    // Identify common scenario gaps
    const commonScenarios = [
      'zero occurrences',
      'one occurrence',
      'threshold - 1',
      'exactly threshold',
      'threshold + 1',
      'mixed contexts',
      'multiple doctors',
      'edge of date range',
    ];

    const gaps: string[] = [];

    for (const scenario of commonScenarios) {
      let hasTest = false;

      for (const testFile of testFiles) {
        const content = await fs.readFile(testFile, 'utf-8');
        if (content.toLowerCase().includes(scenario.toLowerCase())) {
          hasTest = true;
          break;
        }
      }

      if (!hasTest) {
        gaps.push(scenario);
      }
    }

    const coveragePercent = totalScenarios > 0 ? (testedScenarios / totalScenarios) * 100 : 0;

    return {
      totalScenarios,
      testedScenarios,
      coveragePercent,
      gaps,
    };
  }

  /**
   * Assess impact of rule change
   */
  async assessImpact(rule: Rule): Promise<ImpactAnalysis> {
    const deps = await this.extractRuleDependencies(rule);
    const conflicts = await this.detectConflicts(rule, deps);

    const affectedRules = deps.otherRules.length;

    // Estimate affected tests (rough heuristic: 10 tests per related code)
    const affectedTests = deps.codes.length * 10;

    // Calculate risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    if (conflicts.some(c => c.severity === 'error')) {
      riskLevel = 'high';
    } else if (affectedRules > 3 || conflicts.length > 1) {
      riskLevel = 'medium';
    }

    // Generate recommendation
    let recommendation = '';
    switch (riskLevel) {
      case 'low':
        recommendation = 'Safe to deploy - no conflicts detected';
        break;
      case 'medium':
        recommendation = 'Deploy with caution - review overlapping rules and run full test suite';
        break;
      case 'high':
        recommendation = 'DO NOT deploy - resolve conflicts first';
        break;
    }

    return {
      affectedRules,
      affectedTests,
      riskLevel,
      recommendation,
    };
  }

  /**
   * Generate complete dependency report for a rule
   */
  async generateDependencyReport(ruleId: string): Promise<DependencyReport> {
    // Get rule from database
    const rule = await storage.getRule(ruleId);

    if (!rule) {
      throw new Error(`Rule ${ruleId} not found in database`);
    }

    // Extract all analysis components
    const dependencies = await this.extractRuleDependencies(rule);
    const conflicts = await this.detectConflicts(rule, dependencies);
    const coverage = await this.calculateCoverage(ruleId);
    const impactAnalysis = await this.assessImpact(rule);

    // Build report
    const report: DependencyReport = {
      generatedDate: new Date().toISOString(),
      targetRule: {
        ruleId: rule.id,
        ruleName: rule.name,
        ruleType: rule.ruleType || 'unknown',
      },
      dependencies,
      conflicts,
      impactAnalysis,
      coverage,
    };

    // Save to workspace
    const workspacePath = path.join(
      process.cwd(),
      'tests',
      'validation-workspace',
      'rule-dependencies.json'
    );

    await fs.writeFile(workspacePath, JSON.stringify(report, null, 2), 'utf-8');

    console.log(`[ANALYZER] Report generated for rule: ${rule.name}`);
    console.log(`[ANALYZER] Risk level: ${impactAnalysis.riskLevel}`);
    console.log(`[ANALYZER] Coverage: ${coverage.coveragePercent.toFixed(1)}%`);
    console.log(`[ANALYZER] Conflicts: ${conflicts.length}`);

    return report;
  }
}

// Export singleton instance
export const ruleDependencyMapper = new RuleDependencyMapper();
