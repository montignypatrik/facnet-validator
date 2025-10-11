# RAMQ Validation Rule: Optimisation intervention clinique

Règle d'optimisation pour détecter les visites régulières qui pourraient être facturées comme interventions cliniques pour un revenu supérieur.

---

## Rule Information

**Rule Name (French)**: `Optimisation intervention clinique vs visite régulière`

**Rule ID**: `VISIT_DURATION_OPTIMIZATION`

**Rule Type**: `revenue_optimization` (custom type)

**Severity**: `optimization`

**Category**: `revenue_optimization`

---

## Rule Logic Description

### What This Rule Validates:
```
Cette règle identifie les visites régulières qui ont une durée documentée
(heure de début et heure de fin) et calcule si la facturation en tant
qu'intervention clinique (code 8857 + périodes supplémentaires 8859)
serait plus avantageuse financièrement.

La règle analyse :
1. Visites avec durée ≥ 25 minutes (seuil minimum légal)
2. Comparaison du montant actuel vs montant intervention clinique
3. Suggestion de changement si gain financier > 0

Tarification intervention clinique :
- 8857 (30 min) : 59,70$
- 8859 (15 min supplémentaires) : 29,85$ par période
```

### When Should This Trigger?
```
Trigger quand :
1. Visite a une heure de début ET heure de fin renseignées
2. Durée calculée ≥ 30 minutes (seuil pour code 8857)
3. Code facturé a category = "visite" dans la base de données
4. Montant intervention clinique > montant visite actuelle
5. Code actuel n'est PAS déjà 8857 ou 8859
```

### When Should This NOT Trigger?
```
Ne doit PAS trigger quand :
1. Heure de début ou fin manquante (NULL ou vide)
2. Durée < 30 minutes (insuffisante pour intervention clinique)
3. Code déjà 8857 ou 8859 (déjà intervention clinique)
4. Montant intervention clinique ≤ montant visite actuelle (pas d'avantage)
5. Code n'est pas dans category "visite" (ex: procédures, examens)
```

---

## Target Data

### Target Billing Codes:
```javascript
// Tous les codes avec category = "visite" dans la base de données
// Exclus : codes 8857 et 8859 (déjà interventions cliniques)

targetCategory: "visite"
excludedCodes: ["8857", "8859"]
```

### Required Fields:
```javascript
requiredFields: [
  "Début",           // Heure de début (format HH:MM)
  "Fin",             // Heure de fin (format HH:MM)
  "Code",            // Code de facturation
  "Montant Preliminaire"  // Montant actuel de la visite
]
```

### Duration Calculation:
```javascript
// Calculer durée en minutes entre Début et Fin
// Exemple: Début 10:00, Fin 10:35 = 35 minutes

function calculateDuration(debut, fin) {
  const start = parseTime(debut);  // "10:00" -> Date
  const end = parseTime(fin);      // "10:35" -> Date
  return (end - start) / 60000;    // Millisecondes -> Minutes
}
```

---

## Thresholds & Limits

### Minimum Duration:
```javascript
minimumDuration: 30  // minutes (seuil pour code 8857)
```

### Intervention Clinique Pricing:
```javascript
interventionCliniquePricing: {
  code8857: {
    duration: 30,      // minutes (première période)
    amount: 59.70      // dollars
  },
  code8859: {
    duration: 15,      // minutes (période supplémentaire)
    amount: 29.85      // dollars
  }
}

// Exemples de calcul :
// 30-44 min : 8857 seul = 59,70$
// 45-59 min : 8857 + 8859 (15 min) = 59,70$ + 29,85$ = 89,55$
// 60-74 min : 8857 + 8859 (30 min) = 59,70$ + 59,70$ = 119,40$
// 75-89 min : 8857 + 8859 (45 min) = 59,70$ + 89,55$ = 149,25$
```

