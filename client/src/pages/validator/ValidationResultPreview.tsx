/**
 * Validation Result Card Preview Page
 *
 * This page displays all variations of the ValidationResultCard component
 * to preview the template design with different rule types and severity levels.
 */

import { useState } from "react";
import { ValidationResultCard } from "@/components/validation/ValidationResultCard";
import { ValidationResult } from "@/types/validation";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";

export function ValidationResultPreview() {
  const [darkMode, setDarkMode] = useState(false);

  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  // Mock validation results for preview
  const mockResults: ValidationResult[] = [
    // 1. Office Fee Error with Visit Statistics
    {
      id: "preview-error-1",
      validationRunId: "preview-run",
      ruleId: "office-fee-rule",
      severity: "error",
      category: "office-fees",
      message: "Code de frais de cabinet incorrect utilisé pour une visite enregistrée. Le code 19929 est utilisé mais le patient a un rendez-vous enregistré.",
      solution: "Utiliser le code 19928 pour les visites de cabinet avec rendez-vous enregistré. Modifier la facturation pour ce patient.",
      billingRecordId: "billing-001",
      affectedRecords: ["billing-001"],
      idRamq: "RAMQ12345678",
      monetaryImpact: -3.30,
      ruleName: "Office Fee Validation (19928/19929)",
      createdAt: "2025-01-13T10:30:00Z",
      ruleData: {
        monetaryImpact: -3.30,
        code: "19929",
        billedCode: "19929",
        billedAmount: "16,55$",
        hasContext: false,
        registeredPaidCount: 3,
        registeredUnpaidCount: 1,
        walkInPaidCount: 2,
        walkInUnpaidCount: 0,
        date: "2025-01-10",
        doctor: "DR***A1B",
        patient: "P***XYZ",
      },
    },

    // 2. Office Fee Error - Missing Context
    {
      id: "preview-error-2",
      validationRunId: "preview-run",
      ruleId: "office-fee-rule",
      severity: "error",
      category: "office-fees",
      message: "Éléments de contexte manquants pour la facturation du code 19928. Le type de visite ou l'établissement n'est pas spécifié.",
      solution: "Ajouter les éléments de contexte requis (type de visite, établissement) dans le CSV avant de soumettre à la RAMQ.",
      billingRecordId: "billing-002",
      affectedRecords: ["billing-002"],
      idRamq: "RAMQ98765432",
      monetaryImpact: 0,
      ruleName: "Office Fee Validation (19928/19929)",
      createdAt: "2025-01-13T11:00:00Z",
      ruleData: {
        monetaryImpact: 0,
        code: "19928",
        billedCode: "19928",
        billedAmount: "19,85$",
        hasContext: false,
        registeredPaidCount: 5,
        registeredUnpaidCount: 0,
        walkInPaidCount: 1,
        walkInUnpaidCount: 2,
        date: "2025-01-11",
        doctor: "DR***C2D",
        patient: "P***ABC",
      },
    },

    // 3. GMF Forfait Optimization - Positive Impact
    {
      id: "preview-optimization-1",
      validationRunId: "preview-run",
      ruleId: "gmf-forfait-8875",
      severity: "optimization",
      category: "gmf-forfait",
      message: "Patient éligible pour GMF forfait 8875 non facturé. Le patient a 6 visites dans l'année et est inscrit au GMF.",
      solution: "Facturer le code 8875 pour maximiser les revenus GMF. Ce patient est éligible et génère un potentiel de 180,00$ de revenus supplémentaires.",
      billingRecordId: null,
      affectedRecords: [],
      idRamq: "RAMQ55566677",
      monetaryImpact: 180.00,
      ruleName: "GMF Forfait 8875",
      createdAt: "2025-01-13T12:00:00Z",
      ruleData: {
        monetaryImpact: 180.00,
        patient: "P***DEF",
        year: 2024,
        visitCount: 6,
        firstVisitDate: "2024-03-15",
        potentialRevenue: 180.00,
        gmfEstablishments: ["11111", "22222"],
      },
    },

    // 4. Annual Billing Limit Warning
    {
      id: "preview-warning-1",
      validationRunId: "preview-run",
      ruleId: "annual-billing-limit",
      severity: "warning",
      category: "annual-limit",
      message: "Approche de la limite annuelle de facturation pour le code 8233. Le patient a déjà 11 facturations sur une limite de 12.",
      solution: "Vérifier la nécessité de cette facturation. Si elle dépasse la limite, elle sera refusée par la RAMQ.",
      billingRecordId: "billing-003",
      affectedRecords: ["billing-003"],
      idRamq: "RAMQ11122233",
      monetaryImpact: 0,
      ruleName: "Annual Billing Code Limit",
      createdAt: "2025-01-13T13:00:00Z",
      ruleData: {
        monetaryImpact: 0,
        patientYear: "P***GHI-2024",
        patient: "P***GHI",
        year: 2024,
        code: "8233",
        totalCount: 11,
        billingDates: ["2024-01-15", "2024-02-20", "2024-03-10"],
        date: "2024-12-15",
        doctor: "DR***E3F",
      },
    },

    // 5. Intervention Clinique Info
    {
      id: "preview-info-1",
      validationRunId: "preview-run",
      ruleId: "intervention-clinique",
      severity: "info",
      category: "intervention-clinique",
      message: "Validation d'intervention clinique complétée. Durée totale: 45 minutes. Toutes les règles sont respectées.",
      solution: null,
      billingRecordId: "billing-004",
      affectedRecords: ["billing-004"],
      idRamq: "RAMQ44455566",
      monetaryImpact: 0,
      ruleName: "Intervention Clinique Validation",
      createdAt: "2025-01-13T14:00:00Z",
      ruleData: {
        monetaryImpact: 0,
        totalMinutes: 45,
        interventionCount: 1,
        paidCount: 1,
        unpaidCount: 0,
        date: "2025-01-12",
        doctor: "DR***G4H",
        patient: "P***JKL",
      },
    },

    // 6. Visit Duration Optimization - Larger Gain
    {
      id: "preview-optimization-2",
      validationRunId: "preview-run",
      ruleId: "visit-duration-optimization",
      severity: "optimization",
      category: "revenue-optimization",
      message: "Opportunité de facturation avec supplément de durée. La visite a duré 35 minutes, permettant la facturation du code supplément 19233.",
      solution: "Ajouter le code 19233 (supplément de durée 30-45 minutes) pour augmenter la facturation de 14,30$.",
      billingRecordId: "billing-005",
      affectedRecords: ["billing-005"],
      idRamq: "RAMQ77788899",
      monetaryImpact: 14.30,
      ruleName: "Visit Duration Optimization",
      createdAt: "2025-01-13T15:00:00Z",
      ruleData: {
        monetaryImpact: 14.30,
        date: "2025-01-13",
        doctor: "DR***I5J",
        patient: "P***MNO",
      },
    },

    // 7. Error without RAMQ ID - System validation
    {
      id: "preview-error-3",
      validationRunId: "preview-run",
      ruleId: "system-validation",
      severity: "error",
      category: "context-validation",
      message: "Erreur de validation système détectée. Le fichier CSV contient des enregistrements avec des formats de date invalides.",
      solution: "Corriger le format des dates dans le fichier CSV. Format requis: AAAA-MM-JJ (exemple: 2025-01-13).",
      billingRecordId: null,
      affectedRecords: [],
      idRamq: "",
      monetaryImpact: 0,
      ruleName: "System Validation",
      createdAt: "2025-01-13T16:00:00Z",
      ruleData: {
        monetaryImpact: 0,
      },
    },
  ];

  return (
    <div className={`h-full overflow-y-auto transition-colors duration-200 ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Aperçu - Carte de résultat de validation
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Prévisualisation du template avec différents types de règles et niveaux de sévérité
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleDarkMode}
              className="flex items-center gap-2"
            >
              {darkMode ? (
                <>
                  <Sun className="w-4 h-4" />
                  <span>Mode clair</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4" />
                  <span>Mode sombre</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Summary */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400">Erreurs</div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">3</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400">Avertissements</div>
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">1</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400">Optimisations</div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">2</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400">Infos</div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">1</div>
          </div>
        </div>

        {/* Errors Section */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-red-700 dark:text-red-400 mb-4 flex items-center gap-2">
            <span>Erreurs (3)</span>
            <span className="text-sm font-normal text-gray-600 dark:text-gray-400">
              - Impact: -3,30$ (une erreur sans RAMQ ID)
            </span>
          </h2>
          <div className="space-y-4">
            {mockResults
              .filter((r) => r.severity === "error")
              .map((result) => (
                <ValidationResultCard key={result.id} result={result} showDetails={false} />
              ))}
          </div>
        </section>

        {/* Warnings Section */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-yellow-700 dark:text-yellow-400 mb-4">
            Avertissements (1)
          </h2>
          <div className="space-y-4">
            {mockResults
              .filter((r) => r.severity === "warning")
              .map((result) => (
                <ValidationResultCard key={result.id} result={result} showDetails={false} />
              ))}
          </div>
        </section>

        {/* Optimizations Section */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-amber-700 dark:text-amber-400 mb-4 flex items-center gap-2">
            <span>Opportunités d'optimisation (2)</span>
            <span className="text-sm font-normal text-gray-600 dark:text-gray-400">
              - Potentiel: +194,30$
            </span>
          </h2>
          <div className="space-y-4">
            {mockResults
              .filter((r) => r.severity === "optimization")
              .map((result) => (
                <ValidationResultCard key={result.id} result={result} showDetails={false} />
              ))}
          </div>
        </section>

        {/* Infos Section */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-blue-700 dark:text-blue-400 mb-4">
            Informations (1)
          </h2>
          <div className="space-y-4">
            {mockResults
              .filter((r) => r.severity === "info")
              .map((result) => (
                <ValidationResultCard key={result.id} result={result} showDetails={false} />
              ))}
          </div>
        </section>

        {/* Expanded View Example */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Exemple avec détails étendus
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Les cartes ci-dessous montrent les détails complets avec les sections étendues:
          </p>
          <div className="space-y-4">
            <ValidationResultCard result={mockResults[0]} showDetails={true} />
            <ValidationResultCard result={mockResults[2]} showDetails={true} />
          </div>
        </section>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
              💡 Note de développement
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Cette page de prévisualisation montre toutes les variantes du composant <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">ValidationResultCard</code>.
              Les données affichées sont des exemples fictifs pour démonstration.
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-200 mt-2">
              Documentation: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">docs/modules/validateur/VALIDATION_RESULT_CARD_EXAMPLES.md</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
