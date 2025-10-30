/**
 * ValidationResultCard - Main template component for displaying validation results
 * Based on VALIDATION_RESULT_DISPLAY_FRAMEWORK.md Part 4 & 5
 *
 * Display Behavior by Severity:
 * - PASS (info): Collapsed by default, user can expand
 * - ERROR (error): Always expanded, cannot collapse
 * - OPTIMIZATION (optimization): Always expanded, highlighted with monetary gain
 *
 * Usage:
 * <ValidationResultCard result={validationResult} showDetails={true} />
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  ValidationResultCardProps,
  OfficeFeeRuleData,
  GmfForfaitRuleData,
  AnnualLimitRuleData,
} from "@/types/validation";
import { getSeverityStyle, getCategoryDisplayName, getRuleDisplayName, formatCurrency } from "./severityStyles";
import { MonetaryImpactBadge } from "./MonetaryImpactBadge";
import { BillingDetailsBox } from "./BillingDetailsBox";
import { VisitStatisticsGrid } from "./VisitStatisticsGrid";
import { SolutionBox } from "./SolutionBox";
import { OfficeFeeBreakdownBox } from "./OfficeFeeBreakdownBox";
import { ComparisonBox } from "./ComparisonBox";

export function ValidationResultCard({ result, showDetails = false }: ValidationResultCardProps) {
  // All scenarios are collapsed by default
  // User can expand any scenario to see details
  const defaultExpanded = showDetails;

  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Sync state with props when result changes
  useEffect(() => {
    setIsExpanded(defaultExpanded);
  }, [result.id, defaultExpanded]);

  const style = getSeverityStyle(result.severity);
  const Icon = style.icon;

  // Type guards for rule-specific data - Order matters! Check most specific first

  // Annual Limit Rule - Check first since it has specific fields
  const isAnnualLimitRule = (data: any): data is AnnualLimitRuleData => {
    return 'year' in data && 'totalCount' in data && 'code' in data && 'patientYear' in data;
  };

  // GMF Forfait Rule
  const isGmfForfaitRule = (data: any): data is GmfForfaitRuleData => {
    return 'year' in data && 'visitCount' in data && 'patient' in data && !('totalCount' in data);
  };

  // E5 daily maximum error has multi-patient data
  const isOfficeFeeE5Error = (data: any): data is OfficeFeeRuleData => {
    return 'affectedRamqIds' in data && 'feeBreakdownWithPatients' in data;
  };

  // Office Fee Rule - Check last since it's broader
  // All office fee scenarios (E1-E8, O1-O6, P1-P11) have visit statistics
  const isOfficeFeeRule = (data: any): data is OfficeFeeRuleData => {
    const hasVisitStats = 'registeredPaidCount' in data || 'walkInPaidCount' in data;
    const notAnnualRule = !('patientYear' in data);
    const notGmfRule = !('visitCount' in data && 'patient' in data);

    return hasVisitStats && notAnnualRule && notGmfRule;
  };

  const hasVisitStatistics = (data: any): boolean => {
    return 'registeredPaidCount' in data && 'registeredUnpaidCount' in data &&
           'walkInPaidCount' in data && 'walkInUnpaidCount' in data;
  };

  // Check if this is an optimization scenario that needs comparison box
  const needsComparisonBox = (data: any): boolean => {
    return result.severity === "optimization" &&
           'currentCode' in data &&
           'suggestedCode' in data &&
           'currentAmount' in data &&
           'expectedAmount' in data;
  };

  return (
    <Card className={`${style.border} border-l-4 transition-all duration-200 hover:shadow-md`}>
      <CardHeader className={`${style.background} pb-3`}>
        {/* Top Row: Icon + RAMQ Badge(s) + Rule Name + Monetary Impact */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-1">
            <Icon className={`${style.iconColor} w-5 h-5 flex-shrink-0`} />
            <div className="flex flex-col gap-1">
              {/* Multi-RAMQ badges for doctor-level errors (E5) */}
              {isOfficeFeeE5Error(result.ruleData) && result.ruleData.affectedRamqIds && result.ruleData.affectedRamqIds.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {result.ruleData.affectedRamqIds.slice(0, 3).map((ramqId: string) => (
                    <Badge key={ramqId} variant="outline" className="font-mono text-xs">
                      {ramqId}
                    </Badge>
                  ))}
                  {result.ruleData.affectedRamqIds.length > 3 && (
                    <Badge variant="outline" className="text-xs text-gray-600 dark:text-gray-400">
                      +{result.ruleData.affectedRamqIds.length - 3} autres
                    </Badge>
                  )}
                </div>
              ) : result.idRamq ? (
                <Badge className={style.badge}>
                  {result.idRamq}
                </Badge>
              ) : null}
              <span className={`text-sm font-semibold ${style.headerText}`}>
                {getRuleDisplayName(result.ruleName)}
              </span>
            </div>
          </div>

          {/* Monetary Impact Badge - Prominent for optimizations */}
          {result.monetaryImpact !== 0 && (
            <MonetaryImpactBadge
              amount={result.monetaryImpact}
              size={result.severity === "optimization" ? "lg" : "md"}
            />
          )}
        </div>

        {/* Main Message */}
        <div className={`mt-3 text-sm leading-relaxed ${style.headerText}`}>
          {result.message}
        </div>

        {/* Expand/Collapse Button - Available for all scenarios */}
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
      {/* Always visible for errors and optimizations, toggleable for info */}
      {isExpanded && (
        <CardContent className="pt-4 space-y-4">
          {/* Solution Box - Always show if solution exists */}
          {/* Highlighted styling for errors and optimizations */}
          {result.solution && (
            <SolutionBox solution={result.solution} severity={result.severity} />
          )}

          {/* Comparison Box - For optimization scenarios with code changes */}
          {needsComparisonBox(result.ruleData) && (() => {
            const optData = result.ruleData as OfficeFeeRuleData;
            return (
              <ComparisonBox
                currentCode={optData.currentCode!}
                suggestedCode={optData.suggestedCode!}
                currentAmount={optData.currentAmount!}
                expectedAmount={optData.expectedAmount!}
                monetaryImpact={result.monetaryImpact}
              />
            );
          })()}

          {/* Affected Records Details - Show RAMQ IDs and dates for optimizations */}
          {isOfficeFeeRule(result.ruleData) &&
           (result.ruleData as OfficeFeeRuleData).affectedRecordsDetails &&
           (result.ruleData as OfficeFeeRuleData).affectedRecordsDetails!.length > 0 && (() => {
            const optData = result.ruleData as OfficeFeeRuleData;
            return (
              <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700">
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-blue-900 dark:text-blue-100">
                        Enregistrements à modifier
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {optData.affectedRecordsDetails!.length}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {optData.affectedRecordsDetails!.map((record, index) => (
                        <div
                          key={record.id || index}
                          className="bg-white dark:bg-gray-800 rounded-md p-3 border border-blue-200 dark:border-blue-700"
                        >
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">RAMQ:</span>
                              <span className="ml-2 font-mono font-semibold">{record.idRamq}</span>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Date:</span>
                              <span className="ml-2 font-semibold">{record.date}</span>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Code:</span>
                              <span className="ml-2 font-mono font-semibold">{record.code}</span>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Montant:</span>
                              <span className="ml-2 font-semibold">{formatCurrency(record.amount)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                      💡 Utilisez le RAMQ et la date pour trouver ces enregistrements dans votre système
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Annual Limit Rule - Display scenario-specific information (check first!) */}
          {isAnnualLimitRule(result.ruleData) && (() => {
            const annualData = result.ruleData as AnnualLimitRuleData;
            return (
              <Card className="bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700">
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    {/* Base information */}
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Code:</span>
                        <span className="font-mono font-semibold">{annualData.code}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Année:</span>
                        <span className="font-semibold">{annualData.year}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Nombre total:</span>
                        <span className="font-semibold">{annualData.totalCount}</span>
                      </div>
                      {annualData.paidCount !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Factures payées:</span>
                          <span className="font-semibold">{annualData.paidCount}</span>
                        </div>
                      )}
                      {annualData.unpaidCount !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Factures non payées:</span>
                          <span className="font-semibold">{annualData.unpaidCount}</span>
                        </div>
                      )}
                    </div>

                    {/* E2 Scenario - Show paid and unpaid invoice details */}
                    {annualData.paidIdRamq && annualData.unpaidIdRamqs && annualData.unpaidIdRamqs.length > 0 && (
                      <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-3">
                        {/* Paid invoice */}
                        <div>
                          <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            Facture payée:
                          </div>
                          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600 dark:text-gray-400">ID RAMQ:</span>
                              <span className="font-mono font-semibold text-green-700 dark:text-green-400">
                                {annualData.paidIdRamq}
                              </span>
                            </div>
                            {annualData.paidDate && (
                              <div className="flex justify-between text-sm mt-1">
                                <span className="text-gray-600 dark:text-gray-400">Date:</span>
                                <span className="font-semibold">{annualData.paidDate}</span>
                              </div>
                            )}
                            {annualData.paidAmount !== undefined && (
                              <div className="flex justify-between text-sm mt-1">
                                <span className="text-gray-600 dark:text-gray-400">Montant:</span>
                                <span className="font-semibold">{formatCurrency(annualData.paidAmount)}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Unpaid invoices */}
                        <div>
                          <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            Factures non payées ({annualData.unpaidIdRamqs.length}):
                          </div>
                          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-2 space-y-2">
                            {annualData.unpaidIdRamqs.map((idRamq, index) => (
                              <div key={idRamq} className="flex justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">ID RAMQ:</span>
                                <span className="font-mono font-semibold text-red-700 dark:text-red-400">
                                  {idRamq}
                                  {annualData.unpaidDates && annualData.unpaidDates[index] && (
                                    <span className="ml-2 text-gray-600 dark:text-gray-400 font-normal">
                                      ({annualData.unpaidDates[index]})
                                    </span>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* E3 Scenario - Show tariff value and total unpaid amount */}
                    {annualData.tariffValue !== undefined && annualData.totalUnpaidAmount !== undefined && (
                      <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Valeur tarifaire:</span>
                          <span className="font-semibold">{formatCurrency(annualData.tariffValue)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Montant total non payé:</span>
                          <span className="font-semibold">{formatCurrency(annualData.totalUnpaidAmount)}</span>
                        </div>
                      </div>
                    )}

                    {/* E1 Scenario - Show total paid amount */}
                    {annualData.totalPaidAmount !== undefined && !annualData.paidIdRamq && (
                      <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Montant total payé:</span>
                          <span className="font-semibold">{formatCurrency(annualData.totalPaidAmount)}</span>
                        </div>
                      </div>
                    )}

                    {/* Show billing dates if available */}
                    {annualData.dates && annualData.dates.length > 0 && (
                      <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Dates de facturation:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {annualData.dates.map((date, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {date}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Office Fee E5 Error - Daily Maximum with Multi-Patient Breakdown */}
          {isOfficeFeeE5Error(result.ruleData) && result.ruleData.feeBreakdownWithPatients && (
            <>
              <OfficeFeeBreakdownBox
                feeBreakdownWithPatients={result.ruleData.feeBreakdownWithPatients}
                totalAmount={result.ruleData.totalAmount || "0,00"}
                maximum={result.ruleData.maximum || "64,80"}
                overage={result.ruleData.overage || "0,00"}
                patientCount={result.ruleData.patientCount || 0}
                likelyDataError={result.ruleData.likelyDataError || false}
              />

              {/* Visit Statistics Grid - Show if visit counts are available */}
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

          {/* Office Fee Rule - Billing Details & Visit Statistics (E1-E4, O1-O6, P1-P11) */}
          {isOfficeFeeRule(result.ruleData) && !isOfficeFeeE5Error(result.ruleData) && (() => {
            const officeData = result.ruleData as OfficeFeeRuleData;
            return (
              <>
                {/* Only show billing details if we have billing info */}
                {(officeData.code || officeData.billedAmount || officeData.billedCode) && (
                  <BillingDetailsBox
                    code={officeData.code || "N/A"}
                    amount={officeData.billedAmount || "N/A"}
                    type={officeData.billedCode || "N/A"}
                    hasContext={officeData.hasContext}
                  />
                )}

                {/* Visit Statistics - Always show for office fee scenarios */}
                {hasVisitStatistics(officeData) && (
                  <VisitStatisticsGrid
                    registeredPaid={officeData.registeredPaidCount || 0}
                    registeredUnpaid={officeData.registeredUnpaidCount || 0}
                    walkinPaid={officeData.walkInPaidCount || 0}
                    walkinUnpaid={officeData.walkInUnpaidCount || 0}
                  />
                )}
              </>
            );
          })()}

          {/* GMF Forfait Rule - Patient and Visit Information */}
          {isGmfForfaitRule(result.ruleData) && (
            <Card className="bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700">
              <CardContent className="pt-4">
                <div className="space-y-2 text-sm">
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
          {!isOfficeFeeRule(result.ruleData) && !isGmfForfaitRule(result.ruleData) && !isAnnualLimitRule(result.ruleData) && (
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
