import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDropzone } from "@/components/FileDropzone";
import { Upload, CheckCircle, AlertCircle, Eye, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import client from "@/api/client";

export default function NamUploadPage() {
  // French translations
  const translations = {
    pageTitle: "Extraction de NAM",
    pageDescription: "Téléchargez vos documents PDF pour extraire les numéros d'assurance maladie (NAM)",
    fileUpload: "Téléchargement de PDF",
    billingInfo: "Informations de Facturation",
    doctorLicence: "Numéro de permis du médecin",
    doctorLicencePlaceholder: "1234567",
    doctorGroup: "Numéro de groupe (optionnel)",
    doctorGroupPlaceholder: "12345",
    sector: "Secteur",
    sectorPlaceholder: "Sélectionner un secteur",
    uploadAndExtract: "Télécharger et Extraire",
    uploading: "Téléchargement en cours...",
    pleaseWait: "Veuillez patienter pendant le traitement de votre document",
    complete: "% terminé",
    uploadSuccessful: "Téléchargement Réussi !",
    fileUploaded: "Votre fichier PDF a été téléchargé et l'extraction a commencé",
    redirecting: "Redirection automatique vers la page de résultats...",
    viewResults: "Voir les Résultats",
    uploadGuidelines: "Guide d'Utilisation",
    followFormat: "Assurez-vous que vos documents PDF contiennent des NAM valides au format LLLL99999999 (4 lettres suivies de 8 chiffres).",
    supportedFileTypes: "Types de Fichiers Supportés",
    pdfFiles: "• Fichiers PDF (.pdf)",
    maxFileSize: "• Taille maximale : 50MB",
    extractionProcess: "Processus d'Extraction",
    ocrExtraction: "• Extraction OCR avec AWS Textract",
    aiExtraction: "• Identification intelligente avec OpenAI GPT-4",
    formatValidation: "• Validation automatique du format NAM",
    namFormat: "Format NAM",
    fourLetters: "• 4 lettres majuscules (A-Z)",
    eightDigits: "• 8 chiffres (0-9)",
    exampleNam: "• Exemple: ABCD12345678",
    afterExtraction: "Après l'Extraction",
    realTimeProgress: "• Progression en temps réel",
    validationResults: "• Résultats de validation détaillés",
    ssvExport: "• Export SSV pour facturation",
    manualReview: "• Révision manuelle des NAMs extraits",
    success: "Succès !",
    uploadStarted: "PDF téléchargé et extraction commencée",
    uploadFailed: "Échec du téléchargement",
    errorOccurred: "Une erreur s'est produite",
    fillAllRequired: "Veuillez remplir tous les champs requis",
  };

  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [runId, setRunId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Billing information fields
  const [doctorLicenceID, setDoctorLicenceID] = useState("");
  const [doctorGroupNumber, setDoctorGroupNumber] = useState("");
  const [sector, setSector] = useState("");

  // Get auto-redirect preference from localStorage (default: true)
  const getAutoRedirectPreference = () => {
    const preference = localStorage.getItem('autoRedirectNAM');
    return preference === null ? true : preference === 'true';
  };

  // PDF upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (fileToUpload: File) => {
      // Validate billing information before upload
      if (!doctorLicenceID || !/^\d{7}$/.test(doctorLicenceID)) {
        throw new Error("Le numéro de permis du médecin doit contenir exactement 7 chiffres");
      }

      if (doctorGroupNumber && !/^\d{5}$/.test(doctorGroupNumber)) {
        throw new Error("Le numéro de groupe doit contenir exactement 5 chiffres ou être vide");
      }

      if (!sector) {
        throw new Error("Veuillez sélectionner un secteur");
      }

      const formData = new FormData();
      formData.append("file", fileToUpload);
      formData.append("doctorLicenceID", doctorLicenceID);
      formData.append("doctorGroupNumber", doctorGroupNumber);
      formData.append("sector", sector);

      // Upload PDF and create NAM extraction run
      const response = await client.post("/nam/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          setUploadProgress(progress);
        },
      });

      return {
        runId: response.data.runId,
        jobId: response.data.jobId,
        fileName: response.data.fileName,
      };
    },
    onSuccess: (data) => {
      setRunId(data.runId);
      setShowSuccess(true);

      toast({
        title: translations.success,
        description: translations.uploadStarted,
      });

      // Auto-redirect after 1 second if preference is enabled
      if (getAutoRedirectPreference()) {
        setTimeout(() => {
          setLocation(`/nam/results/${data.runId}`);
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

  const handleFileDrop = (droppedFiles: File[]) => {
    if (droppedFiles.length > 0) {
      setFile(droppedFiles[0]);
      setUploadProgress(0);
      setRunId(null);
      setShowSuccess(false);
      // Don't reset billing info - keep it for re-uploads
    }
  };

  const handleUpload = () => {
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  const handleViewResults = () => {
    if (runId) {
      setLocation(`/nam/results/${runId}`);
    }
  };

  const isUploading = uploadMutation.isPending;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Page Header */}
      <header className="bg-card border-b border-border p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
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
              <CardTitle className="flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                {translations.fileUpload}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!isUploading && !runId && (
                <FileDropzone
                  onDrop={handleFileDrop}
                  accept={{ "application/pdf": [".pdf"] }}
                  maxFiles={1}
                />
              )}

              {file && !isUploading && !runId && (
                <div className="mt-6 space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex items-center">
                      <FileText className="w-8 h-8 mr-3 text-primary" />
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Billing Information Form */}
                  <div className="p-4 bg-muted rounded-lg space-y-4">
                    <h3 className="font-medium">{translations.billingInfo}</h3>

                    <div className="space-y-2">
                      <Label htmlFor="doctorLicence">{translations.doctorLicence} *</Label>
                      <Input
                        id="doctorLicence"
                        type="text"
                        maxLength={7}
                        placeholder={translations.doctorLicencePlaceholder}
                        value={doctorLicenceID}
                        onChange={(e) => setDoctorLicenceID(e.target.value.replace(/\D/g, ""))}
                        className="font-mono"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="doctorGroup">{translations.doctorGroup}</Label>
                      <Input
                        id="doctorGroup"
                        type="text"
                        maxLength={5}
                        placeholder={translations.doctorGroupPlaceholder}
                        value={doctorGroupNumber}
                        onChange={(e) => setDoctorGroupNumber(e.target.value.replace(/\D/g, ""))}
                        className="font-mono"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="sector">{translations.sector} *</Label>
                      <Select value={sector} onValueChange={setSector}>
                        <SelectTrigger id="sector">
                          <SelectValue placeholder={translations.sectorPlaceholder} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0</SelectItem>
                          <SelectItem value="1">1</SelectItem>
                          <SelectItem value="2">2</SelectItem>
                          <SelectItem value="3">3</SelectItem>
                          <SelectItem value="4">4</SelectItem>
                          <SelectItem value="5">5</SelectItem>
                          <SelectItem value="6">6</SelectItem>
                          <SelectItem value="7">7</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button
                    onClick={handleUpload}
                    className="w-full"
                    disabled={!doctorLicenceID || !/^\d{7}$/.test(doctorLicenceID) || !sector}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {translations.uploadAndExtract}
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
                      {translations.fileUploaded}
                    </p>
                    {getAutoRedirectPreference() && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {translations.redirecting}
                      </p>
                    )}
                  </div>
                  {!getAutoRedirectPreference() && runId && (
                    <Button onClick={handleViewResults}>
                      <Eye className="w-4 h-4 mr-2" />
                      {translations.viewResults}
                    </Button>
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
                    <li>{translations.pdfFiles}</li>
                    <li>{translations.maxFileSize}</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">{translations.extractionProcess}</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>{translations.ocrExtraction}</li>
                    <li>{translations.aiExtraction}</li>
                    <li>{translations.formatValidation}</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">{translations.namFormat}</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>{translations.fourLetters}</li>
                    <li>{translations.eightDigits}</li>
                    <li>{translations.exampleNam}</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">{translations.afterExtraction}</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>{translations.realTimeProgress}</li>
                    <li>{translations.validationResults}</li>
                    <li>{translations.ssvExport}</li>
                    <li>{translations.manualReview}</li>
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
