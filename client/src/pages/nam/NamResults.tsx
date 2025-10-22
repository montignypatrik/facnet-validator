import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useAuth0 } from "@auth0/auth0-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  Loader2,
  Eye,
  EyeOff,
  ArrowLeft,
  Edit,
  Calendar,
  Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import client from "@/api/client";

interface NAMResult {
  id: string;
  nam: string;
  page: number;
  valid: boolean;
  validationError?: string;
  removedByUser: boolean;
  includedInSsv: boolean;

  // Visit date and time fields
  visitDate: string | null;
  visitTime: string | null;
  dateValid: boolean;
  timeValid: boolean;
  dateValidationError?: string;
  timeValidationError?: string;
  dateManuallyEdited: boolean;
  timeManuallyEdited: boolean;
}

interface NAMRun {
  id: string;
  fileName: string;
  status: "queued" | "running" | "completed" | "failed";
  stage?: "ocr" | "ai_extraction" | "validation";
  progress: string;
  pageCount?: number;
  namsFound?: number;
  namsValid?: number;
  errorMessage?: string;
  errorCode?: string;
  processingTimeMs?: number;
  createdAt: string;
}

export default function NamResultsPage() {
  const [, params] = useRoute("/nam/results/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getAccessTokenSilently } = useAuth0();
  const runId = params?.id || "";

  const [sseStatus, setSSEStatus] = useState<string>("connecting");
  const [liveProgress, setLiveProgress] = useState<number>(0);
  const [liveStage, setLiveStage] = useState<string | null>(null);

  // Edit state for date/time
  const [editingResultId, setEditingResultId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<string>("");
  const [editTime, setEditTime] = useState<string>("");

  const translations = {
    pageTitle: "Résultats d'Extraction NAM",
    backToUpload: "Retour au Téléchargement",
    extractionStatus: "Statut de l'Extraction",
    extractedNAMs: "NAMs Extraits",
    validNAMs: "NAMs Valides",
    invalidNAMs: "NAMs Invalides",
    pages: "Pages",
    processingTime: "Temps de Traitement",
    fileName: "Fichier",
    status: "Statut",
    progress: "Progression",
    stage: "Étape",
    ocr: "Extraction OCR",
    ai_extraction: "Extraction IA",
    validation: "Validation",
    queued: "En attente",
    running: "En cours",
    completed: "Terminé",
    failed: "Échec",
    namResults: "Résultats NAM",
    page: "Page",
    namNumber: "Numéro NAM",
    validationStatus: "Statut",
    actions: "Actions",
    valid: "Valide",
    invalid: "Invalide",
    toggleInclude: "Basculer l'inclusion",
    removed: "Retiré",
    included: "Inclus",
    downloadSSV: "Télécharger",
    includeInvalidNAMs: "Inclure les NAMs invalides",
    noNAMsFound: "Aucun NAM trouvé",
    extractionInProgress: "Extraction en cours...",
    extractionFailed: "Échec de l'extraction",
    error: "Erreur",
    downloadSuccess: "Téléchargement réussi",
    ssvGenerated: "Fichier SSV généré avec succès",
    downloadFailed: "Échec du téléchargement",
    visitDate: "Date de Visite",
    visitTime: "Heure de Visite",
    editDateTime: "Modifier Date/Heure",
    saveChanges: "Enregistrer",
    cancel: "Annuler",
    missingDate: "Date manquante",
    invalidDate: "Date invalide",
    invalidTime: "Heure invalide",
    editSuccess: "Date/Heure mise à jour avec succès",
    editFailed: "Échec de la mise à jour",
    invalidDatesWarning: "Certaines dates sont invalides ou manquantes",
  };

  // Fetch NAM run details
  const { data: run, isLoading: runLoading } = useQuery<NAMRun>({
    queryKey: ["nam-run", runId],
    queryFn: async () => {
      const response = await client.get(`/nam/runs/${runId}`);
      return response.data;
    },
    enabled: !!runId,
    refetchInterval: (data) => {
      // Refetch every 2 seconds if status is queued or running
      return data?.status === "queued" || data?.status === "running" ? 2000 : false;
    },
  });

  // Fetch NAM results
  const { data: resultsData, isLoading: resultsLoading } = useQuery<{ results: NAMResult[]; count: number }>({
    queryKey: ["nam-results", runId],
    queryFn: async () => {
      const response = await client.get(`/nam/runs/${runId}/results`);
      return response.data;
    },
    enabled: !!runId && run?.status === "completed",
  });

  // SSE for real-time updates
  useEffect(() => {
    if (!runId || run?.status === "completed" || run?.status === "failed") {
      return;
    }

    let eventSource: EventSource | null = null;

    const connectSSE = async () => {
      try {
        // Get Auth0 access token
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: import.meta.env.VITE_AUTH0_AUDIENCE || "facnet-validator-api",
            scope: "openid profile email offline_access"
          }
        });

        // EventSource doesn't support custom headers, so pass token in URL
        const url = `${import.meta.env.VITE_API_BASE_URL}/nam/runs/${runId}/stream?token=${token}`;
        eventSource = new EventSource(url);

        eventSource.onopen = () => {
          setSSEStatus("connected");
          console.log('[NAM SSE] Connected to extraction stream');
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === "progress") {
              setLiveProgress(data.progress);
              setLiveStage(data.stage);

              // Invalidate queries to refresh data
              queryClient.invalidateQueries({ queryKey: ["nam-run", runId] });
            } else if (data.type === "completed") {
              setSSEStatus("completed");

              // Refresh all queries
              queryClient.invalidateQueries({ queryKey: ["nam-run", runId] });
              queryClient.invalidateQueries({ queryKey: ["nam-results", runId] });

              if (eventSource) {
                eventSource.close();
              }
            }
          } catch (error) {
            console.error("[NAM SSE] Parsing error:", error);
          }
        };

        eventSource.onerror = (error) => {
          console.error("[NAM SSE] Connection error:", error);
          setSSEStatus("error");
          if (eventSource) {
            eventSource.close();
          }
        };
      } catch (error) {
        console.error("[NAM SSE] Failed to connect:", error);
        setSSEStatus("error");
      }
    };

    connectSSE();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [runId, run?.status, queryClient, getAccessTokenSilently]);

  // Toggle NAM inclusion mutation
  const toggleMutation = useMutation({
    mutationFn: async (resultId: string) => {
      await client.post(`/nam/runs/${runId}/results/${resultId}/toggle`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nam-results", runId] });
    },
  });

  // Edit date/time mutation
  const editDateTimeMutation = useMutation({
    mutationFn: async ({ resultId, visitDate, visitTime }: { resultId: string; visitDate?: string; visitTime?: string }) => {
      await client.patch(`/nam/runs/${runId}/results/${resultId}/edit-datetime`, {
        visitDate,
        visitTime,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nam-results", runId] });
      setEditingResultId(null);
      toast({
        title: translations.editSuccess,
      });
    },
    onError: () => {
      toast({
        title: translations.editFailed,
        variant: "destructive",
      });
    },
  });

  // Helper functions for editing
  const handleStartEdit = (result: NAMResult) => {
    setEditingResultId(result.id);
    setEditDate(result.visitDate || "");
    setEditTime(result.visitTime || "08:00");
  };

  const handleSaveEdit = (resultId: string) => {
    editDateTimeMutation.mutate({
      resultId,
      visitDate: editDate,
      visitTime: editTime,
    });
  };

  const handleCancelEdit = () => {
    setEditingResultId(null);
    setEditDate("");
    setEditTime("");
  };

  // Download SSV mutation
  const downloadMutation = useMutation({
    mutationFn: async (includeInvalid: boolean) => {
      const response = await client.post(
        "/nam/generate-ssv",
        { runId, includeInvalid },
        { responseType: "blob" }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `nam-extraction-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast({
        title: translations.downloadSuccess,
        description: translations.ssvGenerated,
      });
    },
    onError: (error: any) => {
      toast({
        title: translations.downloadFailed,
        description: error.response?.data?.error || translations.error,
        variant: "destructive",
      });
    },
  });

  const handleToggleInclude = (resultId: string) => {
    toggleMutation.mutate(resultId);
  };

  const handleDownloadSSV = (includeInvalid: boolean) => {
    downloadMutation.mutate(includeInvalid);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      queued: "secondary",
      running: "default",
      completed: "default",
      failed: "destructive",
    };

    const icons: Record<string, any> = {
      queued: Loader2,
      running: Loader2,
      completed: CheckCircle,
      failed: XCircle,
    };

    const Icon = icons[status] || AlertCircle;

    return (
      <Badge variant={variants[status] || "secondary"}>
        <Icon className={`w-3 h-3 mr-1 ${status === "running" || status === "queued" ? "animate-spin" : ""}`} />
        {translations[status as keyof typeof translations] || status}
      </Badge>
    );
  };

  const getStageBadge = (stage: string | null) => {
    if (!stage) return null;

    return (
      <Badge variant="outline">
        {translations[stage as keyof typeof translations] || stage}
      </Badge>
    );
  };

  const displayProgress = run?.status === "running" || run?.status === "queued"
    ? liveProgress || Number(run?.progress || 0)
    : Number(run?.progress || 0);

  const displayStage = run?.status === "running" ? (liveStage || run?.stage) : run?.stage;

  if (runLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Extraction non trouvée</AlertDescription>
        </Alert>
      </div>
    );
  }

  const validResults = resultsData?.results?.filter(r => r.valid && !r.removedByUser) || [];
  const invalidResults = resultsData?.results?.filter(r => !r.valid) || [];
  const invalidDatesResults = resultsData?.results?.filter(r => !r.dateValid || !r.visitDate) || [];
  const hasInvalidDates = invalidDatesResults.some(r => !r.removedByUser);
  const removedResults = resultsData?.results?.filter(r => r.removedByUser) || [];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Page Header */}
      <header className="bg-card border-b border-border p-6">
        <div className="flex items-center justify-between">
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/nam/upload")}
              className="mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {translations.backToUpload}
            </Button>
            <h1 className="text-2xl font-bold text-foreground">
              {translations.pageTitle}
            </h1>
            <p className="text-muted-foreground">{run.fileName}</p>
          </div>
          <div>
            {getStatusBadge(run.status)}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                {translations.extractionStatus}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">{translations.status}</p>
                  <div className="mt-1">{getStatusBadge(run.status)}</div>
                </div>
                {displayStage && (
                  <div>
                    <p className="text-sm text-muted-foreground">{translations.stage}</p>
                    <div className="mt-1">{getStageBadge(displayStage)}</div>
                  </div>
                )}
                {run.pageCount !== null && run.pageCount !== undefined && (
                  <div>
                    <p className="text-sm text-muted-foreground">{translations.pages}</p>
                    <p className="text-2xl font-bold">{run.pageCount}</p>
                  </div>
                )}
                {run.namsFound !== null && run.namsFound !== undefined && (
                  <div>
                    <p className="text-sm text-muted-foreground">{translations.extractedNAMs}</p>
                    <p className="text-2xl font-bold">{run.namsFound}</p>
                  </div>
                )}
              </div>

              {(run.status === "running" || run.status === "queued") && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{translations.progress}</span>
                    <span>{displayProgress}%</span>
                  </div>
                  <Progress value={displayProgress} />
                </div>
              )}

              {run.status === "failed" && run.errorMessage && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{run.errorMessage}</AlertDescription>
                </Alert>
              )}

              {run.status === "completed" && run.processingTimeMs && (
                <p className="text-sm text-muted-foreground mt-4">
                  {translations.processingTime}: {(run.processingTimeMs / 1000).toFixed(2)}s
                </p>
              )}
            </CardContent>
          </Card>

          {/* Results */}
          {run.status === "completed" && resultsData && (
            <>
              {/* Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{translations.validNAMs}</p>
                        <p className="text-3xl font-bold text-green-600">{validResults.length}</p>
                      </div>
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{translations.invalidNAMs}</p>
                        <p className="text-3xl font-bold text-orange-600">{invalidResults.length}</p>
                      </div>
                      <XCircle className="w-8 h-8 text-orange-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card className={hasInvalidDates ? "border-orange-400" : ""}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Dates Invalides</p>
                        <p className={`text-3xl font-bold ${hasInvalidDates ? "text-orange-600" : "text-gray-600"}`}>
                          {invalidDatesResults.filter(r => !r.removedByUser).length}
                        </p>
                      </div>
                      <Calendar className={`w-8 h-8 ${hasInvalidDates ? "text-orange-600" : "text-gray-600"}`} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{translations.removed}</p>
                        <p className="text-3xl font-bold text-gray-600">{removedResults.length}</p>
                      </div>
                      <EyeOff className="w-8 h-8 text-gray-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Warning for invalid dates */}
              {hasInvalidDates && (
                <Alert className="bg-orange-50 border-orange-200">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-800">
                    {translations.invalidDatesWarning}. Veuillez corriger les dates avant de télécharger le fichier SSV.
                  </AlertDescription>
                </Alert>
              )}

              {/* Download Button */}
              {validResults.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleDownloadSSV(false)}
                      disabled={downloadMutation.isPending || hasInvalidDates}
                      title={hasInvalidDates ? "Veuillez corriger les dates invalides avant de télécharger" : ""}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {translations.downloadSSV}
                    </Button>
                    {invalidResults.length > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => handleDownloadSSV(true)}
                        disabled={downloadMutation.isPending || hasInvalidDates}
                        title={hasInvalidDates ? "Veuillez corriger les dates invalides avant de télécharger" : ""}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        {translations.includeInvalidNAMs}
                      </Button>
                    )}
                  </div>
                  {hasInvalidDates && (
                    <p className="text-sm text-orange-600">
                      ⚠️ Export désactivé : Toutes les dates doivent être valides
                    </p>
                  )}
                </div>
              )}

              {/* NAM Results Table */}
              <Card>
                <CardHeader>
                  <CardTitle>{translations.namResults}</CardTitle>
                </CardHeader>
                <CardContent>
                  {resultsData.results.length === 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{translations.noNAMsFound}</AlertDescription>
                    </Alert>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-4">{translations.page}</th>
                            <th className="text-left py-3 px-4">{translations.namNumber}</th>
                            <th className="text-left py-3 px-4">{translations.visitDate}</th>
                            <th className="text-left py-3 px-4">{translations.visitTime}</th>
                            <th className="text-left py-3 px-4">{translations.validationStatus}</th>
                            <th className="text-left py-3 px-4">{translations.actions}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resultsData.results.map((result) => (
                            <tr key={result.id} className="border-b hover:bg-muted/50">
                              <td className="py-3 px-4">{result.page}</td>
                              <td className="py-3 px-4 font-mono">{result.nam}</td>

                              {/* Visit Date Cell */}
                              <td className="py-3 px-4">
                                {editingResultId === result.id ? (
                                  <input
                                    type="date"
                                    value={editDate}
                                    onChange={(e) => setEditDate(e.target.value)}
                                    className="border rounded px-2 py-1 w-full"
                                  />
                                ) : (
                                  <div className="flex items-center gap-2">
                                    {result.visitDate ? (
                                      <span className={!result.dateValid ? "text-red-500" : ""}>
                                        {result.visitDate}
                                      </span>
                                    ) : (
                                      <Badge variant="destructive" className="text-xs">
                                        <Calendar className="w-3 h-3 mr-1" />
                                        {translations.missingDate}
                                      </Badge>
                                    )}
                                    {!result.dateValid && result.dateValidationError && (
                                      <span className="text-xs text-red-500">({result.dateValidationError})</span>
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* Visit Time Cell */}
                              <td className="py-3 px-4">
                                {editingResultId === result.id ? (
                                  <input
                                    type="time"
                                    value={editTime}
                                    onChange={(e) => setEditTime(e.target.value)}
                                    className="border rounded px-2 py-1 w-full"
                                  />
                                ) : (
                                  <div className="flex items-center gap-2">
                                    {result.visitTime ? (
                                      <span className={!result.timeValid ? "text-red-500" : ""}>
                                        {result.visitTime}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400">--:--</span>
                                    )}
                                    {!result.timeValid && result.timeValidationError && (
                                      <span className="text-xs text-red-500">({result.timeValidationError})</span>
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* Validation Status Cell */}
                              <td className="py-3 px-4">
                                <div className="flex flex-col gap-1">
                                  {result.valid ? (
                                    <Badge variant="default" className="bg-green-600 w-fit">
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      {translations.valid}
                                    </Badge>
                                  ) : (
                                    <Badge variant="destructive" className="w-fit">
                                      <XCircle className="w-3 h-3 mr-1" />
                                      {result.validationError || translations.invalid}
                                    </Badge>
                                  )}
                                  {!result.dateValid && (
                                    <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300 w-fit text-xs">
                                      <AlertCircle className="w-3 h-3 mr-1" />
                                      {translations.invalidDate}
                                    </Badge>
                                  )}
                                </div>
                              </td>

                              {/* Actions Cell */}
                              <td className="py-3 px-4">
                                <div className="flex gap-2">
                                  {editingResultId === result.id ? (
                                    <>
                                      <Button
                                        variant="default"
                                        size="sm"
                                        onClick={() => handleSaveEdit(result.id)}
                                        disabled={editDateTimeMutation.isPending}
                                      >
                                        <CheckCircle className="w-4 h-4 mr-1" />
                                        {translations.saveChanges}
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleCancelEdit}
                                        disabled={editDateTimeMutation.isPending}
                                      >
                                        {translations.cancel}
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleStartEdit(result)}
                                      >
                                        <Edit className="w-4 h-4 mr-1" />
                                        {translations.editDateTime}
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleToggleInclude(result.id)}
                                        disabled={toggleMutation.isPending}
                                      >
                                        {result.removedByUser ? (
                                          <>
                                            <Eye className="w-4 h-4 mr-1" />
                                            {translations.included}
                                          </>
                                        ) : (
                                          <>
                                            <EyeOff className="w-4 h-4 mr-1" />
                                            {translations.removed}
                                          </>
                                        )}
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
