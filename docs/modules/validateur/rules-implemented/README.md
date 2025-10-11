# Règles de Validation Implémentées

Ce répertoire contient la documentation de toutes les règles de validation RAMQ actuellement implémentées et actives dans le système.

## Règles Actives

### 1. Code à Facturation Annuel
**Fichier**: [ANNUAL_BILLING_CODE.md](./ANNUAL_BILLING_CODE.md)
**Rule ID**: `ANNUAL_BILLING_CODE`
**Type**: `annual_billing_code`
**Sévérité**: `error`
**Statut**: ✅ Actif

Valide que les codes de facturation annuels (identifiés par leurs champs `leaf`) ne peuvent être facturés qu'une seule fois par patient par année civile.

---

### 2. Frais de Bureau (19928/19929)
**Fichier**: [OFFICE_FEE_19928_19929.md](./OFFICE_FEE_19928_19929.md)
**Rule ID**: `OFFICE_FEE_19928_19929`
**Type**: `office_fee_validation` (custom)
**Sévérité**: `error`
**Statut**: ✅ Actif

Valide les frais de bureau quotidiens pour les codes 19928 et 19929, avec des exigences spécifiques pour les patients inscrits vs sans rendez-vous.

---

## Types de Règles Disponibles

Les handlers suivants sont implémentés dans le système:

| Type de Règle | Handler | Description |
|---------------|---------|-------------|
| `prohibition` | `validateProhibition` | Codes ne pouvant être facturés ensemble |
| `time_restriction` | `validateTimeRestriction` | Règles basées sur le temps (après-heures, week-ends) |
| `requirement` | `validateRequirement` | Codes nécessitant d'autres codes/conditions |
| `location_restriction` | `validateLocationRestriction` | Règles basées sur le lieu de pratique |
| `age_restriction` | `validateAgeRestriction` | Règles basées sur l'âge du patient |
| `amount_limit` | `validateAmountLimit` | Limites de montant en dollars par période |
| `mutual_exclusion` | `validateMutualExclusion` | Un seul code d'un groupe par période |
| `missing_annual_opportunity` | `validateMissingAnnualOpportunity` | Alertes d'optimisation de revenus |
| `annual_limit` | `validateAnnualLimit` | Codes une fois par année (version simple) |
| `annual_billing_code` | `validateAnnualBillingCode` | Codes une fois par année (version avancée avec matching leaf) |

---

## Comment Ajouter une Nouvelle Règle

1. Créer un fichier de proposition dans [../rules-future/](../rules-future/)
2. Utiliser le [RULE_TEMPLATE.md](../RULE_TEMPLATE.md) comme base
3. Suivre le guide [RULE_CREATION_GUIDE.md](../RULE_CREATION_GUIDE.md)
4. Une fois implémentée et testée, déplacer la documentation ici

---

## Structure des Fichiers de Règles

Chaque fichier de règle implémentée doit contenir:

- ✅ **Informations de la règle** (nom, ID, type, sévérité)
- ✅ **Description de la logique** (quoi, quand, exceptions)
- ✅ **Données cibles** (codes, contextes, établissements)
- ✅ **Seuils et limites** (minimums, maximums, périodes)
- ✅ **Messages d'erreur** (français)
- ✅ **Scénarios de test** (pass, fail, edge cases)
- ✅ **Exemples de données réelles** (CSV input/output)
- ✅ **Statut d'implémentation** (date, version, tests)
- ✅ **Historique des modifications** (changements, corrections)

---

## Maintenance

Lors de la modification d'une règle existante:

1. Mettre à jour le fichier de documentation correspondant
2. Ajouter une entrée dans la section "Historique des modifications"
3. Mettre à jour les tests si nécessaire
4. Vérifier que la description correspond au code actuel

---

## Statistiques

- **Règles actives**: 2
- **Handlers disponibles**: 10
- **Types personnalisés**: 1 (office_fee_validation)
- **Dernière mise à jour**: 2025-10-10
