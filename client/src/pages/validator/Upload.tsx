import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileDropzone } from "@/components/FileDropzone";
import { Upload, CheckCircle, AlertCircle, Eye, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import client from "@/api/client";

export default function UploadPage() {
  // French translations
  const translations = {
    pageTitle: "Télécharger et Valider",
    pageDescription: "Téléchargez vos fichiers CSV pour la validation et le traitement des données",
    fileUpload: "Téléchargement de Fichier",
    uploadAndValidate: "Télécharger et Valider",
    uploading: "Téléchargement en cours...",
    pleaseWait: "Veuillez patienter pendant que nous traitons vos fichiers",
    complete: "% terminé",
    uploadSuccessful: "Téléchargement Réussi !",
    fileUploaded: "Votre fichier a été téléchargé et la validation a commencé",
    batchUploaded: "validations créées avec succès",
    redirecting: "Redirection automatique vers la page de validation...",
    viewValidationRun: "Voir l'Exécution de Validation",
    viewValidations: "Voir les Validations",
    uploadGuidelines: "Directives de Téléchargement",
    followFormat: "Veuillez vous assurer que vos fichiers CSV suivent le format attendu pour des résultats de validation optimaux.",
    supportedFileTypes: "Types de Fichiers Supportés",
    csvFiles: "• Fichiers CSV (.csv)",
    utf8Encoding: "• Encodage UTF-8 recommandé",
    maxFileSize: "• Taille maximale du fichier : 50MB",
    fileFormatRequirements: "Exigences de Format de Fichier",
    headerRowRequired: "• Ligne d'en-tête requise",
    delimited: "• Délimité par virgule ou point-virgule",
    consistentStructure: "• Structure de colonnes cohérente",
    validationFeatures: "Fonctionnalités de Validation",
    dataTypeValidation: "• Validation des types de données",
    businessRuleEnforcement: "• Application des règles métier",
    duplicateDetection: "• Détection des doublons",
    formatConsistencyChecks: "• Vérifications de cohérence de format",
    afterUpload: "Après Téléchargement",
    realTimeProgress: "• Progression de validation en temps réel",
    detailedErrorReporting: "• Rapport d'erreurs détaillé",
    dataQualityMetrics: "• Métriques de qualité des données",
    exportValidatedData: "• Exporter les données validées",
    success: "Succès !",
    uploadStarted: "Fichier téléchargé et validation commencée",
    uploadFailed: "Échec du téléchargement",
    errorOccurred: "Une erreur s'est produite",
    files: "fichiers",
    file: "fichier",
    batchUpload: "Téléchargement par lot",
    batchDescription: "Jusqu'à 10 fichiers peuvent être téléchargés simultanément",
  };

  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validationId, setValidationId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);

  // Get auto-redirect preference from localStorage (default: true)
  const getAutoRedirectPreference = () => {
    const preference = localStorage.getItem('autoRedirectValidation');
    return preference === null ? true : preference === 'true';
  };

  // Single file upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      // Upload file
      const fileResponse = await client.post("/files", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          setUploadProgress(progress);
        },
      });

      // Create validation run
      const validationResponse = await client.post("/validations", {
        fileId: fileResponse.data.fileId,
      });

      return {
        fileId: fileResponse.data.fileId,
        validationId: validationResponse.data.validationId,
      };
    },
    onSuccess: (data) => {
      setValidationId(data.validationId);
      setShowSuccess(true);

      toast({
        title: translations.success,
        description: translations.uploadStarted,
      });

      // Auto-redirect after 1 second if preference is enabled
      if (getAutoRedirectPreference()) {
        setTimeout(() => {
          setLocation(`/validator/runs/${data.validationId}`);
        }, 1000);
      }
    },
    onError: (error: any) => {
      toast({
        title: translations.uploadFailed,
        description: error.response?.data?.error || translations.errorOccurred,
        variant: "destructive",
      });
    },
  });

  // Batch upload mutation
  const batchUploadMutation = useMutation({
    mutationFn: async (filesToUpload: File[]) => {
      // Upload all files
      const formData = new FormData();
      filesToUpload.forEach(file => {
        formData.append("files", file);
      });

      const fileResponse = await client.post("/files/batch", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          setUploadProgress(progress);
        },
      });

      // Create batch validation
      const validationResponse = await client.post("/validations/batch", {
        fileIds: fileResponse.data.fileIds,
      });

      return {
        fileIds: fileResponse.data.fileIds,
        count: validationResponse.data.count,
      };
    },
    onSuccess: (data) => {
      setShowSuccess(true);

      toast({
        title: translations.success,
        description: `${data.count} ${translations.batchUploaded}`,
      });

      // Auto-redirect to runs list after 1.5 seconds
      if (getAutoRedirectPreference()) {
        setTimeout(() => {
          setLocation("/validator/runs");
        }, 1500);
      }
    },
    onError: (error: any) => {
      toast({
        title: translations.uploadFailed,
        description: error.response?.data?.error || translations.errorOccurred,
        variant: "destructive",
      });
    },
  });

  const handleFileDrop = (droppedFiles: File[]) => {
    setFiles(droppedFiles);
    setUploadProgress(0);
    setValidationId(null);
    setShowSuccess(false);
    setIsBatchMode(droppedFiles.length > 1);
  };

  const handleUpload = () => {
    if (files.length === 0) return;

    if (files.length === 1) {
      uploadMutation.mutate(files[0]);
    } else {
      batchUploadMutation.mutate(files);
    }
  };

  const handleViewRun = () => {
    if (validationId) {
      setLocation(`/validator/runs/${validationId}`);
    }
  };

  const handleViewRuns = () => {
    setLocation("/validator/runs");
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    setIsBatchMode(newFiles.length > 1);
  };

  const isUploading = uploadMutation.isPending || batchUploadMutation.isPending;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Page Header */}
      <header className="bg-card border-b border-border p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
            {translations.pageTitle}
          </h1>
          <p className="text-muted-foreground">
            {translations.pageDescription}
          </p>
        </div>
      </header>

      {/* Upload Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Upload Area */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Upload className="w-5 h-5 mr-2" />
                  {translations.fileUpload}
                </div>
                {isBatchMode && (
                  <Badge variant="secondary" data-testid="batch-mode-indicator">
                    {translations.batchUpload}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!isUploading && !validationId && (
                <>
                  <FileDropzone
                    onDrop={handleFileDrop}
                    accept={{ "text/csv": [".csv"] }}
                    maxFiles={10}
                    data-testid="file-dropzone"
                  />
                  {isBatchMode && (
                    <Alert className="mt-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {translations.batchDescription}
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}

              {files.length > 0 && !isUploading && !validationId && (
                <div className="mt-6 space-y-4">
                  <div className="space-y-2">
                    {files.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <p className="font-medium text-sm" data-testid={`selected-file-${index}`}>
                            {file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFile(index)}
                          aria-label={`Retirer ${file.name}`}
                          data-testid={`remove-file-${index}`}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <Button onClick={handleUpload} className="w-full" data-testid="button-upload">
                    <Upload className="w-4 h-4 mr-2" />
                    {isBatchMode
                      ? `Télécharger et valider ${files.length} ${translations.files}`
                      : translations.uploadAndValidate
                    }
                  </Button>
                </div>
              )}

              {isUploading && (
                <div className="space-y-4">
                  <div className="text-center">
                    <Upload className="w-12 h-12 mx-auto mb-4 text-primary animate-pulse" />
                    <h3 className="text-lg font-medium">{translations.uploading}</h3>
                    <p className="text-muted-foreground">{translations.pleaseWait}</p>
                  </div>
                  <Progress value={uploadProgress} className="w-full" />
                  <p className="text-center text-sm text-muted-foreground">
                    {uploadProgress}{translations.complete}
                  </p>
                </div>
              )}

              {showSuccess && (
                <div className="text-center space-y-4">
                  <CheckCircle className="w-12 h-12 mx-auto text-green-600" />
                  <div>
                    <h3 className="text-lg font-medium text-green-600">{translations.uploadSuccessful}</h3>
                    <p className="text-muted-foreground">
                      {isBatchMode
                        ? `${files.length} ${translations.batchUploaded}`
                        : translations.fileUploaded
                      }
                    </p>
                    {getAutoRedirectPreference() && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {translations.redirecting}
                      </p>
                    )}
                  </div>
                  {!getAutoRedirectPreference() && (
                    <>
                      {validationId && !isBatchMode && (
                        <Button onClick={handleViewRun} data-testid="button-view-run">
                          <Eye className="w-4 h-4 mr-2" />
                          {translations.viewValidationRun}
                        </Button>
                      )}
                      {isBatchMode && (
                        <Button onClick={handleViewRuns} data-testid="button-view-runs">
                          <Eye className="w-4 h-4 mr-2" />
                          {translations.viewValidations}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upload Guidelines */}
          <Card>
            <CardHeader>
              <CardTitle>{translations.uploadGuidelines}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {translations.followFormat}
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2">{translations.supportedFileTypes}</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>{translations.csvFiles}</li>
                    <li>{translations.utf8Encoding}</li>
                    <li>{translations.maxFileSize}</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">{translations.fileFormatRequirements}</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>{translations.headerRowRequired}</li>
                    <li>{translations.delimited}</li>
                    <li>{translations.consistentStructure}</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">{translations.validationFeatures}</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>{translations.dataTypeValidation}</li>
                    <li>{translations.businessRuleEnforcement}</li>
                    <li>{translations.duplicateDetection}</li>
                    <li>{translations.formatConsistencyChecks}</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">{translations.afterUpload}</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>{translations.realTimeProgress}</li>
                    <li>{translations.detailedErrorReporting}</li>
                    <li>{translations.dataQualityMetrics}</li>
                    <li>{translations.exportValidatedData}</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
