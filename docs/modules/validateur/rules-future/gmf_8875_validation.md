# RAMQ Validation Rule: Forfait de prise en charge GMF (8875)

Règle de validation pour le forfait de prise en charge et de suivi GMF selon l'entente RAMQ.

---

## Rule Information

**Rule Name (French)**: `Forfait de prise en charge GMF (8875)`

**Rule ID**: `GMF_FORFAIT_8875`

**Rule Type**: `gmf_annual_forfait` (custom type)

**Severity**: Mixed (info, error, optimization depending on scenario)

**Category**: `gmf_forfait`

---

## Rule Logic Description

### What This Rule Validates:
```
Cette règle valide deux aspects du forfait de prise en charge GMF (code 8875) :

1. LIMITE ANNUELLE (Error) :
   Le code 8875 ne peut être facturé qu'UNE SEULE FOIS par patient par année civile
   (1er janvier au 31 décembre), conformément à l'entente RAMQ.

2. OPPORTUNITÉ MANQUÉE (Optimization) :
   Détecte les patients inscrits GMF qui ont des visites dans l'année
   mais n'ont pas le forfait 8875 facturé, représentant une perte de revenu.

Patient inscrit = Patient ayant une visite dans un établissement GMF
(établissement où ep_33 = true dans la base de données)

Exceptions : Visites avec contexte MTA13, GMFU, GAP, G160 ou AR sont ignorées
pour le calcul des opportunités.
```

### When Should This Trigger?

See **Validation Scenarios & Expected Results** section below for detailed scenario conditions.

---

## Target Data

### Target Billing Codes:
```javascript
primaryCode: "8875"  // Forfait de prise en charge GMF (duplicate detection)

// Additional codes for visit qualification (opportunity detection)
additionalVisitCodes: ["8857", "8859"]
```

### Excluded Context Elements (pour opportunités):
```javascript
excludedContexts: ["MTA13", "GMFU", "GAP", "G160", "AR"]

// Ces contextes indiquent des situations où le forfait 8875
// ne devrait pas être facturé

// How context exclusion works:
// 1. Read the "element_contexte" column from the CSV input row
// 2. Split by comma (contexts are comma-separated) and trim whitespace
// 3. Check if ANY of the excluded values match EXACTLY
// 4. Context matching is case-insensitive
// 5. Uses exact match after splitting (prevents false positives like "AR" matching "STAR")

// Examples:
// element_contexte = "MTA13"      → Split: ["MTA13"] → EXCLUDED (exact match)
// element_contexte = "MTA13,85"   → Split: ["MTA13", "85"] → EXCLUDED (MTA13 matches)
// element_contexte = "GMFU"       → Split: ["GMFU"] → EXCLUDED (exact match)
// element_contexte = "GAP"        → Split: ["GAP"] → EXCLUDED (exact match)
// element_contexte = "G160"       → Split: ["G160"] → EXCLUDED (exact match)
// element_contexte = "AR"         → Split: ["AR"] → EXCLUDED (exact match)
// element_contexte = "85,G160"    → Split: ["85", "G160"] → EXCLUDED (G160 matches)
// element_contexte = "85, AR"     → Split: ["85", "AR"] → EXCLUDED (AR matches, whitespace trimmed)
// element_contexte = "STAR"       → Split: ["STAR"] → NOT EXCLUDED (no exact match)
// element_contexte = "CARDIAC"    → Split: ["CARDIAC"] → NOT EXCLUDED (no exact match)
// element_contexte = "85"         → Split: ["85"] → NOT EXCLUDED
// element_contexte = ""           → NOT EXCLUDED (empty)
// element_contexte = null         → NOT EXCLUDED (null)
```