### Calculation Logic:
```javascript
function calculateInterventionAmount(durationMinutes) {
  if (durationMinutes < 30) return 0;
  
  let amount = 59.70;  // Code 8857 de base
  let remaining = durationMinutes - 30;
  
  if (remaining > 0) {
    // Périodes supplémentaires de 15 minutes
    const additionalPeriods = Math.ceil(remaining / 15);
    amount += (additionalPeriods * 29.85);
  }
  
  return amount;
}
```

---

## Error Messages (French)

### Primary Optimization Message:
```
"Selon notre analyse, l'intervention clinique est plus avantageuse que la visite {code} facturée."
```

### Solution Message:
```
"Veuillez valider que l'intervention clinique est plus avantageuse et facturer si le seuil de 180 minutes quotidien n'est pas atteint. N'oubliez pas d'ajouter les contextes ICEP, ICSM et ICTOX au besoin."
```

### Message Variables:
```javascript
{code}  // Code actuel de la visite (ex: "00103")

// Note : Le message de solution est maintenant générique et ne nécessite 
// pas de variables dynamiques. Le médecin doit valider lui-même les critères.
```

---

## Test Scenarios

### Pass Scenario 1: No Optimization Needed (Short Visit)
```
Description: Visite de 20 minutes (trop courte pour intervention)
Test Data:
- Code: 00103 (category = "visite")
- Début: 10:00
- Fin: 10:20
- Durée: 20 minutes
- Montant Preliminaire: 35,00$
Expected: No optimization suggestion (< 30 min)
```

### Pass Scenario 2: Already Intervention Clinique
```
Description: Code déjà 8857 (pas besoin d'optimiser)
Test Data:
- Code: 8857
- Début: 10:00
- Fin: 10:35
- Durée: 35 minutes
Expected: No optimization (déjà intervention clinique)
```

### Pass Scenario 3: No Time Data
```
Description: Visite sans heure de début/fin
Test Data:
- Code: 00103 (category = "visite")
- Début: NULL
- Fin: NULL
- Montant Preliminaire: 35,00$
Expected: No optimization (durée non calculable)
```

### Optimization Scenario 1: Simple 30-minute Visit
```
Description: Visite de 30 minutes, intervention plus avantageuse
Test Data:
- Code: 00103 (category = "visite")
- Début: 10:00
- Fin: 10:30
- Durée: 30 minutes
- Montant Preliminaire: 42,50$
- Intervention: 8857 = 59,70$
- Gain: 17,20$
Expected: Optimization suggestion
Message: "Selon notre analyse, l'intervention clinique est plus avantageuse que la visite 00103 facturée."
Solution: "Veuillez valider que l'intervention clinique est plus avantageuse et facturer si le seuil de 180 minutes quotidien n'est pas atteint. N'oubliez pas d'ajouter les contextes ICEP, ICSM et ICTOX au besoin."
```

### Optimization Scenario 2: 45-minute Visit with Additional Period
```
Description: Visite de 45 minutes nécessitant période supplémentaire
Test Data:
- Code: 00113 (category = "visite")
- Début: 14:00
- Fin: 14:45
- Durée: 45 minutes
- Montant Preliminaire: 52,00$
- Intervention: 8857 + 8859 (15 min) = 89,55$
- Gain: 37,55$
Expected: Optimization suggestion
Message: "Selon notre analyse, l'intervention clinique est plus avantageuse que la visite 00113 facturée."
Solution: "Veuillez valider que l'intervention clinique est plus avantageuse et facturer si le seuil de 180 minutes quotidien n'est pas atteint. N'oubliez pas d'ajouter les contextes ICEP, ICSM et ICTOX au besoin."
```

### Optimization Scenario 3: 60-minute Visit
```
Description: Visite d'une heure complète
Test Data:
- Code: 00105 (category = "visite")
- Début: 09:00
- Fin: 10:00
- Durée: 60 minutes
- Montant Preliminaire: 65,00$
- Intervention: 8857 + 8859 (30 min) = 119,40$
- Gain: 54,40$
Expected: Optimization suggestion
Solution: "Veuillez valider que l'intervention clinique est plus avantageuse et facturer si le seuil de 180 minutes quotidien n'est pas atteint. N'oubliez pas d'ajouter les contextes ICEP, ICSM et ICTOX au besoin."
```

