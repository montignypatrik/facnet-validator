# Guide d'Implémentation de l'Impact Financier dans les Règles de Validation

Guide complet pour implémenter le suivi de l'impact financier dans les règles de validation RAMQ.

---

## 📊 Vue d'Ensemble

L'impact financier permet de quantifier le **gain ou la perte monétaire potentiel** associé à chaque violation de règle ou opportunité d'optimisation. Cette fonctionnalité aide les utilisateurs à **prioriser les corrections** en fonction de leur valeur financière.

### Exemples d'Impact Financier

```
✅ Opportunité GMF 8875 non facturée → +9,35$
✅ Optimisation code 19928 → 19929 → +32,10$
✅ Intervention clinique (30 min) → +29,85$
❌ Facturation excédentaire → -64,80$
```

---

## 🎯 Pourquoi Implémenter l'Impact Financier?

### Bénéfices Utilisateur
1. **Priorisation** → Les utilisateurs peuvent corriger les erreurs les plus coûteuses en premier
2. **ROI Visible** → Quantification claire du gain potentiel si tous les problèmes sont résolés
3. **Décisions Éclairées** → Aide à décider quelles optimisations valent la peine d'être poursuivies
4. **Rapports Financiers** → Permet de générer des rapports sur les opportunités de revenus manquées

### Bénéfices Business
- Augmentation des revenus de facturation
- Réduction des erreurs coûteuses
- Amélioration de la conformité RAMQ
- Meilleure satisfaction client

---

## 🏗️ Architecture de l'Impact Financier

### 1. Structure de Données

```typescript
// Dans validation_results table (via InsertValidationResult)
{
  validationRunId: string,
  ruleId: string,
  billingRecordId: string | null,
  severity: "error" | "warning" | "optimization" | "info",
  category: string,
  message: string,
  solution: string | null,
  affectedRecords: string[],
  monetaryImpact?: number,  // 🔑 Impact financier en dollars
  ruleData: {
    // ... autres données spécifiques à la règle
    potentialRevenue?: number | string,  // Revenu potentiel
    monetaryImpact?: number | string,    // Impact financier (gain/perte)
    currentAmount?: string,              // Montant actuel facturé
    suggestedAmount?: string,            // Montant recommandé
    gain?: string                        // Gain net
  }
}
```

### 2. Champs Clés

| Champ | Type | Emplacement | Description |
|-------|------|-------------|-------------|
| `monetaryImpact` | number | Racine de result | **Impact financier principal** (positif = gain, négatif = perte) |
| `potentialRevenue` | number/string | ruleData | Revenu total potentiel si optimisation appliquée |
| `currentAmount` | string | ruleData | Montant actuel facturé |
| `gain` | string | ruleData | Gain net entre situation actuelle et optimale |

**⚠️ Important**: Le champ `monetaryImpact` à la racine est utilisé pour l'affichage dans l'UI. Les autres champs dans `ruleData` sont pour contexte additionnel.

---

## 📝 Guide d'Implémentation Étape par Étape

### Étape 1: Identifier le Type d'Impact Financier

Déterminez quel type d'impact financier votre règle génère:

| Type | Description | Exemple | monetaryImpact |
|------|-------------|---------|----------------|
| **Gain Potentiel** | Opportunité de revenus non exploitée | Code 8875 non facturé | +9.35 |
| **Optimisation** | Meilleur code disponible | 19928 → 19929 | +32.10 |
| **Perte Évitée** | Correction d'une sur-facturation | Retirer facturation excédentaire | -64.80 (négatif) |
| **Neutre** | Pas d'impact financier direct | Erreur de format | 0 ou undefined |

### Étape 2: Calculer l'Impact dans votre Règle

#### Exemple 1: Opportunité de Revenu (GMF Forfait 8875)

