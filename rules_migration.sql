--
-- PostgreSQL database dump
--

\restrict 7f79chd3bzjodxhlSBrx1tEBsJqJnZQ6RixGFnCngaWVQwEcFhvwZZJ8qEqTwpl

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: rules; Type: TABLE DATA; Schema: public; Owner: dashvalidator_user
--

INSERT INTO public.rules (id, name, condition, threshold, enabled, custom_fields, updated_at, updated_by, description, rule_type, severity, created_at, rule_id) VALUES ('078a2980-cb84-4bd5-b9af-69cfb41ee79f', 'Office Fee Validation (19928/19929)', '{"type": "office_fee_validation", "codes": ["19928", "19929"], "category": "office_fees", "thresholds": {"19928": {"walkIn": 10, "registered": 6}, "19929": {"walkIn": 20, "registered": 12}}, "walkInContexts": ["G160", "AR", "#G160", "#AR"]}', 64.8, true, '{}', '2025-09-28 00:44:49.012501', NULL, NULL, NULL, 'error', '2025-10-04 21:51:21.80552', 'OFFICE_FEE_19928_19929');
INSERT INTO public.rules (id, name, condition, threshold, enabled, custom_fields, updated_at, updated_by, description, rule_type, severity, created_at, rule_id) VALUES ('ba4c58dc-5558-4ce4-9408-296a990b8a93', 'Code a facturation annuel', '{"category": "annual_limit", "leafPatterns": ["Visite de prise en charge", "Visite périodique", "Visite de prise en charge d''un problème musculo squelettique"]}', NULL, true, '{}', '2025-10-07 00:27:12.203272', NULL, 'Annual billing code validation rule', 'annual_billing_code', 'error', '2025-10-07 00:27:12.203272', 'ANNUAL_BILLING_CODE');


--
-- PostgreSQL database dump complete
--

\unrestrict 7f79chd3bzjodxhlSBrx1tEBsJqJnZQ6RixGFnCngaWVQwEcFhvwZZJ8qEqTwpl

