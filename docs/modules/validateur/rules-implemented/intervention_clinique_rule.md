# RAMQ Validation Rule: Limite quotidienne interventions cliniques

Règle de validation pour les interventions cliniques individuelles selon l'article 2.2.6 B de l'entente RAMQ.

---

## Rule Information

**Rule Name (French)**: `Limite quotidienne interventions cliniques (180 min)`

**Rule ID**: `INTERVENTION_CLINIQUE_DAILY_LIMIT`

**Rule Type**: `daily_time_limit` (custom type)

**Severity**: `error`

**Category**: `intervention_clinique`

---

## Rule Logic Description

### What This Rule Validates:
```
Cette règle valide que le médecin ne facture pas plus de 180 minutes
d'interventions cliniques individuelles dans une même journée, conformément
à l'article 2.2.6 B de l'entente RAMQ.

Les interventions cliniques pour patients avec contexte spécial (ICEP, ICSM, ICTOX)
sont EXCLUES du calcul de la limite quotidienne car ces patients bénéficient
d'une tarification modulée et de règles différentes.

La règle calcule le total des minutes par médecin par jour en utilisant :
- Code 8857 : première période (30 minutes)
- Code 8859 : périodes supplémentaires (durée indiquée dans colonne "Unités")
```

### When Should This Trigger?
```
Trigger quand :
1. Total quotidien > 180 minutes pour un médecin donné
2. Seules les interventions SANS contexte ICEP/ICSM/ICTOX sont comptées
3. Codes 8857 et 8859 uniquement (interventions cliniques individuelles)
4. Calcul par médecin + date de service
```

### When Should This NOT Trigger?
```
Ne doit PAS trigger quand :
1. Total quotidien ≤ 180 minutes
2. Interventions avec contexte ICEP, ICSM ou ICTOX (exclues du calcul)
3. Codes autres que 8857/8859 (autres types d'actes)
4. Différents jours (limite est quotidienne, pas hebdomadaire)
```

---

## Target Data

### Target Billing Codes:
```javascript
codes: ["8857", "8859"]
```

### Excluded Context Elements:
```javascript
excludedContexts: ["ICEP", "ICSM", "ICTOX"]

// CSV Header: "Élément de contexte"
// TypeScript Property (Drizzle): elementContexte
// PostgreSQL Column: element_contexte

// Note: La vérification doit chercher si le contexte CONTIENT ces valeurs
// car le champ peut contenir plusieurs contextes séparés par virgule
// Exemple: "CLSC,ICEP" doit être exclu car contient ICEP
```

### Duration Calculation:
```javascript
code8857: {
  duration: 30  // minutes (première période fixe)
}

code8859: {
  duration: [colonne "Unités"]  // minutes (périodes supplémentaires variables)
}
```

---

## Thresholds & Limits

### Daily Maximum:
```javascript
dailyMaximum: 180  // minutes par médecin par jour
```

### Time Periods:
```javascript
period: "daily"
groupBy: ["Doctor Info", "Date de Service"]
```

---

## Error Messages (French)

### Primary Error Message:
```
"Limite quotidienne d'interventions cliniques dépassée : {totalMinutes} minutes facturées le {date} (maximum : 180 minutes par jour)."
```

### Solution Message:
```
"Veuillez vérifier si les éléments de contexte ICEP, ICSM ou ICTOX sont manquants. Autrement, réduire le nombre d'interventions cliniques ou annuler {excessMinutes} minutes d'interventions pour respecter la limite de 180 minutes par jour."
```

---

## Test Scenarios

### Pass Scenario 1: Within Daily Limit
```
Description: Médecin avec 150 minutes d'interventions régulières
Test Data:
- Doctor: "1068303-00000 | Krait, Aurélie"
- Date: 2025-01-07
- Intervention 1: Code 8857 (30 min) - sans contexte spécial
- Intervention 2: Code 8857 (30 min) - sans contexte spécial
- Intervention 3: Code 8857 (30 min) - sans contexte spécial
- Intervention 4: Code 8857 (30 min) - sans contexte spécial
- Intervention 5: Code 8857 (30 min) - sans contexte spécial
Total: 150 minutes
Expected: No error
```