### Visit Identification Logic (pour opportunités):
```javascript
// How to identify qualifying visits for 8875 opportunity detection:
// A billing row qualifies as a "visit" if ANY of the following conditions are met:

// OPTION 1: Code matches specific visit codes
const specificVisitCodes = ["8857", "8859"];
if (specificVisitCodes.includes(billingCode)) {
  // This is a qualifying visit
}

// OPTION 2: Code belongs to visit level1_group
// Query the codes table to check the level1_group column
const visitLevel1Groups = [
  "Visites sur rendez-vous (patient de 80 ans ou plus)",
  "Visites sur rendez-vous (patient de moins de 80 ans)"
];

// Database Query:
SELECT code, level1_group FROM codes WHERE code = ?

// Logic:
if (visitLevel1Groups.includes(codeData.level1_group)) {
  // This is a qualifying visit
}

// Combined Logic:
function isQualifyingVisit(billingCode, codeData) {
  // Check specific codes first
  if (["8857", "8859"].includes(billingCode)) {
    return true;
  }

  // Check level1_group from codes table
  const visitGroups = [
    "Visites sur rendez-vous (patient de 80 ans ou plus)",
    "Visites sur rendez-vous (patient de moins de 80 ans)"
  ];

  return visitGroups.includes(codeData.level1_group);
}

// Performance Note:
// Load codes table data at startup and cache in memory to avoid
// repeated database queries during validation
```

### Establishment Requirements:
```javascript
// GMF Establishment Identification Logic:
// 1. Get establishment number from CSV row (lieuPratique field)
// 2. Query DB: SELECT numero, ep_33 FROM establishments WHERE numero = ?
// 3. Check ep_33 column value:
//    - ep_33 = true  → GMF establishment
//    - ep_33 = false → NOT a GMF establishment
//    - ep_33 = NULL  → Treat as NOT a GMF (default false)

// Database Query:
SELECT numero, ep_33 FROM establishments WHERE numero = ?

// Logic:
// ep_33 === true  → Establishment is GMF
// ep_33 === false → Establishment is NOT GMF
// ep_33 === null  → Treat as NOT GMF (default behavior)
```

---

## Thresholds & Limits

### Annual Limit:
```javascript
annualMaximum: 1  // Une seule fois par patient par année civile
```

### Time Period:
```javascript
period: "annually"
periodStart: "January 1"
periodEnd: "December 31"
```

### Forfait Amount:
```javascript
forfaitAmount: 9.35  // Dollars (tarif au 1er octobre 2019)
```

---

## Validation Scenarios & Expected Results

> **Purpose:** This section defines ALL possible outcomes of the GMF forfait 8875 validation rule.
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

#### Scenario P1: Single 8875 Per Year

**Condition:** Patient avec un seul code 8875 facturé dans l'année civile

**Message (French):**
```
"Validation réussie: Forfait GMF (8875) facturé correctement pour patient {patient} en {year}"
```

**Solution (French):** `null`

**Monetary Impact:** `0`

**Display Configuration:**
- **Collapsed by default:** Yes
- **Show when expanded:**
  - [ ] Billing details box
  - [ ] Visit statistics grid
  - [ ] Temporal information box
  - [ ] Comparison box
- **Custom data fields to display:** `patient, year, code`

**Test Case Reference:** `test-P1`

**Example ruleData:**
```json
{
  "monetaryImpact": 0,
  "patient": "ABCD12345678",
  "year": 2025,
  "code": "8875",
  "totalCount": 1,
  "paidCount": 1
}
```

---

#### Scenario P2: Different Years

**Condition:** Patient avec code 8875 facturé dans deux années civiles différentes

**Message (French):**
```
"Validation réussie: Forfait GMF (8875) facturé dans des années différentes ({years}). Limite annuelle respectée"
```

**Solution (French):** `null`

**Monetary Impact:** `0`

**Display Configuration:**
- **Collapsed by default:** Yes
- **Show when expanded:**
  - [ ] Temporal information box
- **Custom data fields to display:** `patient, years`

**Test Case Reference:** `test-P2`

**Example ruleData:**
```json
{
  "monetaryImpact": 0,
  "patient": "ABCD12345678",
  "years": "2024, 2025",
  "code": "8875"
}
```

---

#### Scenario P3: Patient with 8875 and Visits

**Condition:** Patient inscrit GMF avec visites ET forfait 8875 déjà facturé

**Message (French):**
```
"Validation réussie: Patient avec {visitCount} visite(s) GMF et forfait 8875 facturé en {year}"
```

**Solution (French):** `null`

**Monetary Impact:** `0`

**Display Configuration:**
- **Collapsed by default:** Yes
- **Show when expanded:**
  - [X] Visit statistics grid
- **Custom data fields to display:** `patient, year, visitCount`

**Test Case Reference:** `test-P3`

**Example ruleData:**
```json
{
  "monetaryImpact": 0,
  "patient": "ABCD12345678",
  "year": 2025,
  "visitCount": 3,
  "hasForfait": true
}
```

---

