# Quebec Healthcare Billing CSV Format Reference

**Complete reference for realistic Quebec RAMQ billing CSV structure.**

---

## Real CSV Structure

### Key Characteristics

| Feature | Value |
|---------|-------|
| **Delimiter** | `;` (semicolon, NOT comma) |
| **Decimal Separator** | `,` (comma, NOT period) |
| **Encoding** | Latin-1 / Windows-1252 (French accents) |
| **Header Row** | Row 1 (with column names) |
| **Data Starts** | Row 2 |

---

## Column Structure

### Complete Header (Real Example)
```csv
#;Facture;ID RAMQ;Date de Service;Début;Fin;Periode;Lieu de pratique;Secteur d'activité;Diagnostic;Code;Unités;Rôle;Élément de contexte;Montant Preliminaire;Montant payé;Doctor Info;DEV NOTE - À TRADUIRE: Report_DailyClaimInfo_TotalPrelAmount;DEV NOTE - À TRADUIRE: Report_DailyClaimInfo_TotalFinalAmount;DEV NOTE - À TRADUIRE: Report_DailyClaimInfo_TotalCount;Agence;Patient;Grand Total
```

### Core Columns (Used in Validation)

| Column | Example Value | Format | Description |
|--------|---------------|--------|-------------|
| `#` | `1` | Integer | Row number (sequential) |
| `Facture` | `128072497` | 9 digits | Invoice number |
| `ID RAMQ` | `15588984573` | 11 digits | RAMQ billing ID |
| `Date de Service` | `2025-02-26` | YYYY-MM-DD | Service date |
| `Début` | `09:30` | HH:MM | Start time (often empty) |
| `Fin` | `10:00` | HH:MM | End time (often empty) |
| `Periode` | `202520` | YYYYWW | Year + Week number |
| `Lieu de pratique` | `55489` | 5 digits | Establishment number |
| `Secteur d'activité` | `Aucun Secteur` | Text | Activity sector (often "Aucun Secteur") |
| `Diagnostic` | `` | Text | Diagnosis (often empty) |
| `Code` | `15774` | 4-5 digits | RAMQ billing code |
| `Unités` | `0` | Integer | Units (for duration codes, usually 0) |
| `Rôle` | `1` | Integer | Role identifier |
| `Élément de contexte` | `ICEP` | Text | Context element (often empty) |
| `Montant Preliminaire` | `47,05` | Decimal (comma) | Preliminary amount (before payment) |
| `Montant payé` | `0,00` | Decimal (comma) | Paid amount |
| `Doctor Info` | `1069491-00000 \| Boyadjian, Shogher - Omnipraticien` | Complex | Doctor ID + Name + Specialty |
| `Patient` | `BELE20510712 - BELDI, ELYSSA` | NAM + Name | NAM (12 chars) + Full name |

---

## Field Format Details

### Patient Field (NAM Structure)

**Format**: `ABCD12345678 - LASTNAME, FIRSTNAME`

**Components**:
- **Letters (4)**: First 3 from last name + 1 from first name
- **Digits (8)**: Birthdate (YYMMDD) + sequence (2 digits)
- **Full Name**: After hyphen with comma separator

**Examples**:
```
BELE20510712 - BELDI, ELYSSA
DEGH24071614 - DE GRANDPRE, HENRI
NACL19562617 - NAC, L
ETIV77533119 - ÉTIENNE, VALÉRIE
```

**Important**: NAM is **Protected Health Information (PHI)** - must be handled securely!

---

### Doctor Info Field

**Format**: `XXXXXXX-XXXXX | Lastname, Firstname - Specialty`

**Components**:
- **Doctor Number**: 7 digits + hyphen + 5 digits
- **Name**: Lastname, Firstname (with French accents)
- **Specialty**: `Omnipraticien` (GP) or specific specialty
- **Spaces**: Note extra spaces at end (from export)

**Examples**:
```
1069491-00000 | Boyadjian, Shogher - Omnipraticien
1068303-00000 | Krait, Aurélie - Omnipraticien
```

---

### Date Fields

**Date de Service**: `YYYY-MM-DD`
```
2025-02-26
2025-03-31
2025-04-16
```

**Début / Fin**: `HH:MM` (24-hour format)
```
09:30
10:00
14:45
00:08  (after midnight)
```

**Période**: `YYYYWW` (Year + ISO Week Number)
```
202520  → 2025, week 20
202532  → 2025, week 32
```

---

### Money Fields

**Format**: Decimal with comma separator (French/Quebec standard)

**Examples**:
```
47,05   → $47.05
0,00    → $0.00
9,35    → $9.35
459,90  → $459.90
```

**Note**: When parsing in JavaScript/TypeScript:
```typescript
// Convert Quebec format → JavaScript number
const amount = parseFloat(montantPaye.replace(',', '.'));

// 47,05 → 47.05
```

---

### Code Field

**Format**: 4-5 digit RAMQ billing codes

**Common Examples**:
```
15774  → Visite standard
19928  → Office fee (6+ registered patients)
19929  → Office fee (mixed patients)
8875   → GMF forfait (annual)
15822  → Another visit type
```

---

### Élément de contexte (Context)

**Format**: Text, comma-separated if multiple contexts

**Examples**:
```
ICEP           → Single context
CLSC,ICEP      → Multiple contexts
85,G160        → Multiple contexts
               → Empty (most common)
```

**Special Contexts**:
- `ICEP` - Intervention Clinique Équivalente Protégée
- `ICSM` - Intervention Clinique Santé Mentale
- `ICTOX` - Intervention Clinique Toxicomanie
- `GMFU` - GMF Universitaire
- `MTA13` - Special context
- `GAP` - Groupe d'Accès Prioritaire
- `G160` - Special context
- `AR` - Special context