### Pass Scenario 2: Excluded Contexts Don't Count
```
Description: Médecin avec 200 minutes mais contextes ICEP exclus
Test Data:
- Doctor: "1068303-00000 | Krait, Aurélie"
- Date: 2025-01-07
- Intervention 1: Code 8857 (30 min) + Code 8859 (30 min) - contexte ICEP = 60 min (EXCLU)
- Intervention 2: Code 8857 (30 min) - sans contexte = 30 min (COMPTÉ)
- Intervention 3: Code 8857 (30 min) + Code 8859 (60 min) - sans contexte = 90 min (COMPTÉ)
Total compté: 120 minutes (60 min ICEP exclus)
Expected: No error
```

### Pass Scenario 3: At Exactly 180 Minutes
```
Description: Médecin exactement à la limite
Test Data:
- Doctor: "1068303-00000 | Krait, Aurélie"
- Date: 2025-01-07
- 6 interventions de 30 minutes chacune = 180 min
Expected: No error
```

### Fail Scenario 1: Exceeds Daily Limit
```
Description: Médecin dépasse 180 minutes avec interventions régulières
Test Data:
- Doctor: "1068303-00000 | Krait, Aurélie"
- Date: 2025-01-07
- Intervention 1: Code 8857 (30 min) - patient 1
- Intervention 2: Code 8857 (30 min) - patient 2
- Intervention 3: Code 8857 (30 min) - patient 3
- Intervention 4: Code 8857 (30 min) - patient 4
- Intervention 5: Code 8857 (30 min) - patient 5
- Intervention 6: Code 8857 (30 min) - patient 6
- Intervention 7: Code 8857 (30 min) - patient 7
Total: 210 minutes
Expected: Error - "Limite quotidienne dépassée : 210 minutes (maximum : 180)"
Solution: "Veuillez annuler 30 minutes d'interventions"
```

### Fail Scenario 2: Multiple Periods Exceed Limit
```
Description: Interventions avec périodes supplémentaires dépassent limite
Test Data:
- Doctor: "1068303-00000 | Krait, Aurélie"
- Date: 2025-02-06
- Intervention 1: Code 8857 (30 min) + Code 8859 (60 unités) = 90 min
- Intervention 2: Code 8857 (30 min) + Code 8859 (30 unités) = 60 min
- Intervention 3: Code 8857 (30 min) + Code 8859 (15 unités) = 45 min
Total: 195 minutes
Expected: Error - "Limite quotidienne dépassée : 195 minutes"
Solution: "Veuillez annuler 15 minutes d'interventions"
```

### Edge Case Scenarios:
```
1. Contexte mixte "CLSC,ICEP"
   Expected: Intervention EXCLUE du calcul (contient ICEP)

2. Contexte vide ou NULL
   Expected: Intervention COMPTÉE dans le total

3. Multiple médecins même jour
   Expected: Calcul séparé par médecin

4. Code 8859 avec Unités = 0 ou NULL
   Expected: Traiter comme 0 minutes

5. Interventions sur 2 jours consécutifs
   Expected: Calcul séparé par jour (pas de cumul)

6. Exactement 180 minutes
   Expected: No error (limite inclusive)
```

---

## Implementation Approach

**Implementation Type**: Custom Rule File (not database-driven)

This rule requires a custom implementation similar to `officeFeeRule.ts` because:
1. Complex duration calculation logic (two different codes with different calculations)
2. Special context exclusion filtering (comma-separated exact matching)
3. Multi-record grouping and aggregation
4. Business-critical with potential for custom adjustments

**File Location**: `server/modules/validateur/validation/rules/interventionCliniqueRule.ts`

**Registration**: Manual registration in validation engine (not via database rules table)

**Pattern**: Follow the `ValidationRule` interface from `engine.ts`:
```typescript
export const interventionCliniqueRule: ValidationRule = {
  id: "INTERVENTION_CLINIQUE_DAILY_LIMIT",
  name: "Limite quotidienne interventions cliniques (180 min)",
  category: "intervention_clinique",
  enabled: true,
  async validate(records: BillingRecord[], validationRunId: string): Promise<InsertValidationResult[]> {
    // Implementation here
  }
};
```

