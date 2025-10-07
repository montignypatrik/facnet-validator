-- Migration: Add Annual Billing Code Validation Rule
-- Date: 2025-01-06
-- Purpose: Add rule for codes that can only be billed once per calendar year per patient
--
-- Target billing codes identified by leaf field:
-- 1. "Visite de prise en charge" (Initial care visit)
-- 2. "Visite périodique" (Periodic visit)
-- 3. "Visite de prise en charge d'un problème musculo squelettique" (Musculoskeletal initial care)
--
-- IMPORTANT: Run this with proper UTF-8 encoding:
-- psql -h localhost -U dashvalidator_user -d dashvalidator -f migrations/add_annual_billing_code_rule.sql

INSERT INTO rules (
  rule_id,
  name,
  rule_type,
  description,
  condition,
  enabled,
  severity
) VALUES (
  'ANNUAL_BILLING_CODE',
  'Code à facturation annuel',
  'annual_billing_code',
  'Certains codes peuvent être facturés une seule fois par année civile (1er janvier au 31 décembre) par patient. Les codes concernés sont: Visite de prise en charge, Visite périodique, et Visite de prise en charge d''un problème musculo squelettique.',
  '{"category": "annual_limit", "leafPatterns": ["Visite de prise en charge", "Visite périodique", "Visite de prise en charge d''un problème musculo squelettique"]}',
  true,
  'error'
)
ON CONFLICT (rule_id) DO UPDATE SET
  condition = EXCLUDED.condition,
  description = EXCLUDED.description,
  enabled = EXCLUDED.enabled,
  updated_at = NOW();
