/**
 * Central Registry of All Hardcoded Validation Rules
 *
 * This file serves as the single source of truth for all validation rules in the system.
 * To add a new rule:
 * 1. Create a new rule file in ./rules/ following the ValidationRule interface
 * 2. Import it here
 * 3. Add it to the getAllValidationRules() array
 * 4. That's it! The rule will automatically be registered and executed
 *
 * References:
 * - docs/modules/validateur/ADDING_NEW_RULES.md - Guide for adding new rules
 * - docs/modules/validateur/rules-implemented/ - Documentation for each rule
 */

import { ValidationRule } from './engine';
import { officeFeeValidationRule } from './rules/officeFeeRule';
import { annualBillingCodeRule } from './rules/annualBillingCodeRule';

// Disabled rules (kept in codebase for future reference):
// import { interventionCliniqueRule } from './rules/interventionCliniqueRule';
// import { visitDurationOptimizationRule } from './rules/visitDurationOptimizationRule';
// import { gmfForfait8875Rule } from './rules/gmfForfait8875Rule';

/**
 * Get all registered validation rules
 *
 * This function returns an array of all active validation rules in the system.
 * Rules are automatically enabled when added to this array.
 *
 * @returns Array of ValidationRule objects
 */
export function getAllValidationRules(): ValidationRule[] {
  return [
    officeFeeValidationRule,
    annualBillingCodeRule,
    // Disabled rules (documentation moved to docs/modules/validateur/rules-future/):
    // interventionCliniqueRule,
    // visitDurationOptimizationRule,
    // gmfForfait8875Rule,
  ];
}

/**
 * Get a specific rule by ID
 *
 * @param ruleId - The unique identifier of the rule
 * @returns The ValidationRule object if found, undefined otherwise
 */
export function getRuleById(ruleId: string): ValidationRule | undefined {
  const allRules = getAllValidationRules();
  return allRules.find(rule => rule.id === ruleId);
}

/**
 * Get all rules in a specific category
 *
 * @param category - The category to filter by
 * @returns Array of ValidationRule objects matching the category
 */
export function getRulesByCategory(category: string): ValidationRule[] {
  const allRules = getAllValidationRules();
  return allRules.filter(rule => rule.category === category);
}

/**
 * Get count of active rules
 *
 * @returns Number of enabled rules
 */
export function getActiveRuleCount(): number {
  return getAllValidationRules().filter(rule => rule.enabled).length;
}