---

## Additional Requirements

### Special Validation Logic:
```javascript
// Calcul de la durée totale par intervention
function calculateDuration(code, unites) {
  if (code === "8857") {
    return 30;  // Première période fixe
  }
  if (code === "8859") {
    return parseInt(unites) || 0;  // Périodes supplémentaires
  }
  return 0;
}

// Vérification des contextes exclus (EXACT MATCH après split)
// IMPORTANT: Utiliser split + exact match pour éviter les faux positifs
// Exemple: "EPICENE" contient "ICEP" mais n'est PAS un contexte exclu
function isExcludedContext(elementContexte) {
  if (!elementContexte) return false;

  const excludedContexts = ["ICEP", "ICSM", "ICTOX"];

  // Séparer les contextes multiples (ex: "CLSC,ICEP" -> ["CLSC", "ICEP"])
  const codes = elementContexte.toUpperCase().split(',').map(c => c.trim());

  // Vérifier si UN des contextes correspond exactement
  return codes.some(code => excludedContexts.includes(code));
}

// Groupement et calcul
// 0. SKIP records avec doctorInfo NULL ou dateService NULL (pas assez d'info pour grouper)
// 1. Filtrer codes 8857 et 8859
// 2. Exclure les lignes avec contexte ICEP/ICSM/ICTOX
// 3. Grouper par (Doctor Info + Date de Service)
//    - Format clé: `${doctorInfo}_${dateService.toISOString().split('T')[0]}`
//    - Exemple: "1068303-00000 | Krait_2025-01-07"
// 4. Calculer total minutes pour chaque groupe
// 5. Générer erreur si total > 180 (STRICTEMENT supérieur, 180 = OK)
```

### Dependencies on Other Tables:
```
Aucune dépendance sur d'autres tables.
Toutes les données nécessaires sont dans la table billing_records :

CSV Header            → TypeScript Property → PostgreSQL Column
- Doctor Info         → doctorInfo          → doctor_info
- Date de Service     → dateService         → date_service
- Code                → code                → code
- Unités              → unites              → unites
- Élément de contexte → elementContexte     → element_contexte
```

### Performance Considerations:
```
Pour un fichier de 10,000 lignes :
- Filtrage rapide sur codes 8857/8859 (~5-10% des lignes)
- Exclusion contextes (~30% des interventions cliniques)
- Groupement par ~50 médecins × ~20 jours = 1000 groupes
- Calcul O(n) très rapide

Performance : < 50ms pour 10K lignes
Aucune optimisation spéciale requise.
```

---

## Examples from Real Data

### Example CSV Input (Scénario valide):
```csv
#,Facture,ID RAMQ,Date de Service,Début,Fin,Code,Unités,Élément de contexte,Doctor Info,Patient
33,123777388,15417623657,2025-01-07,10:00,10:30,8857,0,ICEP,1068303-00000 | Krait Aurélie,LEPF65102328
35,123777388,15417623657,2025-01-07,10:30,11:00,8859,30,ICEP,1068303-00000 | Krait Aurélie,LEPF65102328
79,124427970,15447499714,2025-01-07,14:45,15:15,8857,0,,1068303-00000 | Krait Aurélie,SYND59510815
80,124427971,15447498484,2025-01-07,15:30,16:00,8857,0,,1068303-00000 | Krait Aurélie,DESN82092711
```

### Expected Validation Output:
```json
{
  "valid": true,
  "message": "Calcul pour 2025-01-07:",
  "details": {
    "interventionsICEP": 60,  // Exclus du calcul
    "interventionsRégulières": 60,  // 30 + 30
    "totalCompté": 60,
    "limite": 180,
    "status": "OK"
  }
}
```