### No Optimization Scenario: Intervention Not Advantageous
```
Description: Visite avec tarif élevé, intervention pas avantageuse
Test Data:
- Code: 00XXX (category = "visite", tarif spécial)
- Début: 10:00
- Fin: 10:30
- Durée: 30 minutes
- Montant Preliminaire: 75,00$
- Intervention: 8857 = 59,70$
- Gain: -15,30$ (négatif)
Expected: No optimization (pas avantageux)
```

### Edge Case Scenarios:
```
1. Durée exactement 30 minutes
   Expected: Suggérer 8857 si avantageux

2. Durée 29 minutes (sous le seuil)
   Expected: Pas de suggestion (< 30 min requis pour 8857)

3. Durée 32 minutes (entre 30 et 45)
   Expected: Suggérer 8857 seul (pas de période supplémentaire)

4. Durée 44 minutes (juste avant 45)
   Expected: Suggérer 8857 seul (arrondi pas assez pour période supplémentaire)

5. Heure de fin avant heure de début (erreur de saisie)
   Expected: Pas de suggestion (durée invalide/négative)

6. Début et Fin identiques
   Expected: Pas de suggestion (durée = 0)

7. Montant Preliminaire = 0 ou NULL
   Expected: Pas de suggestion (impossible de comparer)
```

---

## Additional Requirements

### Special Validation Logic:
```javascript
// 1. Vérifier que début et fin sont renseignés
if (!record.debut || !record.fin) {
  return null;  // Pas d'optimisation possible
}

// 2. Calculer durée en minutes
const duration = calculateDuration(record.debut, record.fin);

// 3. Vérifier durée minimale (30 min pour 8857)
if (duration < 30) {
  return null;  // Trop court pour intervention clinique
}

// 4. Vérifier que le code est une visite (via DB)
const codeInfo = await db.getCodeInfo(record.code);
if (codeInfo.category !== "visite") {
  return null;  // Pas une visite
}

// 5. Exclure codes déjà intervention clinique
if (record.code === "8857" || record.code === "8859") {
  return null;  // Déjà intervention clinique
}

// 6. Calculer montant intervention clinique
const interventionAmount = calculateInterventionAmount(duration);

// 7. Comparer avec montant actuel
const currentAmount = parseFloat(record.montantPreliminaire);
const gain = interventionAmount - currentAmount;

// 8. Suggérer seulement si gain > 0
if (gain > 0) {
  return {
    severity: "optimization",
    message: `Selon notre analyse, l'intervention clinique est plus avantageuse que la visite ${record.code} facturée.`,
    solution: buildSolutionMessage(duration, interventionAmount, currentAmount, gain),
    gain: gain
  };
}

return null;  // Pas d'avantage financier
```

### Dependencies on Other Tables:
```
- codes table: Pour vérifier category = "visite"
  SELECT code, category FROM codes WHERE code = ?
  
- Pas besoin de contexts, establishments, etc.
```

### Performance Considerations:
```
Pour un fichier de 10,000 lignes :
- ~30-40% ont début/fin renseignés (~3,500 lignes)
- ~70% de celles-ci sont des visites (~2,500 lignes)
- Calcul simple pour chaque ligne (< 1ms)
- Requête DB une fois au démarrage pour charger catégories

