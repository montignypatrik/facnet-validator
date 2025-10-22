# RAMQ Validation Rule: Limite quotidienne interventions cliniques

Règle de validation pour les interventions cliniques individuelles selon l'article 2.2.6 B de l'entente RAMQ.

---

## Rule Information

**Rule Name (French)**: `Limite quotidienne interventions cliniques (180 min)`

**Rule ID**: `INTERVENTION_CLINIQUE_DAILY_LIMIT`

**Rule Type**: `daily_time_limit` (custom type)

**Severity**: Mixed (info, error depending on scenario)

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

See **Validation Scenarios & Expected Results** section below for detailed scenario conditions.

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

## Validation Scenarios & Expected Results

> **Purpose:** This section defines ALL possible outcomes of the intervention clinique validation rule.
> Each scenario specifies the exact message users will see and how results should be displayed.
>
> **Naming Convention:**
> - P1, P2, P3... = PASS scenarios (severity: info)
> - E1, E2, E3... = ERROR scenarios (severity: error)
> - O1, O2, O3... = OPTIMIZATION scenarios (severity: optimization)

### ✅ PASS Scenarios (Severity: info)

These scenarios represent successful validation. Results should be **collapsed by default**
but expandable to show validation details.

---

#### Scenario P1: Within Daily Limit

**Condition:** Médecin facture ≤180 minutes d'interventions cliniques dans une journée (sans contextes ICEP/ICSM/ICTOX)

**Message (French):**
```
"Validation réussie: {totalMinutes} minutes d'interventions cliniques facturées pour {doctor} le {date} (limite: 180 minutes/jour)"
```

**Solution (French):** `null`

**Monetary Impact:** `0`

**Display Configuration:**
- **Collapsed by default:** Yes
- **Show when expanded:**
  - [X] Temporal information box
  - [ ] Billing details box
  - [ ] Visit statistics grid
  - [ ] Comparison box
- **Custom data fields to display:** `totalMinutes, daily_limit, code8857Minutes, code8859Minutes, recordCount, doctor, date`

**Test Case Reference:** `test-P1`

**Example ruleData:**
```json
{
  "monetaryImpact": 0,
  "totalMinutes": 150,
  "daily_limit": 180,
  "code8857Minutes": 150,
  "code8859Minutes": 0,
  "recordCount": 5,
  "doctor": "Dr. K***",
  "date": "2025-01-07"
}
```

---

#### Scenario P2: Excluded Contexts Don't Count

**Condition:** Total minutes >180 mais contextes ICEP/ICSM/ICTOX exclus du calcul ramènent le total ≤180

**Message (French):**
```
"Validation réussie: {totalMinutes} minutes comptées pour {doctor} le {date} ({excludedMinutes} minutes avec contexte spécial exclues). Limite: 180 minutes/jour"
```

**Solution (French):** `null`

**Monetary Impact:** `0`

**Display Configuration:**
- **Collapsed by default:** Yes
- **Show when expanded:**
  - [X] Temporal information box
  - [ ] Billing details box
  - [ ] Visit statistics grid
  - [ ] Comparison box
- **Custom data fields to display:** `totalMinutes, excludedMinutes, daily_limit, doctor, date`

**Test Case Reference:** `test-P2`

**Example ruleData:**
```json
{
  "monetaryImpact": 0,
  "totalMinutes": 120,
  "excludedMinutes": 60,
  "daily_limit": 180,
  "excludedContexts": "ICEP",
  "doctor": "Dr. K***",
  "date": "2025-01-07"
}
```

---

#### Scenario P3: Exactly at 180 Minutes

**Condition:** Médecin facture exactement 180 minutes (limite inclusive)

**Message (French):**
```
"Validation réussie: Exactement 180 minutes facturées pour {doctor} le {date} (maximum permis atteint)"
```

**Solution (French):** `null`

**Monetary Impact:** `0`

**Display Configuration:**
- **Collapsed by default:** Yes
- **Show when expanded:**
  - [X] Temporal information box
- **Custom data fields to display:** `totalMinutes, daily_limit, doctor, date`

**Test Case Reference:** `test-P3`

**Example ruleData:**
```json
{
  "monetaryImpact": 0,
  "totalMinutes": 180,
  "daily_limit": 180,
  "recordCount": 6,
  "doctor": "Dr. K***",
  "date": "2025-01-07"
}
```

