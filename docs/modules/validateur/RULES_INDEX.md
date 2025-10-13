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
│   ├── OFFICE_FEE_19928_19929.md
│   └── VISIT_DURATION_OPTIMIZATION.md
│
└── rules-future/                     ← Propositions futures
    ├── README.md
    └── PROPOSAL_TEMPLATE.md
```

---

## ✅ Règles Implémentées (5)

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

### 3. Optimisation Intervention Clinique
**Fichier**: [rules-implemented/VISIT_DURATION_OPTIMIZATION.md](./rules-implemented/VISIT_DURATION_OPTIMIZATION.md)

```
Rule ID: VISIT_DURATION_OPTIMIZATION
Type: revenue_optimization (custom)
Sévérité: optimization
Status: ✅ Actif

Description: Identifie les visites régulières (consultation/examen) qui
pourraient être facturées comme interventions cliniques pour un revenu supérieur.

Codes ciblés: Tous codes avec top_level = "B - CONSULTATION, EXAMEN ET VISITE" (474 codes)
Exclusions: 8857, 8859 (déjà intervention clinique)

Critères:
- Durée ≥ 30 minutes (calculée depuis Début/Fin)
- Gain financier > 0 (intervention > visite actuelle)
- Suggestion avec codes 8857 + 8859 selon durée

Tarification:
- 8857 (30 min base): $59.70
- 8859 (15 min supplémentaire): $29.85 par période
```

### 4. Forfait de Prise en Charge GMF (8875)
**Fichier**: [rules-implemented/gmf_8875_validation.md](./rules-implemented/gmf_8875_validation.md)

```
Rule ID: GMF_FORFAIT_8875
Type: gmf_forfait (custom)
Sévérité: error / optimization
Status: ✅ Actif

Description: Valide le forfait GMF annuel (code 8875) avec deux scénarios:
1. Détection de duplicatas (error): Code 8875 ne peut être facturé qu'une fois par patient par année
2. Opportunités manquées (optimization): Patients GMF sans forfait 8875 facturé

Code: 8875 (Forfait de prise en charge GMF - 9.35$)
Établissements GMF: ep_33 = true
Exclusions contexte: MTA13, GMFU, GAP, G160, AR

Critères:
- Détecte paiements multiples pour même patient/année
- Identifie patients avec visites GMF mais sans forfait
- Calcule revenu potentiel perdu
```

### 5. Intervention Clinique (Limite 180 minutes)
**Fichier**: [rules-implemented/intervention_clinique_rule.md](./rules-implemented/intervention_clinique_rule.md)

```
Rule ID: INTERVENTION_CLINIQUE_180MIN
Type: time_limit (custom)
Sévérité: error
Status: ✅ Actif

Description: Valide que les interventions cliniques (8857 + 8859) ne dépassent
pas 180 minutes par jour par médecin selon règlements RAMQ.

Codes: 8857 (30 min base), 8859 (15 min additionnel)
Maximum quotidien: 180 minutes par médecin