```typescript
// Dans server/modules/validateur/validation/rules/gmfForfait8875Rule.ts

// Scénario: Patient GMF sans forfait 8875 facturé
const potentialRevenue = 9.35; // Montant du code 8875

results.push({
  validationRunId,
  ruleId: "GMF_FORFAIT_8875",
  billingRecordId: firstVisit.id,
  severity: "optimization",
  category: "gmf_forfait",
  message: `Patient inscrit GMF avec ${visitCount} visite(s) en ${year} mais sans forfait 8875 facturé. Perte de revenu : ${potentialRevenue.toFixed(2)}$.`,
  solution: `Veuillez facturer le code 8875 (${potentialRevenue.toFixed(2)}$) lors de la première visite de l'année.`,
  monetaryImpact: potentialRevenue,  // 🔑 Impact à la racine
  affectedRecords: sortedVisits.map(v => v.id).filter(Boolean) as string[],
  ruleData: {
    patient,
    year,
    visitCount,
    firstVisitDate,
    potentialRevenue: potentialRevenue,  // Aussi dans ruleData pour contexte
    gmfEstablishments: gmfEstablishmentsList
  }
});
```

**Points Clés**:
- ✅ `monetaryImpact` à la racine = valeur numérique (9.35)
- ✅ `severity` = "optimization" pour opportunités
- ✅ `potentialRevenue` dans `ruleData` pour référence
- ✅ Message inclut le montant en dollars avec `.toFixed(2)`

#### Exemple 2: Optimisation de Code (Office Fee)

```typescript
// Dans server/modules/validateur/validation/rules/officeFeeRule.ts

// Scénario: 12 patients inscrits → peut facturer 19929 au lieu de 19928
const currentCode = "19928";
const currentAmount = 32.10;
const suggestedCode = "19929";
const suggestedAmount = 64.20;
const gain = suggestedAmount - currentAmount; // 32.10$

results.push({
  validationRunId,
  ruleId: "OFFICE_FEE_19928_19929",
  billingRecordId: firstRecord.id,
  severity: "optimization",
  category: "office_fees",
  message: `Optimisation de revenus: ${doctor} a vu ${registeredCount} patients avec rendez-vous le ${date} et a facturé ${currentCode} (${currentAmount.toFixed(2)}$), mais pourrait facturer ${suggestedCode} (${suggestedAmount.toFixed(2)}$)`,
  solution: `Facturer ${suggestedCode} au lieu de ${currentCode} pour un gain de ${gain.toFixed(2)}$`,
  monetaryImpact: gain,  // 🔑 Gain net (32.10)
  affectedRecords: affectedRecordIds,
  ruleData: {
    code: suggestedCode,
    type: "registered",
    currentCode,
    eligibleCount: registeredCount,
    potentialRevenue: suggestedAmount.toFixed(2),  // "64.20"
    currentRevenue: currentAmount.toFixed(2),      // "32.10"
    monetaryImpact: gain.toFixed(2),               // "32.10"
    doctor,
    date
  }
});
```

**Points Clés**:
- ✅ Calcul du gain net (différence entre situation optimale et actuelle)
- ✅ `monetaryImpact` = gain (positif = meilleur)
- ✅ `ruleData` contient montants actuels ET suggérés
- ✅ Utilisation de `.toFixed(2)` pour strings, nombres purs pour `monetaryImpact`

#### Exemple 3: Visite → Intervention Clinique

```typescript
// Dans server/modules/validateur/validation/rules/visitDurationOptimizationRule.ts

// Scénario: Visite de 45 minutes → Intervention clinique plus avantageuse
const currentCode = record.code;
const currentAmount = 49.15; // Montant visite actuelle
const duration = 45; // minutes

// Calcul intervention clinique: 8857 (30 min base) + 8859 (15 min additionnel)
const interventionAmount = 59.70 + 29.85; // 89.55$
const gain = interventionAmount - currentAmount; // 40.40$

const suggestedCodes = [
  { code: "8857", description: "Base 30 minutes", amount: 59.70 },
  { code: "8859", description: "15 minutes additionnelles", amount: 29.85 }
];