### ❌ FAIL Scenarios - Errors (Severity: error)

These scenarios represent regulation violations that **must be fixed**.
Results should be **always visible, expanded by default**.

---

#### Scenario E1: Duplicate in Same Year (Both Paid)

**Condition:** Code 8875 facturé plus d'une fois dans même année civile, avec au moins une facturation payée

**Message (French):**
```
"Le code 8875 (forfait GMF) ne peut être facturé qu'une seule fois par année civile par patient. Déjà facturé {totalCount} fois et payé {paidCount} fois en {year}"
```

**Solution (French):**
```
"Veuillez annuler cette facturation. Le forfait 8875 a déjà été payé pour ce patient le {firstPaidDate}"
```

**Monetary Impact:**
- `0` if duplicate billing unpaid
- `-9.35` if duplicate billing already paid (revenue at risk)

**Display Configuration:**
- **Collapsed by default:** No (always expanded)
- **Always show:**
  - [X] Error message
  - [X] Solution box (highlighted)
- **Show in details:**
  - [X] Billing details box
  - [X] Temporal information box
  - [ ] Visit statistics grid
  - [ ] Comparison box
- **Custom data fields to display:** `patient, year, totalCount, paidCount, firstPaidDate, affectedInvoices`

**Test Case Reference:** `test-E1`

**Example ruleData:**
```json
{
  "monetaryImpact": 0,
  "patient": "ABCD12345678",
  "year": 2025,
  "totalCount": 2,
  "paidCount": 2,
  "firstPaidDate": "2025-01-15",
  "affectedInvoices": ["F001", "F002"]
}
```

---

#### Scenario E2: Duplicate - One Paid, One Unpaid

**Condition:** Code 8875 facturé 2+ fois, avec une facturation payée et d'autres non payées

**Message (French):**
```
"Le code 8875 (forfait GMF) ne peut être facturé qu'une seule fois par année civile par patient. Déjà facturé {totalCount} fois et payé {paidCount} fois en {year}"
```

**Solution (French):**
```
"Veuillez annuler cette facturation. Le forfait 8875 a déjà été payé pour ce patient le {firstPaidDate}"
```

**Monetary Impact:** `0` (unpaid duplicate)

**Display Configuration:**
- **Collapsed by default:** No (always expanded)
- **Always show:**
  - [X] Error message
  - [X] Solution box (highlighted)
- **Show in details:**
  - [X] Billing details box
  - [X] Temporal information box
- **Custom data fields to display:** `patient, year, totalCount, paidCount, unpaidCount, firstPaidDate`

**Test Case Reference:** `test-E2`

**Example ruleData:**
```json
{
  "monetaryImpact": 0,
  "patient": "EFGH98765432",
  "year": 2025,
  "totalCount": 2,
  "paidCount": 1,
  "unpaidCount": 1,
  "firstPaidDate": "2025-02-10"
}
```

---

### 💡 FAIL Scenarios - Optimizations (Severity: optimization)

These scenarios represent **missed revenue opportunities**.
Results should be **always visible, highlighted with gain amount**.

---

#### Scenario O1: Patient Without 8875

**Condition:** Patient inscrit GMF avec visites qualifiantes mais sans forfait 8875 facturé dans l'année

**Message (French):**
```
"Patient inscrit GMF avec {visitCount} visite(s) en {year} mais sans forfait 8875 facturé. Perte de revenu: 9,35$"
```

**Solution (French):**
```
"Veuillez facturer le code 8875 (9,35$) lors de la première visite de l'année. Date de première visite GMF: {firstVisitDate}"
```

**Monetary Impact:** `9.35` (REQUIRED - must be positive)

**Display Configuration:**
- **Collapsed by default:** No (always expanded)
- **Always show:**
  - [X] Optimization message
  - [X] Solution box (highlighted in amber)
  - [X] Monetary gain badge (prominent)
- **Show in details:**
  - [X] Visit statistics grid
  - [X] Temporal information box
  - [ ] Billing details box
  - [ ] Comparison box
- **Custom data fields to display:** `patient, year, visitCount, firstVisitDate, potentialRevenue, gmfEstablishments`

**Test Case Reference:** `test-O1`

**Example ruleData:**
```json
{
  "monetaryImpact": 9.35,
  "patient": "IJKL11223344",
  "year": 2025,
  "visitCount": 3,
  "firstVisitDate": "2025-01-15",
  "potentialRevenue": 9.35,
  "gmfEstablishments": ["55369"]
}
```

