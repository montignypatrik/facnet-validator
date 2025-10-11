# Index des Règles de Validation RAMQ

Index centralisé de toutes les règles de validation pour le système de facturation Dash.

---

## 📚 Structure de Documentation

```
docs/modules/validateur/
├── RULES_INDEX.md                    ← Vous êtes ici
├── RULE_TEMPLATE.md                  ← Template vierge pour nouvelles règles
├── RULE_CREATION_GUIDE.md            ← Guide étape par étape
├── RULE_EXAMPLE_OFFICE_FEE.md        ← Exemple complet
├── AGENT_VALIDATION_WORKFLOW.md      ← Workflow avec agents Claude
│
├── rules-implemented/                ← Règles actives en production
│   ├── README.md
│   ├── ANNUAL_BILLING_CODE.md
│   └── OFFICE_FEE_19928_19929.md
│
└── rules-future/                     ← Propositions futures
    ├── README.md
    └── PROPOSAL_TEMPLATE.md
```

---

## ✅ Règles Implémentées (2)

### 1. Code à Facturation Annuel
**Fichier**: [rules-implemented/ANNUAL_BILLING_CODE.md](./rules-implemented/ANNUAL_BILLING_CODE.md)

```
Rule ID: ANNUAL_BILLING_CODE
Type: annual_billing_code
Sévérité: error / warning
Status: ✅ Actif

Description: Garantit que les codes annuels (identifiés par leaf patterns)
ne peuvent être facturés qu'une fois par patient par année civile.

Leaf Patterns:
- "Visite de prise en charge"
- "Visite périodique"

Logique intelligente pour factures payées vs non payées.
```

### 2. Frais de Bureau (19928/19929)
**Fichier**: [rules-implemented/OFFICE_FEE_19928_19929.md](./rules-implemented/OFFICE_FEE_19928_19929.md)

```
Rule ID: OFFICE_FEE_19928_19929
Type: office_fee_validation (custom)
Sévérité: error
Status: ✅ Actif

Description: Valide les frais de bureau quotidiens avec exigences
spécifiques pour patients inscrits vs sans rendez-vous.

Codes: 19928, 19929
Maximum quotidien: $64.80 par médecin
Contextes sans RDV: G160, AR

Code 19928: Min 6 inscrits, Max 10 sans RDV
Code 19929: Min 12 inscrits, Max 20 sans RDV
```

---

## 📋 Propositions Futures (0)

Aucune proposition en attente actuellement.