results.push({
  validationRunId,
  ruleId: "VISIT_DURATION_OPTIMIZATION",
  billingRecordId: record.id,
  severity: "optimization",
  category: "revenue_optimization",
  message: `Visite de ${duration} minutes facturée ${currentCode} (${currentAmount.toFixed(2)}$). Intervention clinique recommandée pour un gain de ${gain.toFixed(2)}$.`,
  solution: `Facturer codes 8857 + 8859 (${interventionAmount.toFixed(2)}$) au lieu de ${currentCode}`,
  monetaryImpact: gain,  // 🔑 Gain net (40.40)
  affectedRecords: [record.id],
  ruleData: {
    currentCode,
    duration,
    currentAmount: currentAmount.toFixed(2),      // "49.15"
    interventionAmount: interventionAmount.toFixed(2), // "89.55"
    gain: gain.toFixed(2),                        // "40.40"
    potentialRevenue: gain.toFixed(2),            // "40.40"
    monetaryImpact: gain.toFixed(2),              // "40.40"
    suggestedCodes,
    debut: record.debut,
    fin: record.fin
  }
});
```

**Points Clés**:
- ✅ Calcul basé sur durée réelle (début/fin)
- ✅ Codes suggérés avec détails (breakdown)
- ✅ Gain = différence entre intervention et visite actuelle
- ✅ Triple référence: `monetaryImpact`, `potentialRevenue`, `gain`

#### Exemple 4: Erreur de Sur-Facturation (Impact Négatif)

```typescript
// Exemple: Maximum quotidien dépassé
const maxDaily = 64.80;
const actualTotal = 96.60;
const overage = actualTotal - maxDaily; // 31.80$ (à rembourser)

results.push({
  validationRunId,
  ruleId: "OFFICE_FEE_19928_19929",
  billingRecordId: firstOfficeFeeBilling.id,
  severity: "error",
  category: "office_fees",
  message: `Maximum quotidien de frais de bureau de ${maxDaily.toFixed(2)}$ dépassé pour ${doctor} le ${date} (total: ${actualTotal.toFixed(2)}$)`,
  solution: `Veuillez annuler ${overage.toFixed(2)}$ de facturation excédentaire`,
  monetaryImpact: -overage,  // 🔑 Impact négatif (-31.80)
  affectedRecords: affectedIds,
  ruleData: {
    doctor,
    date,
    totalAmount: actualTotal.toFixed(2),
    maxAllowed: maxDaily.toFixed(2),
    overage: overage.toFixed(2),
    monetaryImpact: -overage  // Impact négatif
  }
});
```

**Points Clés**:
- ✅ `monetaryImpact` **négatif** pour sur-facturation
- ✅ `severity` = "error" (pas "optimization")
- ✅ Message indique clairement le dépassement
- ✅ Solution mentionne l'annulation requise

---

## 🎨 Affichage dans l'Interface Utilisateur

### Comment l'UI Utilise monetaryImpact

Le frontend (RunDetails.tsx) calcule automatiquement:

```typescript
// 1. Total Impact de Tous les Résultats
const totalImpact = validationResults.reduce((sum: number, result: any) => {
  return sum + (result.monetaryImpact || 0);
}, 0);

// 2. Impact par Catégorie
const impactByCategory = validationResults.reduce((acc: Record<string, number>, result: any) => {
  const category = result.category || 'other';
  acc[category] = (acc[category] || 0) + (result.monetaryImpact || 0);
  return acc;
}, {});
```

### Carte d'Impact Financier

L'UI affiche automatiquement une carte résumé si `totalImpact > 0`:

```
┌─────────────────────────────────────────┐
│ 💰 Impact financier potentiel          │
│                                         │
│          $182.50                        │
│    Gain total potentiel                │
│                                         │
│ Répartition par catégorie:             │
│ • Frais de cabinet:        $96.30      │
│ • GMF forfait:             $46.75      │
│ • Optimisation visite:     $39.45      │
└─────────────────────────────────────────┘
```

### Badge d'Impact par Résultat

Chaque résultat affiche un badge coloré:

```typescript
// Badge vert pour gains
{result.monetaryImpact > 0 && (
  <Badge className="bg-green-100 text-green-700">
    💵 Gain: ${result.monetaryImpact.toFixed(2)}
  </Badge>
)}