---

### 🧪 Edge Cases

**Edge Case 1: Patient avec 3 facturations 8875 même année (toutes payées)**
- Expected: Multiple errors (each duplicate flagged)

**Edge Case 2: Patient avec visites GMF et NON-GMF, pas de 8875**
- Expected: Optimization (au moins une visite GMF)

**Edge Case 3: Patient avec visite GMF avec contexte "MTA13,85" (mixte)**
- Expected: Pas d'optimization (contient MTA13)

**Edge Case 4: Patient avec visite GMF avec contexte "G160" ou "AR"**
- Expected: Pas d'optimization (contextes exclus)

**Edge Case 5: Montant payé = NULL ou 0**
- Expected: Traité comme non payé

**Edge Case 6: Patient avec visite 31 décembre 2025 et 8875 le 1er janvier 2026**
- Expected: Optimization pour 2025 (8875 dans année différente)

**Edge Case 7: Établissement avec ep_33 = NULL dans DB**
- Expected: Traiter comme NON-GMF (ep_33 = false)

**Edge Case 8: Patient avec code 8857 dans établissement GMF, pas de 8875**
- Expected: Optimization (8857 est un code de visite qualifiant)

**Edge Case 9: Patient avec code 8859 dans établissement GMF, pas de 8875**
- Expected: Optimization (8859 est un code de visite qualifiant)


---

## Additional Requirements

### Special Validation Logic:

**Scenario 1 - Duplicate Detection:**
```javascript
// 1. Filtrer toutes les lignes avec code 8875
// 2. Grouper par (Patient + Année civile)
// 3. Pour chaque groupe, compter :
//    - totalCount = nombre total de facturations
//    - paidCount = nombre avec montantPaye > 0
// 4. Si totalCount > 1 ET paidCount > 0 → Error

function detectDuplicate8875(records) {
  const grouped = groupBy(records.filter(r => r.code === "8875"), 
                          r => `${r.patient}-${getYear(r.dateService)}`);
  
  for (const [key, billings] of grouped) {
    const totalCount = billings.length;
    const paidCount = billings.filter(b => b.montantPaye > 0).length;
    
    if (totalCount > 1 && paidCount > 0) {
      const firstPaid = billings.find(b => b.montantPaye > 0);
      const year = getYear(firstPaid.dateService);

      return {
        severity: "error",
        message: `Le code 8875 (forfait GMF) ne peut être facturé qu'une seule fois par année civile par patient. Déjà facturé ${totalCount} fois et payé ${paidCount} fois en ${year}.`,
        solution: `Veuillez annuler cette facturation. Le forfait 8875 a déjà été payé pour ce patient le ${firstPaid.dateService}.`,
        ruleData: {
          totalCount,
          paidCount,
          year,
          firstPaidDate: firstPaid.dateService
        }
      };
    }
  }
}
```

**Scenario 2 - Opportunité Detection:**
```javascript
// 1. Identifier tous les patients avec visites GMF dans l'année
// 2. Pour chaque patient, vérifier si code 8875 facturé dans l'année
// 3. Exclure visites avec contexte MTA13, GMFU, GAP, G160 ou AR
// 4. Si visites GMF valides ET pas de 8875 → Optimization

async function detectMissing8875(records, establishments, codes) {
  // Load GMF establishments from DB (ep_33 = true)
  const gmfEstablishments = establishments.filter(e => e.ep_33 === true);

  // Filter visits in GMF establishments
  // Match lieuPratique (CSV) with numero (DB)
  const gmfVisits = records.filter(r =>
    isQualifyingVisit(r.code, codes) &&
    gmfEstablishments.some(e => e.numero === r.lieuPratique) &&
    !hasExcludedContext(r.elementContexte)
  );
  
  // Grouper par patient + année
  const patientYears = groupBy(gmfVisits, r => `${r.patient}-${getYear(r.dateService)}`);
  
  // Vérifier présence 8875 pour chaque patient-année
  const code8875s = records.filter(r => r.code === "8875");
  
  for (const [key, visits] of patientYears) {
    const [patient, year] = key.split("-");
    const has8875 = code8875s.some(c => 
      c.patient === patient && 
      getYear(c.dateService) === year
    );
    
    if (!has8875) {
      const firstVisit = visits.sort((a, b) => 
        new Date(a.dateService) - new Date(b.dateService)
      )[0];
      
      return {
        severity: "optimization",
        message: `Patient inscrit GMF avec ${visits.length} visite(s) en ${year} mais sans forfait 8875 facturé. Perte de revenu : 9,35$.`,
        solution: `Veuillez facturer le code 8875 (9,35$) lors de la première visite de l'année. Date de première visite GMF : ${firstVisit.dateService}.`
      };
    }
  }
}