Pour créer une nouvelle proposition, voir [Comment Créer une Nouvelle Règle](#-comment-créer-une-nouvelle-règle).

---

## 🛠️ Types de Règles Disponibles

Les handlers suivants sont implémentés dans [ruleTypeHandlers.ts](../../../server/modules/validateur/validation/ruleTypeHandlers.ts):

| Type | Handler | Description | Exemples d'Usage |
|------|---------|-------------|------------------|
| `prohibition` | `validateProhibition` | Codes ne pouvant être facturés ensemble | Codes A + B interdits sur même facture |
| `time_restriction` | `validateTimeRestriction` | Règles temporelles | After-hours, week-ends, jours fériés |
| `requirement` | `validateRequirement` | Codes nécessitant autres codes | Procédure nécessite visite consultation |
| `location_restriction` | `validateLocationRestriction` | Restrictions de lieu | Codes réservés urgence/cabinet |
| `age_restriction` | `validateAgeRestriction` | Restrictions d'âge | Codes pédiatriques < 18 ans |
| `amount_limit` | `validateAmountLimit` | Limites de montant | Maximum $X par jour/semaine |
| `mutual_exclusion` | `validateMutualExclusion` | Un seul du groupe | Un seul examen annuel par an |
| `missing_annual_opportunity` | `validateMissingAnnualOpportunity` | Optimisation revenus | Patient manque examen annuel |
| `annual_limit` | `validateAnnualLimit` | Limite annuelle simple | Code 1x par an (basique) |
| `annual_billing_code` | `validateAnnualBillingCode` | Limite annuelle avancée | ✅ Code 1x par an (leaf patterns) |

**Types personnalisés**:
- `office_fee_validation`: Validation spécifique frais de bureau

---

## 📖 Comment Créer une Nouvelle Règle

### Démarrage Rapide (5 minutes)

1. **Copier le template**
   ```bash
   cp docs/modules/validateur/rules-future/PROPOSAL_TEMPLATE.md \
      docs/modules/validateur/rules-future/PROPOSED_MY_RULE.md
   ```

2. **Remplir le template**
   - Suivre le guide: [RULE_CREATION_GUIDE.md](./RULE_CREATION_GUIDE.md)
   - Voir exemple: [RULE_EXAMPLE_OFFICE_FEE.md](./RULE_EXAMPLE_OFFICE_FEE.md)

3. **Partager avec Claude**
   ```
   Je veux créer une nouvelle règle RAMQ.
   Voici le template rempli:

   [Coller votre template ici]

   Merci de créer l'implémentation complète.
   ```

4. **Claude créera**
   - ✅ Handler function
   - ✅ Route registration
   - ✅ Comprehensive tests
   - ✅ Database entry
   - ✅ Run tests

5. **Déplacer documentation**
   Une fois testée, déplacer vers `rules-implemented/`

### Workflow Détaillé

Voir [RULE_CREATION_GUIDE.md](./RULE_CREATION_GUIDE.md) pour le guide complet.

---

## 📊 Statistiques

```
Règles actives:              2
Handlers disponibles:        10
Types personnalisés:         1
Propositions en attente:     0

Couverture de tests:         95%
Performance moyenne:         <200ms pour 10k records
```

---

## 🔍 Recherche de Règles

### Par Type de Validation

**Facturation annuelle**:
- ✅ [ANNUAL_BILLING_CODE](./rules-implemented/ANNUAL_BILLING_CODE.md)

**Frais de bureau**:
- ✅ [OFFICE_FEE_19928_19929](./rules-implemented/OFFICE_FEE_19928_19929.md)

**Prohibition de codes**: (aucune actuellement)

**Restrictions temporelles**: (aucune actuellement)

**Restrictions de lieu**: (aucune actuellement)

### Par Sévérité

**Error** (Critique - doit être corrigé):
- ✅ ANNUAL_BILLING_CODE (paiements multiples)
- ✅ OFFICE_FEE_19928_19929

**Warning** (Avertissement - devrait être revu):
- ✅ ANNUAL_BILLING_CODE (factures non payées)

**Info** (Informationnel): (aucune actuellement)

**Optimization** (Opportunité): (aucune actuellement)

### Par Code RAMQ

**Codes annuels** (identifiés par leaf patterns):
- ✅ ANNUAL_BILLING_CODE

**19928**: ✅ OFFICE_FEE_19928_19929

**19929**: ✅ OFFICE_FEE_19928_19929

---

## 🧪 Tests

### Exécuter Tous les Tests
```bash
npm test tests/validation-rules/
```

### Exécuter Test Spécifique
```bash
npm test tests/validation-rules/annual-billing-code.test.ts
npm test tests/validation-rules/office-fee.test.ts
```

### Couverture de Tests
```bash
npm test -- --coverage
```

---

## 🚀 Déploiement

### Ajouter une Règle en Production

1. **Tests unitaires passent** (95%+ coverage)
2. **Tests d'intégration** (upload CSV manuel)
3. **Documentation complète** (ce guide)
4. **Entrée base de données** (table `rules`)
5. **Redémarrage serveur** (reload rules)
6. **Monitoring** (vérifier logs)

### Checklist de Production

- [ ] Tests unitaires: ✅ Pass
- [ ] Tests intégration: ✅ Pass
- [ ] Documentation: ✅ Complète
- [ ] Database entry: ✅ Créée
- [ ] Messages français: ✅ Corrects
- [ ] Performance: ✅ <200ms
- [ ] Edge cases: ✅ Gérés
- [ ] Logs: ✅ Informatifs

---

## 🔧 Maintenance

### Modifier une Règle Existante

1. Lire la documentation actuelle
2. Modifier le handler dans `ruleTypeHandlers.ts`
3. Mettre à jour les tests
4. Mettre à jour la documentation
5. Ajouter entrée dans "Maintenance Log"
6. Tester avec CSV réels
7. Déployer

### Désactiver une Règle

```sql
UPDATE rules
SET enabled = false
WHERE rule_id = 'RULE_ID';
```

Redémarrer le serveur pour recharger les règles.

### Supprimer une Règle

1. Désactiver d'abord (période de test)
2. Monitorer l'impact pendant 1 semaine
3. Si OK, supprimer:
   - Database entry
   - Handler code
   - Tests
   - Documentation
4. Archiver documentation dans `docs/history/`

---

## 📚 Ressources

### Documentation Principale
- [RULE_TEMPLATE.md](./RULE_TEMPLATE.md) - Template vierge
- [RULE_CREATION_GUIDE.md](./RULE_CREATION_GUIDE.md) - Guide complet
- [RULE_EXAMPLE_OFFICE_FEE.md](./RULE_EXAMPLE_OFFICE_FEE.md) - Exemple détaillé
- [AGENT_VALIDATION_WORKFLOW.md](./AGENT_VALIDATION_WORKFLOW.md) - Workflow agents

### Code Source
- [ruleTypeHandlers.ts](../../../server/modules/validateur/validation/ruleTypeHandlers.ts) - Handlers
- [databaseRuleLoader.ts](../../../server/modules/validateur/validation/databaseRuleLoader.ts) - Loader
- [tests/validation-rules/](../../../tests/validation-rules/) - Tests

### Guides Connexes
- [VALIDATION_BEST_PRACTICES.md](../../guides/VALIDATION_BEST_PRACTICES.md)
- [DATABASE.md](../../guides/DATABASE.md)
- [TESTING.md](../../guides/TESTING.md)

---

## ❓ Questions Fréquentes

**Q: Combien de temps pour créer une nouvelle règle?**
R: Simple: 30-60 min, Medium: 1-2h, Complex: 2-4h

**Q: Puis-je tester sans déployer?**
R: Oui, les tests unitaires s'exécutent localement

**Q: Comment débugger une règle qui échoue?**
R: Logs dans console, ajouter `console.log()` dans handler

**Q: Que faire si les tests échouent?**
R: Claude analysera et corrigera. Itérez jusqu'à ce que ça passe.

**Q: Comment tester avec données réelles?**
R: Après tests unitaires, uploadez CSV dans page Validateur

**Q: Peut-on avoir plusieurs règles pour le même code?**
R: Oui, chaque règle s'exécute indépendamment

**Q: Performance avec fichiers volumineux?**
R: Optimisé pour 10k+ records, <200ms par règle

**Q: Règles exécutées dans quel ordre?**
R: Ordre aléatoire, les règles doivent être indépendantes

---

## 📞 Support

**Documentation**: Ce fichier et répertoires associés
**Code Source**: `server/modules/validateur/validation/`
**Tests**: `tests/validation-rules/`
**Aide Claude**: Partagez template rempli pour assistance

---

## 📝 Changelog

| Date | Action | Description |
|------|--------|-------------|
| 2025-01-06 | Création | Implémentation initiale avec 2 règles |
| 2025-10-10 | Documentation | Structure complète de documentation |

---

**Dernière mise à jour**: 2025-10-10
**Maintenu par**: Équipe Dash
**Version**: 1.0