---

## Real CSV Example (Semicolon Delimited)

```csv
#;Facture;ID RAMQ;Date de Service;Début;Fin;Periode;Lieu de pratique;Secteur d'activité;Diagnostic;Code;Unités;Rôle;Élément de contexte;Montant Preliminaire;Montant payé;Doctor Info;Patient
1;128072497;15588984573;2025-02-26;09:30;;202520;55489;Aucun Secteur;;15774;0;1;;47,05;0,00;1069491-00000 | Boyadjian, Shogher - Omnipraticien  ;BELE20510712 - BELDI, ELYSSA
2;128072498;15588985505;2025-02-26;10:00;;202520;55489;Aucun Secteur;;15774;0;1;;47,05;0,00;1069491-00000 | Boyadjian, Shogher - Omnipraticien  ;DEGH24071614 - DE GRANDPRE, HENRI
3;128357270;15600245854;2025-04-16;00:00;;202520;55489;Aucun Secteur;;8875;0;1;;9,35;0,00;1069491-00000 | Boyadjian, Shogher - Omnipraticien  ;ETIV77533119 - ÉTIENNE, VALÉRIE
```

---

## Common Patterns

### Empty Visit Times
Many visits don't have `Début` and `Fin` times:
```csv
...;2025-04-16;00:00;;...  → Start time 00:00, no end time
```

### Same Patient Multiple Codes
Same invoice/visit can have multiple billing codes:
```csv
19;128357270;15600245854;2025-04-16;...;8875;...;ETIV77533119 - ÉTIENNE, VALÉRIE
20;128357270;15600245854;2025-04-16;...;15822;...;ETIV77533119 - ÉTIENNE, VALÉRIE
21;128357270;15600245854;2025-04-16;...;19959;...;ÉTIV77533119 - ÉTIENNE, VALÉRIE
```
All same `Facture` (128357270) and `ID RAMQ` (15600245854) → Same patient visit

---

## Using in Tests

### Test CSV Template (Realistic)

```csv
#;Facture;ID RAMQ;Date de Service;Début;Fin;Periode;Lieu de pratique;Secteur d'activité;Diagnostic;Code;Unités;Rôle;Élément de contexte;Montant Preliminaire;Montant payé;Doctor Info;Patient
1;128357270;15600245854;2025-04-16;00:00;;202520;55489;Aucun Secteur;;8875;0;1;;9,35;9,35;1069491-00000 | Boyadjian, Shogher - Omnipraticien  ;ETIV77533119 - ÉTIENNE, VALÉRIE
2;128357315;15600247173;2025-04-16;00:00;;202520;55489;Aucun Secteur;;8875;0;1;;9,35;9,35;1069491-00000 | Boyadjian, Shogher - Omnipraticien  ;ETIV77533119 - ÉTIENNE, VALÉRIE
```

### Test JSON (Realistic)

```json
{
  "scenarioId": "E1",
  "expectedResults": [
    {
      "severity": "error",
      "ruleData": {
        "patient": "ETIV77533119",
        "doctor": "1069491-00000 | Boyadjian, Shogher - Omnipraticien",
        "year": 2025,
        "code": "8875",
        "totalCount": 2,
        "paidCount": 2
      }
    }
  ]
}
```

---

## Important Notes

### PHI (Protected Health Information)

**Real NAM numbers are PHI** - treat carefully:
- ✅ Use in secure test environments
- ✅ Redact in logs (use `PHI_REDACTION_SALT`)
- ✅ Anonymize in documentation
- ❌ Never commit real NAM to public repos
- ❌ Never display full NAM to unauthorized users

### Anonymization for Documentation

**In MD files, use realistic but fake NAMs**:
```
TESTPATIENT1 - TEST, PATIENT A    ❌ Not realistic format
TEST12345678 - TEST, PATIENT A    ✅ Shows NAM structure
ABCD12345678 - LASTNAME, FIRSTNAME ✅ Shows NAM structure
```

**Keep the format structure, change the actual values.**

---

## TypeScript Mapping

From CSV to database:

```typescript
// CSV Column → TypeScript Property → PostgreSQL Column
{
  "#": "rowNumber",                    // Not stored (just CSV row)
  "Facture": "facture",                // facture
  "ID RAMQ": "idRamq",                 // id_ramq
  "Date de Service": "dateService",    // date_service
  "Début": "debut",                    // debut
  "Fin": "fin",                        // fin
  "Periode": "periode",                // periode
  "Lieu de pratique": "lieuPratique",  // lieu_pratique
  "Code": "code",                      // code
  "Unités": "unites",                  // unites
  "Élément de contexte": "elementContexte", // element_contexte
  "Montant Preliminaire": "montantPreliminaire", // montant_preliminaire
  "Montant payé": "montantPaye",       // montant_paye
  "Doctor Info": "doctorInfo",         // doctor_info
  "Patient": "patient"                 // patient (NAM extracted)
}
```

---

## Quick Reference

| Need | Example Value |
|------|---------------|
| **Delimiter** | `;` |
| **Decimal** | `47,05` |
| **Date** | `2025-02-26` |
| **Time** | `09:30` |
| **NAM** | `BELE20510712` |
| **Patient Full** | `BELE20510712 - BELDI, ELYSSA` |
| **Doctor** | `1069491-00000 \| Boyadjian, Shogher - Omnipraticien` |
| **Invoice** | `128072497` (9 digits) |
| **ID RAMQ** | `15588984573` (11 digits) |
| **Code** | `15774` or `8875` |
| **Money** | `9,35` (comma!) |

---

**Always use realistic format in test files, anonymized realistic format in documentation!** ✅