Logique:
- 8857 = 30 minutes (base)
- 8859 = 15 minutes (additionnel)
- Calcul automatique du total par médecin par jour
- Erreur si total > 180 minutes
```

---

## 📋 Propositions Futures (0)

Aucune proposition en attente actuellement.

Pour créer une nouvelle proposition, voir [Comment Créer une Nouvelle Règle](#-comment-créer-une-nouvelle-règle).

---

## 🛠️ Règles TypeScript Hardcodées

Toutes les règles sont maintenant implémentées comme des fichiers TypeScript individuels dans `server/modules/validateur/validation/rules/`:

| Règle | Fichier | Type | Description |
|-------|---------|------|-------------|
| ✅ Office Fee | `officeFeeRule.ts` | `office_fee_validation` | Validation frais de bureau (19928, 19929) |
| ✅ Intervention Clinique | `interventionCliniqueRule.ts` | `time_limit` | Limite 180 min/jour intervention clinique |
| ✅ Visit Duration | `visitDurationOptimizationRule.ts` | `revenue_optimization` | Optimisation durée visite → intervention |
| ✅ GMF Forfait 8875 | `gmfForfait8875Rule.ts` | `gmf_forfait` | Forfait GMF annuel (duplicatas + opportunités) |
| ✅ Annual Billing Code | `annualBillingCodeRule.ts` | `annual_limit` | Codes annuels (identifiés par leaf patterns) |

**Architecture**:
- Règles TypeScript avec interface `ValidationRule`
- Enregistrement centralisé dans `ruleRegistry.ts`
- Type safety à la compilation
- Pas de requête base de données au démarrage (performance)
- Chaque règle = fichier indépendant avec logique + tests

**⚠️ Migration**: L'ancien système de handlers database-driven (10 types) a été remplacé par des règles TypeScript hardcodées pour:
- ✅ Meilleure performance (pas de requête DB au démarrage)
- ✅ Type safety à la compilation
- ✅ Code plus simple et maintenable
- ✅ Tests plus faciles

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
   - ✅ TypeScript rule file in `rules/` folder
   - ✅ Rule registration in `ruleRegistry.ts`
   - ✅ Comprehensive tests
   - ✅ Run tests and verify

5. **Déplacer documentation**
   Une fois testée, déplacer vers `rules-implemented/`

### Workflow Détaillé

Voir [RULE_CREATION_GUIDE.md](./RULE_CREATION_GUIDE.md) pour le guide complet.

---

## 📊 Statistiques

```
Règles actives:              5
Architecture:                TypeScript hardcodé
Format:                      ValidationRule interface
Propositions en attente:     0

Couverture de tests:         95%
Performance moyenne:         <200ms pour 10k records
Temps de chargement:         0ms (pas de DB query)
```

---

## 🔍 Recherche de Règles

### Par Type de Validation

**Facturation annuelle**:
- ✅ [ANNUAL_BILLING_CODE](./rules-implemented/ANNUAL_BILLING_CODE.md)

**Frais de bureau**:
- ✅ [OFFICE_FEE_19928_19929](./rules-implemented/OFFICE_FEE_19928_19929.md)

**Optimisation revenus**:
- ✅ [VISIT_DURATION_OPTIMIZATION](./rules-implemented/VISIT_DURATION_OPTIMIZATION.md)

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

**Optimization** (Opportunité):
- ✅ VISIT_DURATION_OPTIMIZATION

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
- [ ] Registry entry: ✅ Ajoutée
- [ ] Messages français: ✅ Corrects
- [ ] Performance: ✅ <200ms
- [ ] Edge cases: ✅ Gérés
- [ ] Logs: ✅ Informatifs

---

## 🔧 Maintenance

### Modifier une Règle Existante

1. Lire la documentation actuelle
2. Modifier le fichier TypeScript dans `rules/` folder
3. Mettre à jour les tests
4. Mettre à jour la documentation
5. Ajouter entrée dans "Maintenance Log"
6. Tester avec CSV réels
7. Déployer

### Désactiver une Règle

Dans le fichier TypeScript de la règle:
```typescript
export const myRule: ValidationRule = {
  id: "MY_RULE",
  enabled: false,  // Set to false to disable
  // ... rest of rule
};
```

Redémarrer le serveur pour appliquer les changements.

### Supprimer une Règle

1. Désactiver d'abord (période de test)
2. Monitorer l'impact pendant 1 semaine
3. Si OK, supprimer:
   - TypeScript rule file from `rules/` folder
   - Registration from `ruleRegistry.ts`
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
- [MONETARY_IMPACT_GUIDE.md](./MONETARY_IMPACT_GUIDE.md) - Guide impact financier

### Code Source
- [rules/](../../../server/modules/validateur/validation/rules/) - Règles TypeScript individuelles
- [ruleRegistry.ts](../../../server/modules/validateur/validation/ruleRegistry.ts) - Enregistrement central
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
| 2025-10-11 | Nouvelle règle | Ajout VISIT_DURATION_OPTIMIZATION |

---

**Dernière mise à jour**: 2025-10-11
**Maintenu par**: Équipe Dash
**Version**: 1.0