// Badge rouge pour pertes
{result.monetaryImpact < 0 && (
  <Badge className="bg-red-100 text-red-700">
    💵 Perte: ${Math.abs(result.monetaryImpact).toFixed(2)}
  </Badge>
)}
```

---

## ✅ Checklist d'Implémentation

Avant de soumettre votre règle avec impact financier, vérifiez:

### Calculs
- [ ] `monetaryImpact` est un **nombre** (pas une string) à la racine du result
- [ ] Impact positif pour gains/opportunités, négatif pour pertes/sur-facturation
- [ ] Calculs précis avec `.toFixed(2)` pour affichage monétaire
- [ ] Gestion correcte des cas null/undefined (pas d'impact)

### Messages
- [ ] Message principal mentionne le montant avec `$` et `.toFixed(2)`
- [ ] Solution décrit clairement l'action à prendre
- [ ] Montants cohérents entre message, solution, et ruleData

### ruleData
- [ ] `potentialRevenue` présent si applicable
- [ ] `currentAmount` et `suggestedAmount` si comparaison
- [ ] `gain` calculé correctement (différence)
- [ ] Détails suffisants pour debugging/audit

### Severity
- [ ] `"optimization"` pour opportunités de gain
- [ ] `"error"` pour sur-facturation/pertes
- [ ] `"warning"` pour situations ambiguës
- [ ] `"info"` pour informations sans impact

### Tests
- [ ] Test avec `monetaryImpact > 0` (gain)
- [ ] Test avec `monetaryImpact < 0` (perte)
- [ ] Test avec `monetaryImpact = 0` ou undefined (neutre)
- [ ] Test de calcul avec cas limites (ex: 0.005 → 0.01)

---

## 🧪 Exemples de Tests

### Test 1: Opportunité de Revenu

```typescript
import { describe, it, expect } from 'vitest';
import { gmfForfait8875Rule } from '@/server/modules/validateur/validation/rules/gmfForfait8875Rule';

describe('GMF Forfait 8875 - Monetary Impact', () => {
  it('should calculate potential revenue for missed 8875 opportunity', async () => {
    const records: BillingRecord[] = [
      {
        id: 'visit-1',
        patient: 'PATIENT-001',
        dateService: new Date('2025-03-15'),
        code: '8857', // Visite GMF
        lieuPratique: '12345', // GMF establishment
        montantPaye: '59.70'
      }
      // Pas de code 8875 facturé
    ];

    const results = await gmfForfait8875Rule.validate(records, 'run-123');

    const opportunity = results.find(r =>
      r.severity === 'optimization' &&
      r.ruleData?.potentialRevenue
    );

    expect(opportunity).toBeDefined();
    expect(opportunity?.monetaryImpact).toBe(9.35);
    expect(opportunity?.ruleData?.potentialRevenue).toBe(9.35);
    expect(opportunity?.message).toContain('9,35$');
  });
});
```

### Test 2: Optimisation de Code

```typescript
describe('Office Fee - Code Upgrade Optimization', () => {
  it('should calculate gain when upgrading from 19928 to 19929', async () => {
    const records: BillingRecord[] = [
      {
        id: 'office-1',
        medecin: 'DR001',
        dateService: new Date('2025-03-15'),
        code: '19928',
        montantPaye: '32.10'
      },
      // 12 patients inscrits avec rendez-vous...
    ];

    const results = await officeFeeValidationRule.validate(records, 'run-123');

    const optimization = results.find(r =>
      r.severity === 'optimization' &&
      r.ruleData?.currentCode === '19928'
    );

    expect(optimization).toBeDefined();
    expect(optimization?.monetaryImpact).toBe(32.10);
    expect(optimization?.ruleData?.gain).toBe("32.10");
    expect(optimization?.ruleData?.potentialRevenue).toBe("64.20");
    expect(optimization?.ruleData?.currentRevenue).toBe("32.10");
  });
});
```

### Test 3: Impact Négatif (Sur-Facturation)

```typescript
describe('Office Fee - Daily Maximum Exceeded', () => {
  it('should calculate negative impact for overage', async () => {
    const records: BillingRecord[] = [
      { code: '19928', montantPaye: '32.10', medecin: 'DR001', dateService: new Date('2025-03-15') },
      { code: '19929', montantPaye: '64.20', medecin: 'DR001', dateService: new Date('2025-03-15') }
      // Total: 96.30$ > 64.80$ max
    ];

    const results = await officeFeeValidationRule.validate(records, 'run-123');

    const error = results.find(r => r.severity === 'error');

    expect(error).toBeDefined();
    expect(error?.monetaryImpact).toBe(-31.50); // Négatif!
    expect(error?.message).toContain('dépassé');
    expect(error?.solution).toContain('annuler');
  });
});
```

---

## 🔍 Cas Spéciaux et Edge Cases

### Cas 1: Multiple Opportunités Similaires

Si une règle détecte plusieurs opportunités identiques:

```typescript
// Mauvais: Créer un résultat par opportunité avec même montant
results.push({ monetaryImpact: 9.35 }); // Patient 1
results.push({ monetaryImpact: 9.35 }); // Patient 2
results.push({ monetaryImpact: 9.35 }); // Patient 3
// UI affichera: Total = 28.05$ ✅ Correct

