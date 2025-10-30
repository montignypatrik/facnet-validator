# Règles de Validation Futures

Ce répertoire contient les propositions de règles de validation RAMQ qui sont planifiées mais pas encore implémentées.

## Comment Proposer une Nouvelle Règle

### Étape 1: Copier le Template
Utilisez le fichier [PROPOSAL_TEMPLATE.md](./PROPOSAL_TEMPLATE.md) comme point de départ.

### Étape 2: Remplir les Détails
Suivez le guide [RULE_CREATION_GUIDE.md](../RULE_CREATION_GUIDE.md) pour remplir chaque section.

### Étape 3: Soumettre la Proposition
1. Créer un fichier avec le nom `PROPOSED_[RULE_NAME].md`
2. Remplir toutes les sections obligatoires
3. Partager avec Claude pour implémentation

### Étape 4: Implémentation
Une fois implémentée et testée, la règle sera déplacée vers [../rules-implemented/](../rules-implemented/).

---

## Format des Noms de Fichiers

Utilisez cette convention de nommage:

```
PROPOSED_[RULE_ID].md
```

**Exemples**:
- `PROPOSED_WEEKEND_BILLING.md`
- `PROPOSED_PEDIATRIC_AGE_CHECK.md`
- `PROPOSED_EMERGENCY_ROOM_CODES.md`

---

## Priorités des Propositions

### 🔴 Haute Priorité
Règles bloquant des revenus ou causant des rejets RAMQ fréquents.

### 🟡 Priorité Moyenne
Règles améliorant la conformité mais non urgentes.

### 🟢 Basse Priorité
Règles d'optimisation ou d'alertes informatives.

---

## Statuts des Propositions

Chaque proposition peut avoir l'un de ces statuts:

| Statut | Description |
|--------|-------------|
| 📝 **Draft** | En cours de rédaction, incomplet |
| ✅ **Ready** | Prêt pour implémentation |
| 🚧 **In Progress** | Implémentation en cours |
| ⏸️ **On Hold** | En attente d'informations ou d'approbation |
| ❌ **Rejected** | Proposition rejetée avec justification |
| ✨ **Implemented** | Implémenté et déplacé vers rules-implemented/ |

---

## Checklist avant Implémentation

Avant de demander à Claude d'implémenter une règle, assurez-vous que:

- [ ] Le nom de la règle est en français
- [ ] Le Rule ID est en UPPERCASE_SNAKE_CASE
- [ ] Le type de règle est sélectionné (ou nouveau type décrit)
- [ ] La sévérité est définie (error/warning/info/optimization)
- [ ] Les codes cibles sont spécifiés
- [ ] Le message d'erreur en français est rédigé
- [ ] Le message de solution en français est rédigé
- [ ] Au moins 2 scénarios de test "pass" sont définis
- [ ] Au moins 2 scénarios de test "fail" sont définis
- [ ] Les cas limites (edge cases) sont considérés
- [ ] Un exemple CSV réel est fourni (si disponible)
- [ ] L'impact business est décrit
- [ ] La priorité est assignée

---

## Types de Règles Disponibles

Référez-vous à [../RULE_TEMPLATE.md](../RULE_TEMPLATE.md) pour la liste complète des types de règles et leurs cas d'usage.

### Handlers Existants
- `prohibition` - Codes prohibés ensemble
- `time_restriction` - Restrictions temporelles
- `requirement` - Exigences de codes
- `location_restriction` - Restrictions de lieu
- `age_restriction` - Restrictions d'âge
- `amount_limit` - Limites de montant
- `mutual_exclusion` - Exclusion mutuelle
- `missing_annual_opportunity` - Opportunités manquées
- `annual_limit` - Limite annuelle simple
- `annual_billing_code` - Limite annuelle avancée

### Créer un Nouveau Type
Si aucun handler existant ne correspond à votre besoin, décrivez un nouveau type personnalisé dans votre proposition.

---

## Exemples de Propositions

Voir [../RULE_EXAMPLE_OFFICE_FEE.md](../RULE_EXAMPLE_OFFICE_FEE.md) pour un exemple complet de règle bien documentée.

---

## Questions Fréquentes

**Q: Combien de temps prend l'implémentation d'une règle?**
R: Simple: 30-60 minutes, Medium: 1-2 heures, Complex: 2-4 heures

**Q: Puis-je modifier une règle après implémentation?**
R: Oui, mais documentez les changements dans l'historique de modifications

**Q: Que faire si ma règle échoue aux tests?**
R: Claude analysera les échecs et proposera des corrections. Itérez jusqu'à ce que les tests passent.

**Q: Comment tester avec des données réelles?**
R: Après les tests unitaires, uploadez un fichier CSV dans la page Validateur

---

## Ressources

- [RULE_TEMPLATE.md](../RULE_TEMPLATE.md) - Template vierge
- [RULE_CREATION_GUIDE.md](../RULE_CREATION_GUIDE.md) - Guide détaillé
- [RULE_EXAMPLE_OFFICE_FEE.md](../RULE_EXAMPLE_OFFICE_FEE.md) - Exemple complet
- [AGENT_VALIDATION_WORKFLOW.md](../AGENT_VALIDATION_WORKFLOW.md) - Workflow avec agents

---

## Règles Implémentées mais Désactivées

Ces règles ont été implémentées et testées mais sont actuellement désactivées dans le moteur de validation. Elles sont conservées ici pour référence future.

| Règle | Fichier | Statut | Raison | Date |
|-------|---------|--------|--------|------|
| **GMF Forfait 8875** | [gmf_8875_validation.md](./gmf_8875_validation.md) | ⏸️ Désactivée | Focus sur règles prioritaires (Office Fee, Annual Billing) | 2025-10-30 |
| **Intervention Clinique** | [intervention_clinique_rule.md](./intervention_clinique_rule.md) | ⏸️ Désactivée | Focus sur règles prioritaires (Office Fee, Annual Billing) | 2025-10-30 |
| **Visit Duration Optimization** | [VISIT_DURATION_OPTIMIZATION.md](./VISIT_DURATION_OPTIMIZATION.md) | ⏸️ Désactivée | Focus sur règles prioritaires (Office Fee, Annual Billing) | 2025-10-30 |

**Pour réactiver une règle:**
1. Ouvrir `server/modules/validateur/validation/ruleRegistry.ts`
2. Décommenter l'import de la règle
3. Ajouter la règle au tableau `getAllValidationRules()`
4. Déplacer la documentation vers `../rules-implemented/`

---

## Propositions Actuelles

_Aucune proposition en attente actuellement._

Pour créer une nouvelle proposition, copiez [PROPOSAL_TEMPLATE.md](./PROPOSAL_TEMPLATE.md) et suivez les instructions ci-dessus.
