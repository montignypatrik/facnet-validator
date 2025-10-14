import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import client from "@/api/client";

interface ValidationPreviewProps {
  validationId: string;
  enabled: boolean;
}

interface PreviewIssue {
  message: string;
  billingRecordId?: string;
  severity: "error" | "warning" | "info";
}

interface PreviewData {
  issues: PreviewIssue[];
}

/**
 * ValidationPreview Component
 *
 * Displays a live preview of the first 10 detected issues during validation processing.
 * Updates every 3 seconds while the validation is in progress.
 *
 * Features:
 * - Real-time issue preview
 * - Severity-based styling
 * - Billing record ID display
 * - Responsive design
 * - French language UI
 * - Accessibility compliant
 */
export function ValidationPreview({ validationId, enabled }: ValidationPreviewProps) {
  const { data } = useQuery<PreviewData>({
    queryKey: [`/validations/${validationId}/preview`],
    queryFn: async () => {
      const response = await client.get(`/validations/${validationId}/preview`);
      return response.data;
    },
    enabled,
    refetchInterval: 3000, // Refresh every 3 seconds while processing
  });

  if (!data?.issues || data.issues.length === 0) {
    return null;
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "error":
        return "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800";
      case "warning":
        return "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800";
      case "info":
        return "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800";
      default:
        return "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800";
    }
  };

  const getSeverityBadgeVariant = (severity: string): "destructive" | "default" | "secondary" => {
    switch (severity) {
      case "error":
        return "destructive";
      case "warning":
        return "default";
      case "info":
        return "secondary";
      default:
        return "default";
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case "error":
        return "Erreur";
      case "warning":
        return "Avertissement";
      case "info":
        return "Info";
      default:
        return severity;
    }
  };

  return (
    <div className="space-y-4" data-testid="validation-preview">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium" id="preview-title">
          Aperçu des problèmes détectés
        </h3>
        <Badge variant="secondary" data-testid="preview-count">
          {data.issues.length} problème{data.issues.length > 1 ? 's' : ''} trouvé{data.issues.length > 1 ? 's' : ''}
        </Badge>
      </div>

      <Alert className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Affichage des premiers problèmes détectés. Le rapport complet sera disponible après le traitement.
        </AlertDescription>
      </Alert>

      <div className="space-y-2" role="list" aria-labelledby="preview-title">
        {data.issues.map((issue: PreviewIssue, index: number) => (
          <div
            key={index}
            className={`p-3 border rounded-lg ${getSeverityColor(issue.severity)}`}
            role="listitem"
            data-testid={`preview-issue-${index}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="font-medium text-sm">{issue.message}</p>
                {issue.billingRecordId && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Facturation ID: <code className="px-1 py-0.5 bg-muted rounded">{issue.billingRecordId}</code>
                  </p>
                )}
              </div>
              <Badge
                variant={getSeverityBadgeVariant(issue.severity)}
                className="ml-2"
                aria-label={`Sévérité: ${getSeverityLabel(issue.severity)}`}
              >
                {getSeverityLabel(issue.severity)}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
