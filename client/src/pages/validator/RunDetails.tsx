import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  AlertCircle,
  Shield,
  Info,
  X
} from "lucide-react";
import client from "@/api/client";
import { ValidationResultCard } from "@/components/validation/ValidationResultCard";
import { ValidationProgress } from "@/components/ValidationProgress";
import { ValidationPreview } from "@/components/ValidationPreview";
import { useValidationStream } from "@/hooks/useValidationStream";
import { useToast } from "@/hooks/use-toast";
import { useSmartProgress } from "@/hooks/useSmartProgress";

// French error messages by category
const ERROR_MESSAGES: Record<string, string> = {
  FILE_FORMAT: "Erreur de format de fichier - Le fichier CSV ne respecte pas le format attendu",
  PARSING: "Erreur d'analyse - Impossible de lire les données du fichier",
  VALIDATION: "Erreur de validation - Les données ne respectent pas les règles métier RAMQ",
  SYSTEM: "Erreur système - Une erreur technique s'est produite",
  TIMEOUT: "Délai dépassé - Le traitement a pris trop de temps",
  MEMORY: "Erreur de mémoire - Le fichier est trop volumineux pour être traité",
  DEFAULT: "Une erreur s'est produite lors de la validation",
};

export default function RunDetailsPage() {
  const [, params] = useRoute("/validator/runs/:id");
  const runId = params?.id;
  const { toast } = useToast();

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

  // SSE for real-time updates
  const { data: streamData, isConnected } = useValidationStream(
    runId || '',
    run?.status === 'queued' || run?.status === 'processing'
  );

  // Get progress animation state
  const { isMinimumTimeMet } = useSmartProgress({
    realProgress: streamData?.progress || getProgressPercentage(),
    status: run?.status || 'queued',
  });

  // Refetch when SSE indicates completion
  useEffect(() => {
    if (streamData?.type === 'completed') {
      refetch();
    }
  }, [streamData, refetch]);

  const { data: validationResults } = useQuery({
    queryKey: [`/validations/${runId}/results`],
    queryFn: async () => {
      const response = await client.get(`/validations/${runId}/results`);
      return response.data;
    },
    enabled: !!runId && run?.status === "completed",
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      await client.post(`/validations/${runId}/cancel`);
    },
    onSuccess: () => {
      toast({
        title: "Validation annulée",
        description: "La validation a été annulée avec succès",
      });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.response?.data?.error || "Impossible d'annuler la validation",
        variant: "destructive",
      });
    },
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

  // Get user-friendly error message based on error code
  const getErrorMessage = (errorCode?: string) => {
    if (!errorCode) return ERROR_MESSAGES.DEFAULT;

    // Extract category from error code (e.g., "FILE_FORMAT_001" -> "FILE_FORMAT")
    const category = errorCode.split('_').slice(0, -1).join('_');
    return ERROR_MESSAGES[category] || ERROR_MESSAGES.DEFAULT;
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
              <h3 className="text-lg font-medium text-foreground mb-2">Validation introuvable</h3>
              <p className="text-muted-foreground">
                La validation que vous recherchez n'existe pas ou a été supprimée.
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
                  Validation commencée {new Date(run.createdAt).toLocaleString('fr-CA')}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {getStatusBadge(run.status)}
            {/* SSE Connection Indicator */}
            {isConnected && (
              <Badge variant="outline" className="text-xs">
                <div className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
                Mise à jour en temps réel
              </Badge>
            )}
            {/* Cancel Button */}
            {(run.status === "queued" || run.status === "processing") && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                data-testid="button-cancel"
                aria-label="Annuler la validation"
              >
                <X className="w-4 h-4 mr-2" />
                Annuler
              </Button>
            )}
            <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh">
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
            {run.status === "completed" && (
              <Button data-testid="button-download">
                <Download className="w-4 h-4 mr-2" />
                Télécharger les résultats
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Run Details Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Progress Section - Using ValidationProgress Component */}
          {/* Always render ValidationProgress for active/recent validations - it controls its own visibility */}
          <ValidationProgress
            validationId={runId || ""}
            realProgress={streamData?.progress || getProgressPercentage()}
            status={run.status}
          />
          {/* Live Preview Component */}
          {run.status === "processing" && (
            <ValidationPreview
              validationId={runId || ""}
              enabled={run.status === "processing"}
            />
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
                    <p className="text-sm text-muted-foreground">Lignes totales</p>
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
                    <p className="text-sm text-muted-foreground">Traitées</p>
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
                    <p className="text-sm text-muted-foreground">Erreurs</p>
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
                    <p className="text-sm text-muted-foreground">Taux de réussite</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Results */}
          {run.status === "completed" && isMinimumTimeMet && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Résumé de validation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                      <div className="flex items-center">
                        <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
                        <span className="font-medium">Enregistrements valides</span>
                      </div>
                      <span className="font-bold text-green-600">
                        {((run.totalRows || 0) - (run.errorCount || 0)).toLocaleString()}
                      </span>
                    </div>

                    {run.errorCount > 0 && (
                      <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                        <div className="flex items-center">
                          <XCircle className="w-5 h-5 text-red-600 mr-3" />
                          <span className="font-medium">Enregistrements invalides</span>
                        </div>
                        <span className="font-bold text-red-600">
                          {run.errorCount.toLocaleString()}
                        </span>
                      </div>
                    )}

                    <div className="pt-4">
                      <h4 className="font-medium mb-2">Temps de traitement</h4>
                      <p className="text-sm text-muted-foreground">
                        Début: {new Date(run.createdAt).toLocaleString('fr-CA')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Fin: {new Date(run.updatedAt).toLocaleString('fr-CA')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Métriques de qualité des données</CardTitle>
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
                      <p className="text-muted-foreground">Score global de qualité des données</p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm">Complétude</span>
                        <span className="text-sm font-medium">95%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Exactitude</span>
                        <span className="text-sm font-medium">98%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Cohérence</span>
                        <span className="text-sm font-medium">92%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* PHI Redaction Info Banner */}
          {run.status === "completed" && isMinimumTimeMet && validationResults && validationResults.length > 0 && (
            <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
              <Shield className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-900 dark:text-blue-100">
                <strong>Note de confidentialité:</strong> Les identifiants des patients et les informations des médecins sont masqués pour la conformité à la vie privée.
                Les identifiants de facturation RAMQ sont visibles car nécessaires pour les corrections. Les administrateurs peuvent ajuster la visibilité PHI dans les paramètres.
              </AlertDescription>
            </Alert>
          )}

          {/* Validation Results Details */}
          {run.status === "completed" && isMinimumTimeMet && validationResults && validationResults.length > 0 && (() => {
            // Separate errors, optimizations, and informational messages
            const errors = validationResults.filter((r: any) => r.severity === "error");
            const optimizations = validationResults.filter((r: any) => r.severity === "optimization");
            const infos = validationResults.filter((r: any) => r.severity === "info");

            // Calculate total monetary impact
            const totalImpact = validationResults.reduce((sum: number, result: any) => {
              return sum + (result.monetaryImpact || 0);
            }, 0);

            // Calculate impact by category
            const impactByCategory = validationResults.reduce((acc: Record<string, number>, result: any) => {
              const category = result.category || 'other';
              acc[category] = (acc[category] || 0) + (result.monetaryImpact || 0);
              return acc;
            }, {});

            return (
              <>
                {/* Financial Impact Summary Card */}
                {totalImpact > 0 && (
                  <Card className="border-l-4 border-l-green-500">
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mr-3">
                          <span className="text-2xl">💰</span>
                        </div>
                        <div>
                          <div className="text-lg">Impact financier potentiel</div>
                          <div className="text-sm text-muted-foreground">
                            Gain possible si tous les problèmes sont corrigés
                          </div>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Total Potential Gain */}
                        <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-6 text-center">
                          <div className="text-sm text-muted-foreground mb-1">Gain total potentiel</div>
                          <div className="text-4xl font-bold text-green-600 dark:text-green-400">
                            ${totalImpact.toFixed(2)}
                          </div>
                        </div>

                        {/* Breakdown by Category */}
                        <div>
                          <h4 className="text-sm font-semibold mb-3">Répartition par catégorie:</h4>
                          <div className="space-y-2">
                            {Object.entries(impactByCategory).map(([category, amount]: [string, any]) => (
                              <div key={category} className="flex justify-between items-center p-2 bg-muted rounded">
                                <span className="text-sm capitalize">
                                  {category === 'office_fees' ? 'Frais de cabinet' : category}
                                </span>
                                <span className="font-semibold text-green-600 dark:text-green-400">
                                  ${Number(amount).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Errors Section */}
                {errors.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center">
                          <AlertTriangle className="w-5 h-5 mr-2 text-amber-600" />
                          Issues détectées ({errors.length})
                        </div>
                        <Button variant="outline" size="sm">
                          <Download className="w-4 h-4 mr-2" />
                          Exporter la liste
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {errors.map((result: any) => (
                          <ValidationResultCard key={result.id} result={result} showDetails={false} />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Revenue Optimization Opportunities Section */}
                {optimizations.length > 0 && (
                  <Card className="mt-6 border-l-4 border-l-amber-500">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Info className="w-5 h-5 mr-2 text-amber-600" />
                          Opportunités d'optimisation ({optimizations.length})
                        </div>
                        <Button variant="outline" size="sm">
                          <Download className="w-4 h-4 mr-2" />
                          Exporter la liste
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {optimizations.map((result: any) => (
                          <ValidationResultCard key={result.id} result={result} showDetails={false} />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Informational Messages Section */}
                {infos.length > 0 && (
                  <Card className="mt-6">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center">
                          <CheckCircle className="w-5 h-5 mr-2 text-blue-600" />
                          Validations correctes ({infos.length})
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {infos.map((result: any) => (
                          <ValidationResultCard key={result.id} result={result} showDetails={false} />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )
          })()}

          {/* No Issues Found */}
          {run.status === "completed" && isMinimumTimeMet && (!validationResults || validationResults.length === 0) && (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-600" />
                <h3 className="text-lg font-medium text-foreground mb-2">Aucun problème de validation trouvé</h3>
                <p className="text-muted-foreground">
                  Tous les enregistrements de facturation ont été validés avec succès. Vos données répondent à toutes les règles métier et normes de formatage requises.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Error Details */}
          {run.status === "failed" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-red-600">Échec de la validation</CardTitle>
              </CardHeader>
              <CardContent>
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    {getErrorMessage(run.errorCode)}
                    {run.errorMessage && (
                      <>
                        <br /><br />
                        <strong>Détails de l'erreur:</strong> {run.errorMessage}
                      </>
                    )}
                    {!run.errorMessage && (
                      <>
                        <br />
                        Veuillez vérifier le format de votre fichier et réessayer.
                      </>
                    )}
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
