/**
 * ValidationResultCard - Main template component for displaying validation results
 * Based on VALIDATION_RESULT_DISPLAY_FRAMEWORK.md Part 4 & 5
 *
 * Usage:
 * <ValidationResultCard result={validationResult} showDetails={true} />
 */

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  ValidationResultCardProps,
  OfficeFeeRuleData,
  GmfForfaitRuleData,
} from "@/types/validation";
import { getSeverityStyle, getCategoryDisplayName, getRuleDisplayName } from "./severityStyles";
import { MonetaryImpactBadge } from "./MonetaryImpactBadge";
import { BillingDetailsBox } from "./BillingDetailsBox";
import { VisitStatisticsGrid } from "./VisitStatisticsGrid";
import { SolutionBox } from "./SolutionBox";

export function ValidationResultCard({ result, showDetails = false }: ValidationResultCardProps) {
  const [isExpanded, setIsExpanded] = useState(showDetails);
  const style = getSeverityStyle(result.severity);
  const Icon = style.icon;

  // Type guards for rule-specific data
  const isOfficeFeeRule = (data: any): data is OfficeFeeRuleData => {
    return 'code' in data && 'billedAmount' in data;
  };

  const isGmfForfaitRule = (data: any): data is GmfForfaitRuleData => {
    return 'year' in data && 'visitCount' in data;
  };

  const hasVisitStatistics = (data: any): boolean => {
    return 'registeredPaidCount' in data && 'registeredUnpaidCount' in data &&
           'walkInPaidCount' in data && 'walkInUnpaidCount' in data;
  };

  return (
    <Card className={`${style.border} border-l-4 transition-all duration-200 hover:shadow-md`}>
      <CardHeader className={`${style.background} pb-3`}>
        {/* Top Row: Icon + RAMQ Badge + Rule Name + Monetary Impact */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-1">
            <Icon className={`${style.iconColor} w-5 h-5 flex-shrink-0`} />
            <div className="flex flex-col gap-1">
              {result.idRamq && (
                <Badge className={style.badge}>
                  {result.idRamq}
                </Badge>
              )}
              <span className={`text-sm font-semibold ${style.headerText}`}>
                {getRuleDisplayName(result.ruleName)}
              </span>
            </div>
          </div>

          {result.monetaryImpact !== 0 && (
            <MonetaryImpactBadge amount={result.monetaryImpact} size="md" />
          )}
        </div>

        {/* Main Message */}
        <div className={`mt-3 text-sm leading-relaxed ${style.headerText}`}>
          {result.message}
        </div>

        {/* Expand/Collapse Button */}
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full justify-between hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <span className="text-xs font-medium">
              {isExpanded ? "Masquer les détails" : "Afficher les détails"}
            </span>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      {/* Expandable Details Section */}
      {isExpanded && (
        <CardContent className="pt-4 space-y-4">
          {/* Solution Box - Always show if solution exists */}
          {result.solution && (
            <SolutionBox solution={result.solution} severity={result.severity} />
          )}

          {/* Office Fee Rule - Billing Details & Visit Statistics */}
          {isOfficeFeeRule(result.ruleData) && (
            <>
              <BillingDetailsBox
                code={result.ruleData.code}
                amount={result.ruleData.billedAmount || "N/A"}
                type={result.ruleData.billedCode || "N/A"}
                hasContext={result.ruleData.hasContext}
              />

              {hasVisitStatistics(result.ruleData) && (
                <VisitStatisticsGrid
                  registeredPaid={result.ruleData.registeredPaidCount || 0}
                  registeredUnpaid={result.ruleData.registeredUnpaidCount || 0}
                  walkinPaid={result.ruleData.walkInPaidCount || 0}
                  walkinUnpaid={result.ruleData.walkInUnpaidCount || 0}
                />
              )}
            </>
          )}

          {/* GMF Forfait Rule - Patient and Visit Information */}
          {isGmfForfaitRule(result.ruleData) && (
            <Card className="bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700">
              <CardContent className="pt-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Patient:</span>
                    <span className="font-mono font-semibold">{result.ruleData.patient}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Année:</span>
                    <span className="font-semibold">{result.ruleData.year}</span>
                  </div>
                  {result.ruleData.visitCount !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Nombre de visites:</span>
                      <span className="font-semibold">{result.ruleData.visitCount}</span>
                    </div>
                  )}
                  {result.ruleData.firstVisitDate && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Première visite:</span>
                      <span className="font-semibold">{result.ruleData.firstVisitDate}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Generic Rule Data - For rules without specific components */}
          {!isOfficeFeeRule(result.ruleData) && !isGmfForfaitRule(result.ruleData) && (
            <Card className="bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700">
              <CardContent className="pt-4">
                <div className="space-y-2 text-sm">
                  {result.ruleData.date && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Date:</span>
                      <span className="font-semibold">{result.ruleData.date}</span>
                    </div>
                  )}
                  {result.ruleData.doctor && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Médecin:</span>
                      <span className="font-mono font-semibold">{result.ruleData.doctor}</span>
                    </div>
                  )}
                  {result.ruleData.patient && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Patient:</span>
                      <span className="font-mono font-semibold">{result.ruleData.patient}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Metadata Section */}
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <details className="text-xs text-gray-500 dark:text-gray-400">
              <summary className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 font-medium">
                Informations techniques
              </summary>
              <div className="mt-2 space-y-1 pl-4">
                <div>ID Résultat: <span className="font-mono">{result.id}</span></div>
                <div>ID Règle: <span className="font-mono">{result.ruleId}</span></div>
                <div>Date: {new Date(result.createdAt).toLocaleString('fr-CA')}</div>
                {result.affectedRecords.length > 0 && (
                  <div>Enregistrements affectés: {result.affectedRecords.length}</div>
                )}
              </div>
            </details>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