Performance estimée : < 100ms pour 10K lignes
```

---

## Examples from Real Data

### Example CSV Input (Optimisation possible):
```csv
#,Facture,Date de Service,Début,Fin,Code,Montant Preliminaire,Doctor Info,Patient
1,F001,2025-01-07,10:00,10:35,00103,42.50,DR-001,P001
2,F002,2025-01-07,11:00,11:50,00105,55.00,DR-001,P002
3,F003,2025-01-07,14:00,14:25,00113,35.00,DR-001,P003
```

### Expected Validation Output:
```json
{
  "optimizations": [
    {
      "facture": "F001",
      "severity": "optimization",
      "category": "revenue_optimization",
      "message": "Selon notre analyse, l'intervention clinique est plus avantageuse que la visite 00103 facturée.",
      "solution": "Veuillez valider que l'intervention clinique est plus avantageuse et facturer si le seuil de 180 minutes quotidien n'est pas atteint. N'oubliez pas d'ajouter les contextes ICEP, ICSM et ICTOX au besoin.",
      "ruleData": {
        "currentCode": "00103",
        "duration": 35,
        "currentAmount": 42.50,
        "interventionAmount": 59.70,
        "gain": 17.20,
        "suggestedCodes": ["8857"]
      }
    },
    {
      "facture": "F002",
      "severity": "optimization",
      "category": "revenue_optimization",
      "message": "Selon notre analyse, l'intervention clinique est plus avantageuse que la visite 00105 facturée.",
      "solution": "Veuillez valider que l'intervention clinique est plus avantageuse et facturer si le seuil de 180 minutes quotidien n'est pas atteint. N'oubliez pas d'ajouter les contextes ICEP, ICSM et ICTOX au besoin.",
      "ruleData": {
        "currentCode": "00105",
        "duration": 50,
        "currentAmount": 55.00,
        "interventionAmount": 89.55,
        "gain": 34.55,
        "suggestedCodes": ["8857", "8859"]
      }
    }
  ],
  "noOptimization": [
    {
      "facture": "F003",
      "reason": "Durée insuffisante (25 minutes < 30 minutes requises)"
    }
  ]
}
```

---

## Implementation Priority

**Priority**: `Medium`

**Estimated Complexity**: `Medium`
- Calcul de durée à partir de début/fin
- Requête DB pour vérifier category = "visite"
- Logique de calcul intervention clinique
- Comparaison et calcul du gain
- Formatage de message dynamique

**Business Impact**:
```
Moyen à élevé - Optimisation des revenus pour les médecins.

Impact potentiel :
- Gain moyen : 20-40$ par visite optimisée
- Fréquence : ~5-10% des visites pourraient bénéficier
- Revenu mensuel additionnel : 1,000$ - 3,000$ par médecin

Avantages :
✅ Maximise les revenus légitimes
✅ Éduque les médecins sur la facturation optimale
✅ Utilise les données de durée déjà collectées
✅ Aucun risque de rejet RAMQ (codes légitimes)

Cette règle transforme des données sous-utilisées (heures début/fin)
en opportunités de revenus concrètes.
```

---

## Notes & Clarifications

```
IMPORTANT : Cette règle est une suggestion, pas une obligation

Les médecins conservent la liberté de choisir le code approprié
selon le contenu clinique de la visite. L'intervention clinique
nécessite des critères cliniques spécifiques (counseling, soutien,
information au patient, etc.).

Cette règle identifie seulement les OPPORTUNITÉS POTENTIELLES
basées sur la durée documentée.

Prérequis pour intervention clinique (article 2.2.6 B) :
- Équivalent en contenu clinique à un examen/visite/consultation
- Durée plus longue pour conseil, soutien, information
- OU communication via interprète/accompagnateur

La règle suppose que si une visite régulière dure 30+ minutes,
elle pourrait potentiellement qualifier comme intervention clinique
si les critères cliniques sont remplis.

Format des heures :
- Début/Fin au format HH:MM (ex: "10:00", "14:30")
- Calcul traverse minuit si nécessaire (ex: 23:30 à 00:15 = 45 min)

Arrondissement des périodes supplémentaires :
- Arrondi AU SUPÉRIEUR par tranches de 15 minutes
- Exemple : 32 minutes = 30 min base (pas de période supplémentaire)
- Exemple : 45 minutes = 30 min base + 15 min supplémentaire
- Exemple : 46 minutes = 30 min base + 15 min supplémentaire (arrondi)
```

---

## Approval & Sign-off

**Requested By**: Direction médicale
**Date Requested**: 2025-01-10
**Approved By**: Service de facturation
**Implementation Deadline**: 2025-02-01
**Status**: ⏳ En attente d'implémentation