---

### ❌ FAIL Scenarios - Errors (Severity: error)

These scenarios represent regulation violations that **must be fixed**.
Results should be **always visible, expanded by default**.

---

#### Scenario E1: Exceeds Daily Limit (Basic)

**Condition:** Total minutes >180 avec interventions régulières (codes 8857/8859 sans contextes spéciaux)

**Message (French):**
```
"Limite quotidienne d'interventions cliniques dépassée: {totalMinutes} minutes facturées pour {doctor} le {date} (maximum: 180 minutes/jour)"
```

**Solution (French):**
```
"Veuillez vérifier si les éléments de contexte ICEP, ICSM ou ICTOX sont manquants. Autrement, réduire le nombre d'interventions cliniques ou annuler {excessMinutes} minutes d'interventions pour respecter la limite de 180 minutes par jour"
```

**Monetary Impact:**
- `0` if all billings unpaid
- `-{unpaidAmount}` if some billings already paid (revenue at risk)

**Display Configuration:**
- **Collapsed by default:** No (always expanded)
- **Always show:**
  - [X] Error message
  - [X] Solution box (highlighted)
- **Show in details:**
  - [X] Temporal information box
  - [X] Billing details box
  - [ ] Visit statistics grid
  - [ ] Comparison box
- **Custom data fields to display:** `totalMinutes, daily_limit, excessMinutes, code8857Minutes, code8859Minutes, recordCount, doctor, date`

**Test Case Reference:** `test-E1`

**Example ruleData:**
```json
{
  "monetaryImpact": 0,
  "totalMinutes": 210,
  "daily_limit": 180,
  "excessMinutes": 30,
  "code8857Minutes": 210,
  "code8859Minutes": 0,
  "recordCount": 7,
  "doctor": "Dr. K***",
  "date": "2025-01-07"
}
```

---

#### Scenario E2: Multiple Periods Exceed Limit

**Condition:** Total minutes >180 avec combinaison de codes 8857 et 8859 (périodes supplémentaires)

**Message (French):**
```
"Limite quotidienne d'interventions cliniques dépassée: {totalMinutes} minutes facturées pour {doctor} le {date} (8857: {code8857Minutes} min, 8859: {code8859Minutes} min). Maximum: 180 minutes/jour"
```

**Solution (French):**
```
"Veuillez vérifier si les éléments de contexte ICEP, ICSM ou ICTOX sont manquants. Autrement, réduire le nombre d'interventions cliniques ou annuler {excessMinutes} minutes d'interventions pour respecter la limite de 180 minutes par jour"
```

**Monetary Impact:** `0` or `-{unpaidAmount}`

**Display Configuration:**
- **Collapsed by default:** No (always expanded)
- **Always show:**
  - [X] Error message
  - [X] Solution box (highlighted)
- **Show in details:**
  - [X] Temporal information box
  - [X] Billing details box
- **Custom data fields to display:** `totalMinutes, daily_limit, excessMinutes, code8857Minutes, code8859Minutes, recordCount, doctor, date`

**Test Case Reference:** `test-E2`

**Example ruleData:**
```json
{
  "monetaryImpact": 0,
  "totalMinutes": 195,
  "daily_limit": 180,
  "excessMinutes": 15,
  "code8857Minutes": 90,
  "code8859Minutes": 105,
  "recordCount": 6,
  "doctor": "Dr. K***",
  "date": "2025-02-06"
}
```

---

### 🧪 Edge Cases

**Edge Case 1: Contexte mixte "CLSC,ICEP"**
- Expected: Intervention EXCLUE du calcul (contient ICEP)

**Edge Case 2: Contexte vide ou NULL**
- Expected: Intervention COMPTÉE dans le total

**Edge Case 3: Multiple médecins même jour**
- Expected: Calcul séparé par médecin

**Edge Case 4: Code 8859 avec Unités = 0 ou NULL**
- Expected: Traiter comme 0 minutes

**Edge Case 5: Interventions sur 2 jours consécutifs**
- Expected: Calcul séparé par jour (pas de cumul)

**Edge Case 6: Exactement 180 minutes**
- Expected: No error (limite inclusive - scenario P3)

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