// Bon: Les impacts s'additionnent naturellement
```

### Cas 2: Impact Zéro vs Undefined

```typescript
// undefined: Pas d'impact financier (ex: erreur de format)
{
  severity: "error",
  message: "Format de date invalide",
  monetaryImpact: undefined  // Pas de badge financier dans l'UI
}

// 0: Impact calculé mais nul (ex: code équivalent)
{
  severity: "info",
  message: "Code alternatif disponible (même tarif)",
  monetaryImpact: 0  // Badge avec $0.00
}
```

### Cas 3: Conversion String → Number

```typescript
// ❌ Mauvais: String à la racine
{
  monetaryImpact: "32.10"  // TypeError dans UI sum()
}

// ✅ Bon: Number à la racine, string dans ruleData
{
  monetaryImpact: 32.10,  // Number pour calculs UI
  ruleData: {
    gain: "32.10"  // String pour affichage formaté
  }
}
```

### Cas 4: Arrondissement Monétaire

```typescript
// Toujours utiliser 2 décimales pour argent
const gain = 32.10567;

// ❌ Mauvais
monetaryImpact: gain  // 32.10567 (trop précis)

// ✅ Bon
monetaryImpact: parseFloat(gain.toFixed(2))  // 32.11

// Ou encore mieux: Math.round(gain * 100) / 100
monetaryImpact: Math.round(gain * 100) / 100  // 32.11
```

---

## 📈 Impact Financier Agrégé (Résumé Global)

Certaines règles créent un résultat "info" avec le total:

```typescript
// Exemple: Résultat de synthèse GMF 8875
const totalOpportunities = opportunityResults.length;
const totalPotentialRevenue = totalOpportunities * 9.35;

results.push({
  validationRunId,
  ruleId: "GMF_FORFAIT_8875",
  billingRecordId: firstRelevantRecord.id,
  severity: "info",
  category: "gmf_forfait",
  message: `Validation GMF 8875 complétée: ${totalOpportunities} opportunité(s) détectée(s). Revenu potentiel total: ${totalPotentialRevenue.toFixed(2)}$.`,
  solution: null,
  monetaryImpact: undefined,  // Pas d'impact pour résumé (évite double comptage)
  affectedRecords: opportunityRecordIds,
  ruleData: {
    totalOpportunities,
    totalPotentialRevenue: totalPotentialRevenue.toFixed(2),
    // ... autres statistiques
  }
});
```

**⚠️ Important**: Résultats "info" de synthèse ne doivent PAS avoir `monetaryImpact` défini pour éviter le double comptage dans l'UI.

---

## 🚀 Exemples Complets par Type de Règle

### Type 1: Opportunité Simple (Forfait Non Facturé)

**Business Logic**: Patient GMF n'a pas de forfait 8875 facturé cette année

```typescript
// Calcul
const potentialRevenue = 9.35;

// Result
{
  severity: "optimization",
  monetaryImpact: potentialRevenue,
  message: `Perte de revenu : ${potentialRevenue.toFixed(2)}$.`,
  solution: `Facturer le code 8875 (${potentialRevenue.toFixed(2)}$)`,
  ruleData: {
    potentialRevenue,
    // ... contexte
  }
}
```

### Type 2: Optimisation par Substitution (Meilleur Code)

**Business Logic**: Code actuel facturé, mais meilleur code disponible

```typescript
// Calcul
const currentAmount = 32.10;
const suggestedAmount = 64.20;
const gain = suggestedAmount - currentAmount;

// Result
{
  severity: "optimization",
  monetaryImpact: gain,
  message: `Facturé ${currentCode} (${currentAmount}$), pourrait facturer ${suggestedCode} (${suggestedAmount}$)`,
  solution: `Facturer ${suggestedCode} pour un gain de ${gain.toFixed(2)}$`,
  ruleData: {
    currentCode,
    currentAmount: currentAmount.toFixed(2),
    suggestedCode,
    suggestedAmount: suggestedAmount.toFixed(2),
    gain: gain.toFixed(2),
    potentialRevenue: suggestedAmount.toFixed(2),
    monetaryImpact: gain.toFixed(2)
  }
}
```

### Type 3: Erreur avec Impact Négatif (Sur-Facturation)

**Business Logic**: Maximum quotidien dépassé, nécessite remboursement

```typescript
// Calcul
const maxAllowed = 64.80;
const actualTotal = 96.30;
const overage = actualTotal - maxAllowed;