### Example CSV Input (Scénario invalide - dépasse limite):
```csv
#,Facture,Date de Service,Code,Unités,Élément de contexte,Doctor Info,Patient
1,F1,2025-02-06,8857,0,,1068303-00000 | Krait,P1
2,F2,2025-02-06,8859,60,,1068303-00000 | Krait,P1
3,F3,2025-02-06,8857,0,,1068303-00000 | Krait,P2
4,F4,2025-02-06,8859,30,,1068303-00000 | Krait,P2
5,F5,2025-02-06,8857,0,,1068303-00000 | Krait,P3
6,F6,2025-02-06,8859,15,,1068303-00000 | Krait,P3
```

### Expected Validation Output:
```json
{
  "billingRecordId": "uuid-of-record-F1",  // First record chronologically
  "idRamq": "15447499714",  // RAMQ ID from first record
  "severity": "error",
  "category": "intervention_clinique",
  "message": "Limite quotidienne d'interventions cliniques dépassée : 195 minutes facturées le 2025-02-06 (maximum : 180 minutes par jour).",
  "solution": "Veuillez vérifier si les éléments de contexte ICEP, ICSM ou ICTOX sont manquants. Autrement, réduire le nombre d'interventions cliniques ou annuler 15 minutes d'interventions pour respecter la limite de 180 minutes par jour.",
  "affectedRecords": ["F1", "F2", "F3", "F4", "F5", "F6"],  // All contributing records
  "ruleData": {
    "doctor": "1068303-00000 | Krait, Aurélie",
    "date": "2025-02-06",
    "totalMinutes": 195,
    "limit": 180,
    "excessMinutes": 15,
    "code8857Minutes": 90,   // Total from all 8857 records (30+30+30)
    "code8859Minutes": 105,  // Total from all 8859 records (60+30+15)
    "recordCount": 6
  }
}

// Note: billingRecordId is set to the FIRST record chronologically (by dateService + debut)
// affectedRecords contains ALL record IDs that contributed to the violation
```

---

## Implementation Priority

**Priority**: `High`

**Estimated Complexity**: `Medium`
- Filtrage simple sur codes 8857/8859
- Exclusion de contextes par recherche de substring
- Calcul de durée avec logique conditionnelle
- Groupement par médecin + date

**Business Impact**:
```
Élevé - Conformité légale avec l'article 2.2.6 B de l'entente RAMQ.

Le non-respect de cette limite peut entraîner :
- Rejet des factures par la RAMQ
- Demande de remboursement des sommes excédentaires
- Audit des pratiques de facturation

Impact financier estimé : ~$2,000-5,000/mois en factures rejetées
si non détecté avant soumission.

Temps économisé : 3-4 heures/semaine de révision manuelle des limites quotidiennes.
```

---

## Notes & Clarifications

```
IMPORTANT : Contextes exclus

Les interventions cliniques avec contextes ICEP, ICSM ou ICTOX bénéficient
d'une tarification modulée et ne sont PAS soumises à la limite de 180 minutes
car elles nécessitent plus de temps pour des populations vulnérables.

Définitions :
- ICEP = Intervention Clinique Équivalente Protégée (clientèle vulnérable)
- ICSM = Intervention Clinique Santé Mentale
- ICTOX = Intervention Clinique Toxicomanie

Ces contextes peuvent apparaître seuls ou combinés avec d'autres contextes
(ex: "CLSC,ICEP"). La règle doit vérifier la PRÉSENCE de ces codes dans
le champ "Élément de contexte", pas l'égalité exacte.

Article de référence : Entente RAMQ 2.2.6 B
"Le médecin ne peut facturer plus de cent-quatre-vingt (180) minutes
d'interventions cliniques dans une journée."
```

---

## Approval & Sign-off

**Requested By**: Équipe de facturation
**Date Requested**: 2025-01-10
**Approved By**: Direction médicale
**Implementation Deadline**: 2025-01-20
**Implementation Date**: 2025-01-11
**Status**: ✅ Implémentée

---

## Implementation Details

**Implementation File**: `server/modules/validateur/validation/rules/interventionCliniqueRule.ts`
**Test File**: `server/modules/validateur/validation/rules/__tests__/interventionCliniqueRule.test.ts`
**Test Coverage**: 36 tests covering all scenarios and edge cases
**Registration**: Automatically loaded in `csvProcessor.ts` as fallback rule