function isQualifyingVisit(billingCode, codesMap) {
  // Check specific visit codes first
  const specificVisitCodes = ["8857", "8859"];
  if (specificVisitCodes.includes(billingCode)) {
    return true;
  }

  // Check level1_group from codes table
  const codeData = codesMap.get(billingCode);
  if (!codeData) return false;

  const visitLevel1Groups = [
    "Visites sur rendez-vous (patient de 80 ans ou plus)",
    "Visites sur rendez-vous (patient de moins de 80 ans)"
  ];

  return visitLevel1Groups.includes(codeData.level1_group);
}

function hasExcludedContext(elementContexte) {
  if (!elementContexte) return false;

  const excludedContexts = ["MTA13", "GMFU", "GAP", "G160", "AR"];

  // Split by comma and trim whitespace to get individual context codes
  const codes = elementContexte.toUpperCase().split(',').map(c => c.trim());

  // Check if ANY excluded context matches exactly (not substring)
  // This prevents false positives like "AR" matching "STAR" or "CARDIAC"
  return codes.some(code => excludedContexts.includes(code));
}
```

### Dependencies on Other Tables:
```
- codes table: Pour identifier les visites qualifiantes via level1_group
  SELECT code, level1_group FROM codes WHERE code = ?

  Visit qualification criteria:
  1. Specific codes: 8857, 8859
  2. level1_group values:
     - "Visites sur rendez-vous (patient de 80 ans ou plus)"
     - "Visites sur rendez-vous (patient de moins de 80 ans)"

- establishments table: Pour vérifier ep_33 = true (GMF status)
  SELECT numero, ep_33 FROM establishments WHERE numero = ?

  Column mapping:
  - CSV field "lieuPratique" → DB column "numero"
  - DB column "ep_33" → GMF indicator (true/false)

Note : Charger les données suivantes au démarrage et cache en mémoire
pour éviter requêtes répétées:
  1. Codes table (code → level1_group mapping)
  2. Établissements GMF (ep_33 = true)
```

### Row Flagging Strategy:

**Which CSV rows should be flagged with validation errors?**

This section specifies exactly which rows in the CSV should have the `billingRecordId` set
when creating validation results. This is critical for the UI to highlight the correct rows.

**Scenario 1 - Duplicate Detection:**

Strategy: **Flag all 8875 billings AFTER the first paid occurrence**

Rationale: The first paid billing is legitimate (it was accepted by RAMQ). All subsequent
billings in the same calendar year are duplicates and should be flagged as errors.

Implementation:
```javascript
// Sort billings by dateService ascending
const sorted = billings.sort((a, b) =>
  new Date(a.dateService) - new Date(b.dateService)
);

// Find first paid billing
const firstPaidIndex = sorted.findIndex(b => (b.montantPaye || 0) > 0);

// Flag all billings after first paid (whether they are paid or unpaid)
const results = [];
for (let i = firstPaidIndex + 1; i < sorted.length; i++) {
  results.push({
    validationRunId,
    ruleId: rule.id,
    billingRecordId: sorted[i].id,  // ← Flag THIS specific duplicate
    severity: "error",
    category: "gmf_forfait",
    message: `Le code 8875 (forfait GMF) ne peut être facturé qu'une seule fois par année civile par patient. Déjà facturé ${sorted.length} fois et payé ${paidCount} fois en ${year}.`,
    solution: `Veuillez annuler cette facturation. Le forfait 8875 a déjà été payé pour ce patient le ${sorted[firstPaidIndex].dateService}.`,
    affectedRecords: sorted.map(b => b.id),  // All related billings for context
    ruleData: { ... }
  });
}
```

Example:
- Billing Jan 15 (paid) → No error (first paid)
- Billing Mar 10 (paid) → ERROR flagged
- Billing Jun 20 (unpaid) → ERROR flagged

**Scenario 2 - Opportunity Detection:**

Strategy: **Flag the FIRST qualifying visit of the calendar year**

Rationale: The optimization message suggests billing 8875 "lors de la première visite de
l'année", so we flag that first visit as the logical place to add the 8875 code.

Implementation:
```javascript
// Sort visits by dateService ascending to find first visit of the year
const sortedVisits = visits.sort((a, b) =>
  new Date(a.dateService) - new Date(b.dateService)
);

