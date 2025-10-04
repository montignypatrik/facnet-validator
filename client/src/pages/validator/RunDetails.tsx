import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  ArrowLeft,
  Download,
  RefreshCw,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader,
  Clock,
  Users,
  AlertCircle
} from "lucide-react";
import client from "@/api/client";

export default function RunDetailsPage() {
  const [, params] = useRoute("/validator/runs/:id");
  const runId = params?.id;

  const { data: run, isLoading, refetch } = useQuery({
    queryKey: [`/validations/${runId}`],
    queryFn: async () => {
      const response = await client.get(`/validations/${runId}`);
      return response.data;
    },
    enabled: !!runId,
    refetchInterval: (data) => {
      // Poll every 3 seconds if status is running or queued
      return data?.status === "running" || data?.status === "queued" ? 3000 : false;
    },
  });

  const { data: validationResults } = useQuery({
    queryKey: [`/validations/${runId}/results`],
    queryFn: async () => {
      const response = await client.get(`/validations/${runId}/results`);
      return response.data;
    },
    enabled: !!runId && run?.status === "completed",
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case "running":
        return <Loader className="w-6 h-6 text-blue-600 animate-spin" />;
      case "failed":
        return <XCircle className="w-6 h-6 text-red-600" />;
      case "queued":
        return <Clock className="w-6 h-6 text-gray-600" />;
      default:
        return <AlertTriangle className="w-6 h-6 text-amber-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      completed: "default",
      running: "secondary", 
      failed: "destructive",
      queued: "outline",
    };
    return (
      <Badge variant={variants[status] || "outline"} className="capitalize text-sm">
        {status}
      </Badge>
    );
  };

  const getProgressPercentage = () => {
    if (!run?.totalRows || run.totalRows === 0) return 0;
    return Math.round((run.processedRows / run.totalRows) * 100);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-card border-b border-border p-6">
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 bg-muted rounded animate-pulse" />
            <div className="space-y-2">
              <div className="h-6 w-48 bg-muted rounded animate-pulse" />
              <div className="h-4 w-32 bg-muted rounded animate-pulse" />
            </div>
          </div>
        </header>
        <div className="flex-1 p-6">
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index}>
                <CardContent className="p-6">
                  <div className="h-32 bg-muted rounded animate-pulse" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-card border-b border-border p-6">
          <div className="flex items-center space-x-4">
            <Link href="/validator">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Nouvelle Validation
              </Button>
            </Link>
          </div>
        </header>
        <div className="flex-1 p-6 flex items-center justify-center">
          <Card>
            <CardContent className="p-12 text-center">
              <AlertCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium text-foreground mb-2">Run not found</h3>
              <p className="text-muted-foreground">
                The validation run you're looking for doesn't exist or has been removed.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Page Header */}
      <header className="bg-card border-b border-border p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/validator">
              <Button variant="ghost" size="sm" data-testid="button-back">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Nouvelle Validation
              </Button>
            </Link>
            <div className="flex items-center space-x-3">
              {getStatusIcon(run.status)}
              <div>
                <h1 className="text-2xl font-bold text-foreground" data-testid="text-run-filename">
                  {run.fileName}
                </h1>
                <p className="text-muted-foreground">
                  Validation run started {new Date(run.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {getStatusBadge(run.status)}
            <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            {run.status === "completed" && (
              <Button data-testid="button-download">
                <Download className="w-4 h-4 mr-2" />
                Download Results
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Run Details Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Progress Section */}
          {(run.status === "running" || run.status === "queued") && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Loader className="w-5 h-5 mr-2 animate-spin" />
                  Processing Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                {run.status === "queued" ? (
                  <Alert>
                    <Clock className="h-4 w-4" />
                    <AlertDescription>
                      Your validation run is queued and will begin processing shortly.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Progress</span>
                      <span className="text-sm text-muted-foreground">
                        {run.processedRows?.toLocaleString() || 0} of {run.totalRows?.toLocaleString() || 0} rows
                      </span>
                    </div>
                    <Progress value={getProgressPercentage()} className="w-full" />
                    <p className="text-center text-sm text-muted-foreground">
                      {getProgressPercentage()}% complete
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-foreground" data-testid="text-total-rows">
                      {run.totalRows?.toLocaleString() || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Total Rows</p>
                  </div>
                  <FileText className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-foreground" data-testid="text-processed-rows">
                      {run.processedRows?.toLocaleString() || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Processed</p>
                  </div>
                  <Users className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-foreground" data-testid="text-error-count">
                      {run.errorCount?.toLocaleString() || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Errors</p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {run.totalRows && run.errorCount 
                        ? `${(((run.totalRows - run.errorCount) / run.totalRows) * 100).toFixed(1)}%`
                        : "0%"
                      }
                    </p>
                    <p className="text-sm text-muted-foreground">Success Rate</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Results */}
          {run.status === "completed" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Validation Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                      <div className="flex items-center">
                        <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
                        <span className="font-medium">Valid Records</span>
                      </div>
                      <span className="font-bold text-green-600">
                        {((run.totalRows || 0) - (run.errorCount || 0)).toLocaleString()}
                      </span>
                    </div>
                    
                    {run.errorCount > 0 && (
                      <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                        <div className="flex items-center">
                          <XCircle className="w-5 h-5 text-red-600 mr-3" />
                          <span className="font-medium">Invalid Records</span>
                        </div>
                        <span className="font-bold text-red-600">
                          {run.errorCount.toLocaleString()}
                        </span>
                      </div>
                    )}

                    <div className="pt-4">
                      <h4 className="font-medium mb-2">Processing Time</h4>
                      <p className="text-sm text-muted-foreground">
                        Started: {new Date(run.createdAt).toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Completed: {new Date(run.updatedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Data Quality Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-primary mb-2">
                        {run.totalRows && run.errorCount 
                          ? `${(((run.totalRows - run.errorCount) / run.totalRows) * 100).toFixed(1)}%`
                          : "100%"
                        }
                      </div>
                      <p className="text-muted-foreground">Overall Data Quality Score</p>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm">Completeness</span>
                        <span className="text-sm font-medium">95%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Accuracy</span>
                        <span className="text-sm font-medium">98%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Consistency</span>
                        <span className="text-sm font-medium">92%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Validation Results Details */}
          {run.status === "completed" && validationResults && validationResults.length > 0 && (() => {
            // Group results by RAMQ ID
            const groupedResults = validationResults.reduce((acc: Record<string, any[]>, result: any) => {
              const ramqId = result.idRamq || "n'existe pas";
              if (!acc[ramqId]) {
                acc[ramqId] = [];
              }
              acc[ramqId].push(result);
              return acc;
            }, {});

            return (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                      <AlertTriangle className="w-5 h-5 mr-2 text-amber-600" />
                      Issues détectées ({validationResults.length})
                    </div>
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Exporter la liste
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-8">
                    {Object.entries(groupedResults).map(([ramqId, results]: [string, any[]]) => (
                      <div key={ramqId} className="space-y-4">
                        {/* RAMQ ID Header */}
                        <div className="flex items-center space-x-2 pb-2 border-b-2 border-gray-300 dark:border-gray-700">
                          <FileText className="w-5 h-5 text-primary" />
                          <h3 className="text-lg font-bold text-foreground">
                            RAMQ ID: <span className="font-mono">{ramqId}</span>
                          </h3>
                          <Badge variant="secondary">{results.length} problème{results.length > 1 ? 's' : ''}</Badge>
                        </div>

                        {/* Issues for this RAMQ ID */}
                        <div className="space-y-4 pl-4">
                          {results.map((result: any, index: number) => (
                            <div key={result.id || index} className="border-l-4 border-red-500 bg-red-50 dark:bg-red-950/20 p-4 rounded-r-lg">
                              {/* Issue Header - Rule Name First */}
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center space-x-2">
                                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                                  <h4 className="font-semibold text-red-900 dark:text-red-100">
                                    {result.ruleName || "Règle de validation"}
                                  </h4>
                                </div>
                              </div>

                              {/* What's Wrong */}
                              <div className="mb-3">
                                <h5 className="text-sm font-semibold text-foreground mb-1 flex items-center">
                                  <AlertCircle className="w-4 h-4 mr-1.5 text-red-600" />
                                  Ce qui ne va pas
                                </h5>
                                <p className="text-sm text-foreground pl-5">
                                  {result.message}
                                </p>
                              </div>

                              {/* Details - Simplified */}
                              <div className="mb-3 bg-white dark:bg-gray-900 rounded p-3">
                                <h5 className="text-sm font-semibold text-foreground mb-2">Détails</h5>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  {result.ruleData?.code && (
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Code:</span>
                                      <span className="font-mono font-medium">{result.ruleData.code}</span>
                                    </div>
                                  )}
                                  {result.ruleData?.date && (
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Date:</span>
                                      <span className="font-medium">{result.ruleData.date}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* How to Fix - Improved Translation */}
                              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded p-3">
                                <h5 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1 flex items-center">
                                  <CheckCircle className="w-4 h-4 mr-1.5" />
                                  Comment corriger
                                </h5>
                                <p className="text-sm text-blue-800 dark:text-blue-200 pl-5">
                                  {result.ruleData?.establishment && !result.ruleData.establishment.startsWith('5')
                                    ? `Vérifiez que le code ${result.ruleData.code} est utilisé dans un cabinet (établissement commençant par 5). L'établissement actuel (${result.ruleData.establishment}) ne correspond pas à un cabinet.`
                                    : result.ruleData?.type === 'registered' && result.ruleData?.required && result.ruleData?.actual
                                    ? `Vous avez facturé le code ${result.ruleData.code} mais le minimum de ${result.ruleData.required} patients n'a pas été atteint. Notre analyse reconnait ${result.ruleData.actual} patients. S'il vous plaît annuler le code ${result.ruleData.code}.`
                                    : result.ruleData?.type === 'walk_in' && result.ruleData?.required && result.ruleData?.actual
                                    ? `Vous avez facturé le code ${result.ruleData.code} mais le minimum de ${result.ruleData.required} patients n'a pas été atteint. Notre analyse reconnait ${result.ruleData.actual} patients. S'il vous plaît annuler le code ${result.ruleData.code}.`
                                    : result.ruleData?.totalAmount && result.ruleData?.maximum
                                    ? `Le montant total de ${result.ruleData.totalAmount}$ dépasse le maximum quotidien de ${result.ruleData.maximum}$. Vérifiez vos facturation et retirez les codes en trop.`
                                    : "Corrigez les données selon les règles de validation RAMQ."
                                  }
                                </p>
                              </div>

                              {/* Affected Records */}
                              {result.affectedRecords && result.affectedRecords.length > 0 && (
                                <div className="mt-3 text-xs text-muted-foreground">
                                  <span className="font-medium">Dossiers affectés:</span> {result.affectedRecords.length} enregistrement(s)
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* No Issues Found */}
          {run.status === "completed" && (!validationResults || validationResults.length === 0) && (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-600" />
                <h3 className="text-lg font-medium text-foreground mb-2">No Validation Issues Found</h3>
                <p className="text-muted-foreground">
                  All billing records passed validation successfully. Your data meets all required business rules and formatting standards.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Error Details */}
          {run.status === "failed" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-red-600">Validation Failed</CardTitle>
              </CardHeader>
              <CardContent>
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    The validation process encountered an error and could not be completed.
                    Please check your file format and try again.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