// Result
{
  severity: "error",
  monetaryImpact: -overage,  // Négatif!
  message: `Maximum de ${maxAllowed.toFixed(2)}$ dépassé (total: ${actualTotal.toFixed(2)}$)`,
  solution: `Annuler ${overage.toFixed(2)}$ de facturation excédentaire`,
  ruleData: {
    maxAllowed: maxAllowed.toFixed(2),
    actualTotal: actualTotal.toFixed(2),
    overage: overage.toFixed(2),
    monetaryImpact: -overage
  }
}
```

### Type 4: Optimisation Complexe (Durée → Codes Multiples)

**Business Logic**: Visite longue → Intervention clinique avec codes additionnels

```typescript
// Calcul
const duration = 75; // minutes
const currentAmount = 49.15;

// Base 30 min + 3x 15 min additionnels
const interventionAmount = 59.70 + (3 * 29.85);
const gain = interventionAmount - currentAmount;

const suggestedCodes = [
  { code: "8857", description: "Base 30 minutes", amount: 59.70 },
  { code: "8859", description: "15 min (x3)", amount: 89.55 }
];

// Result
{
  severity: "optimization",
  monetaryImpact: gain,
  message: `Visite de ${duration} min → Intervention clinique recommandée (gain: ${gain.toFixed(2)}$)`,
  solution: `Facturer 8857 + 3x8859 (${interventionAmount.toFixed(2)}$)`,
  ruleData: {
    duration,
    currentCode: record.code,
    currentAmount: currentAmount.toFixed(2),
    interventionAmount: interventionAmount.toFixed(2),
    gain: gain.toFixed(2),
    potentialRevenue: gain.toFixed(2),
    monetaryImpact: gain.toFixed(2),
    suggestedCodes,
    breakdown: {
      base: "59.70",
      additional: "89.55",
      periods: 3
    }
  }
}
```

---

## 📚 Références

### Fichiers Exemple
- `server/modules/validateur/validation/rules/gmfForfait8875Rule.ts` (lignes 246-253)
- `server/modules/validateur/validation/rules/officeFeeRule.ts` (lignes 242-252, 263-275)
- `server/modules/validateur/validation/rules/visitDurationOptimizationRule.ts` (lignes 132-141)

### UI Rendering
- `client/src/pages/validator/RunDetails.tsx` (lignes 409-468)

### Schema Types
- `shared/schema.ts` - Type `InsertValidationResult`

---

## ❓ FAQ

**Q: Dois-je toujours inclure `monetaryImpact`?**
R: Non. Seulement si la règle a un impact financier quantifiable. Les erreurs de format n'ont pas d'impact financier direct.

**Q: Quelle unité utiliser?**
R: Toujours en **dollars canadiens** (CAD). Pas de conversion, le système RAMQ est québécois.

**Q: Comment gérer les taxes?**
R: Les montants RAMQ n'incluent PAS de taxes. Utilisez les tarifs officiels RAMQ directement.

**Q: Que faire si l'impact dépend de multiples facteurs?**
R: Calculez le "best case" (meilleur scénario possible) et ajoutez des conditions dans le message.

**Q: Peut-on avoir un impact financier pour `severity: "info"`?**
R: Généralement non, sauf pour résultats de synthèse où `monetaryImpact` devrait être `undefined`.

---

**Dernière mise à jour**: 2025-10-13
**Maintenu par**: Équipe Dash
**Version**: 1.0

---

## 🎯 Résumé Rapide

Pour implémenter l'impact financier:

1. ✅ Ajoutez `monetaryImpact: number` à la racine du result
2. ✅ Positif pour gains, négatif pour pertes
3. ✅ Ajoutez `potentialRevenue` dans `ruleData` si applicable
4. ✅ Utilisez `.toFixed(2)` pour affichage monétaire
5. ✅ Testez avec gains, pertes, et cas neutres
6. ✅ Vérifiez l'affichage dans l'UI (carte résumé + badges)

**L'UI fait le reste automatiquement!** 🎉