const firstVisit = sortedVisits[0];

results.push({
  validationRunId,
  ruleId: rule.id,
  billingRecordId: firstVisit.id,  // ← Flag the FIRST visit
  severity: "optimization",
  category: "gmf_forfait",
  message: `Patient inscrit GMF avec ${visits.length} visite(s) en ${year} mais sans forfait 8875 facturé. Perte de revenu : 9,35$.`,
  solution: `Veuillez facturer le code 8875 (9,35$) lors de la première visite de l'année. Date de première visite GMF : ${firstVisit.dateService}.`,
  affectedRecords: sortedVisits.map(v => v.id),  // All visits for context
  ruleData: { ... }
});
```

Example:
- Visit Jan 15 (code 00103) → OPTIMIZATION flagged (first visit)
- Visit Feb 20 (code 00113) → No flag (context in affectedRecords only)
- Visit May 10 (code 00105) → No flag (context in affectedRecords only)

**Summary:**

| Scenario | billingRecordId | affectedRecords | Count |
|----------|----------------|-----------------|-------|
| Duplicate (Error) | Each duplicate after first paid | All 8875 billings for patient-year | N-1 errors (where N = total billings) |
| Opportunity (Optimization) | First visit of the year | All visits for patient-year | 1 optimization per patient-year |

### Performance Considerations:
```
Pour un fichier de 10,000 lignes avec 500 patients :

Scenario 1 - Duplicate :
- Filtrer code 8875 (~50-100 lignes)
- Grouper par patient-année (~50-100 groupes)
- Trier et identifier duplicata : O(n log n)
- Temps : < 10ms

Scenario 2 - Opportunité :
- Filtrer visites GMF (~2,000-3,000 lignes)
- Requête DB établissements GMF (une fois au démarrage)
- Grouper par patient-année (~200-300 groupes)
- Trier et identifier première visite : O(n log n)
- Vérifier présence 8875 : O(n)
- Temps : < 50ms

Total : < 60ms pour 10K lignes
Pas d'optimisation spéciale requise.
```

---

## Examples from Real Data

### Example CSV Input (Scenario 1 - Duplicate):
```csv
#,Facture,Date de Service,Code,Patient,Montant payé,Doctor Info
1,F001,2025-01-15,8875,ABCD12345678,9.35,DR-001
2,F002,2025-06-20,8875,ABCD12345678,9.35,DR-001
```

### Expected Validation Output:
```json
{
  "severity": "error",
  "category": "gmf_forfait",
  "message": "Le code 8875 (forfait GMF) ne peut être facturé qu'une seule fois par année civile par patient. Déjà facturé 2 fois et payé 2 fois en 2025.",
  "solution": "Veuillez annuler cette facturation. Le forfait 8875 a déjà été payé pour ce patient le 2025-01-15.",
  "ruleData": {
    "patient": "ABCD12345678",
    "year": 2025,
    "totalCount": 2,
    "paidCount": 2,
    "firstPaidDate": "2025-01-15",
    "affectedInvoices": ["F001", "F002"]
  }
}
```

### Example CSV Input (Scenario 2 - Opportunité):
```csv
#,Facture,Date de Service,Code,Lieu de pratique,Patient,Montant payé,Doctor Info
1,F001,2025-01-15,00103,55369,EFGH98765432,42.50,DR-001
2,F002,2025-02-20,00113,55369,EFGH98765432,38.00,DR-001
3,F003,2025-05-10,00105,55369,EFGH98765432,52.00,DR-001
```

Note: Établissement 55369 a ep_33 = true dans la base de données (GMF)

### Expected Validation Output:
```json
{
  "severity": "optimization",
  "category": "gmf_forfait",
  "message": "Patient inscrit GMF avec 3 visite(s) en 2025 mais sans forfait 8875 facturé. Perte de revenu : 9,35$.",
  "solution": "Veuillez facturer le code 8875 (9,35$) lors de la première visite de l'année. Date de première visite GMF : 2025-01-15.",
  "ruleData": {
    "patient": "EFGH98765432",
    "year": 2025,
    "visitCount": 3,
    "firstVisitDate": "2025-01-15",
    "potentialRevenue": 9.35,
    "gmfEstablishments": ["55369"]
  }
}
```

---

## Implementation Priority

**Priority**: `High`

**Estimated Complexity**: `Medium-High`
- Deux scenarios distincts (Error + Optimization)
- Requête DB pour établissements GMF
- Groupement par patient + année civile
- Détection de contextes exclus
- Calcul d'opportunités manquées

**Business Impact**:
```
Très élevé - Double impact financier et conformité

