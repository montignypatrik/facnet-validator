import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader, FileText, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { useSmartProgress } from "@/hooks/useSmartProgress";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import client from "@/api/client";

interface ValidationProgressProps {
  validationId: string;
  realProgress?: number;
  status: string;
}

interface JobStatusData {
  queuePosition?: number;
  estimatedTimeRemaining?: number;
  jobState?: string;
  error?: {
    code: string;
    message: string;
  };
  attemptsMade?: number;
  maxAttempts?: number;
}

// French phase messages
const PHASE_MESSAGES = {
  initializing: "Initialisation de la validation...",
  processing: "Analyse des enregistrements de facturation...",
  finalizing: "Finalisation des résultats...",
  complete: "Validation terminée",
};

// Phase-specific icons with animations
const PHASE_ICONS = {
  initializing: Clock,
  processing: Loader,
  finalizing: FileText,
  complete: CheckCircle,
};

/**
 * ValidationProgress Component
 *
 * Displays a professional, animated progress experience for validation runs.
 * Uses the useSmartProgress hook to ensure smooth progression with a minimum
 * 5-second display time for quality perception.
 *
 * Features:
 * - Smooth animated progress bar
 * - Phase-specific messages and icons
 * - Automatic blending of artificial and real progress
 * - Queue position and ETA display when queued
 * - Retry attempts indicator
 * - Professional, polished appearance
 */
export function ValidationProgress({ validationId, realProgress = 0, status }: ValidationProgressProps) {
  const { displayProgress, isMinimumTimeMet, phase } = useSmartProgress({
    realProgress,
    status,
  });

  // Fetch job status for queue position, ETA, and retry info
  const { data: jobStatus } = useQuery<JobStatusData>({
    queryKey: [`/validations/${validationId}/job-status`],
    queryFn: async () => {
      const response = await client.get(`/validations/${validationId}/job-status`);
      return response.data;
    },
    refetchInterval: 3000,
    enabled: status === 'queued' || status === 'processing',
  });

  // Don't show progress component if validation is completed or failed
  if (status !== 'queued' && status !== 'processing') {
    return null;
  }

  const PhaseIcon = PHASE_ICONS[phase];
  const phaseMessage = PHASE_MESSAGES[phase];

  // Check if job is retrying
  const isRetrying = jobStatus?.error && jobStatus.error.code === 'WORKER_ERROR' && jobStatus.attemptsMade && jobStatus.attemptsMade > 1;

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader>
        <CardTitle className="flex items-center">
          <PhaseIcon className={cn(
            "w-5 h-5 mr-2",
            phase === 'processing' && "animate-spin",
            "text-blue-600"
          )} />
          Statut du traitement
        </CardTitle>
      </CardHeader>
      <CardContent>
        {status === 'queued' ? (
          <div className="space-y-4">
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                Votre exécution de validation est en file d'attente et commencera le traitement sous peu.
              </AlertDescription>
            </Alert>

            {/* Queue Position Display */}
            {jobStatus?.queuePosition !== undefined && (
              <div className="text-center text-sm text-muted-foreground">
                Position {jobStatus.queuePosition} dans la file d'attente
              </div>
            )}

            {/* ETA Display */}
            {jobStatus?.estimatedTimeRemaining !== undefined && jobStatus.estimatedTimeRemaining > 0 && (
              <div className="text-center text-sm text-muted-foreground">
                Temps estimé: {Math.ceil(jobStatus.estimatedTimeRemaining / 60000)} {Math.ceil(jobStatus.estimatedTimeRemaining / 60000) === 1 ? 'minute' : 'minutes'}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Retry Information Alert */}
            {isRetrying && (
              <Alert className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">Tentative de récupération en cours...</p>
                    {jobStatus.attemptsMade && jobStatus.maxAttempts && (
                      <p className="text-sm">
                        Tentative {jobStatus.attemptsMade} sur {jobStatus.maxAttempts}
                      </p>
                    )}
                    {jobStatus.error?.message && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Problème détecté: {jobStatus.error.message}
                      </p>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Phase Message */}
            <div className="flex items-center space-x-3">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                "bg-blue-100 dark:bg-blue-900/20 transition-all duration-300"
              )}>
                <PhaseIcon className={cn(
                  "w-5 h-5 text-blue-600",
                  phase === 'processing' && "animate-spin"
                )} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  {phaseMessage}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {phase === 'initializing' && "Préparation de l'environnement de validation"}
                  {phase === 'processing' && "Validation des règles métier RAMQ"}
                  {phase === 'finalizing' && "Compilation des résultats de validation"}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Progression</span>
                <span className="text-sm text-muted-foreground">
                  {Math.round(displayProgress)}%
                </span>
              </div>
              <Progress
                value={displayProgress}
                className="h-3 transition-all duration-300 ease-out"
                aria-label="Progression de la validation"
                aria-valuenow={Math.round(displayProgress)}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>

            {/* Additional Context */}
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">
                <span className="inline-flex items-center">
                  <FileText className="w-3 h-3 mr-1" />
                  Validation ID: <code className="ml-1 px-1 py-0.5 bg-muted rounded text-xs">{validationId.slice(0, 8)}</code>
                </span>
              </p>
            </div>

            {/* Quality Assurance Message */}
            {!isMinimumTimeMet && !isRetrying && (
              <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                <AlertDescription className="text-xs text-blue-900 dark:text-blue-100">
                  Notre système effectue une validation complète et minutieuse de vos données de facturation RAMQ
                  pour garantir la conformité maximale.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