Impact Scenario 1 (Duplicate) :
- Conformité légale : Évite rejets RAMQ pour duplicata
- Évite remboursements forcés par la RAMQ
- Risque : ~500$ - 1,000$/mois en factures rejetées

Impact Scenario 2 (Opportunité) :
- Optimisation de revenus : Détecte revenus non réclamés
- Potentiel : 9,35$ par patient inscrit sans 8875
- Si 100 patients manqués/mois = 935$/mois = 11,220$/année
- Impact cumulatif important pour pratiques avec beaucoup de patients inscrits

Avantages combinés :
✅ Conformité réglementaire (évite rejets)
✅ Maximisation des revenus légitimes
✅ Éducation des médecins sur facturation GMF
✅ Automatisation de vérifications manuelles chronophages
✅ Amélioration de trésorerie (revenu récurrent annuel)

Temps économisé : 4-6 heures/semaine de révision manuelle des forfaits GMF
```

---

## Notes & Clarifications

```
IMPORTANT : Forfait de prise en charge GMF

Le code 8875 représente le forfait de prise en charge et de suivi des
patients inscrits dans un Groupe de Médecine de Famille (GMF).

Règles légales (Entente RAMQ) :
1. Payable UNE SEULE FOIS par année civile (1er janvier - 31 décembre)
2. Lors de la première visite du patient dans l'année
3. Même forfait que le médecin soit en cabinet, CLSC ou UMF
4. Montant : 9,35$ (tarif au 1er octobre 2019)

Contextes d'exclusion :
- MTA13 : Situation spéciale exemptant le forfait
- GMFU : GMF Universitaire (règles différentes)
- GAP : Groupe d'Accès Prioritaire (règles spéciales)
- G160 : Contexte spécial excluant le forfait 8875
- AR : Contexte spécial excluant le forfait 8875

Établissement GMF :
Un établissement est considéré GMF si le champ "ep_33" = true dans la
table establishments de la base de données. Le champ ep_33 correspond
à l'entente particulière 33 (GMF) de la RAMQ. Ceci est configuré par
l'administrateur du système selon les données RAMQ officielles.

Mapping de données :
- CSV: "lieuPratique" (ex: 55369) → DB: "numero" (ex: 55369)
- DB: "ep_33" = true → Établissement GMF
- DB: "ep_33" = false/NULL → Établissement non-GMF

Patient inscrit :
Dans cette règle, un patient est considéré "inscrit" s'il a au moins
une visite qualifiante dans un établissement GMF. Une visite qualifiante
est identifiée par:
1. Code de facturation spécifique: 8857 ou 8859, OU
2. Code de facturation appartenant à un level1_group de visite:
   - "Visites sur rendez-vous (patient de 80 ans ou plus)"
   - "Visites sur rendez-vous (patient de moins de 80 ans)"

Cette définition pragmatique permet de détecter les opportunités de
facturation sans avoir accès à la date d'inscription formelle du patient.

Changement de médecin :
Le texte légal mentionne que si un patient change de médecin dans le
même GMF, le forfait n'est payable que l'année suivante. Cette règle
ne peut pas valider ce cas car elle n'a pas accès à l'historique
d'inscription. Ceci reste une validation manuelle.

Formulaire 4096 :
Le médecin doit remplir le formulaire "Inscription auprès d'un médecin
de famille" et le conserver. Cette règle ne valide pas la présence du
formulaire (document externe au système de facturation).
```

---

## Approval & Sign-off

**Requested By**: Direction médicale / Service de facturation
**Date Requested**: 2025-01-10
**Approved By**: Comité de gestion GMF
**Implementation Deadline**: 2025-01-31
**Status**: ⏳ En attente d'implémentation
