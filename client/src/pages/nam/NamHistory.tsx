import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Eye,
  Upload,
  Search,
} from "lucide-react";
import client from "@/api/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

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
  processingTimeMs?: number;
  createdAt: string;
}

export default function NamHistoryPage() {
  const [, setLocation] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const translations = {
    pageTitle: "Historique des Extractions NAM",
    pageDescription: "Consultez l'historique de toutes vos extractions de NAM",
    newExtraction: "Nouvelle Extraction",
    filterByStatus: "Filtrer par statut",
    all: "Tous",
    queued: "En attente",
    running: "En cours",
    completed: "Terminé",
    failed: "Échec",
    searchPlaceholder: "Rechercher par nom de fichier...",
    fileName: "Fichier",
    status: "Statut",
    stage: "Étape",
    namsFound: "NAMs Trouvés",
    namsValid: "NAMs Valides",
    date: "Date",
    actions: "Actions",
    viewResults: "Voir",
    noExtractions: "Aucune extraction trouvée",
    startFirstExtraction: "Commencez votre première extraction de NAM",
    uploadPDF: "Télécharger un PDF",
    loading: "Chargement...",
    ocr: "OCR",
    ai_extraction: "Extraction IA",
    validation: "Validation",
    processingTime: "Temps",
  };

  // Fetch NAM runs
  const { data: runsData, isLoading } = useQuery<{ runs: NAMRun[]; count: number }>({
    queryKey: ["nam-runs", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("limit", "50");
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }

      const response = await client.get(`/nam/runs?${params.toString()}`);
      return response.data;
    },
    refetchInterval: 5000, // Refetch every 5 seconds to catch status changes
  });

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
      <Badge variant="outline" className="text-xs">
        {translations[stage as keyof typeof translations] || stage}
      </Badge>
    );
  };

  const handleViewRun = (runId: string) => {
    setLocation(`/nam/results/${runId}`);
  };

  const handleNewExtraction = () => {
    setLocation("/nam/upload");
  };

  // Filter runs by search query
  const filteredRuns = runsData?.runs?.filter(run =>
    run.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Page Header */}
      <header className="bg-card border-b border-border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {translations.pageTitle}
            </h1>
            <p className="text-muted-foreground">
              {translations.pageDescription}
            </p>
          </div>
          <Button onClick={handleNewExtraction}>
            <Upload className="w-4 h-4 mr-2" />
            {translations.newExtraction}
          </Button>
        </div>
      </header>

      {/* Filters */}
      <div className="bg-card border-b border-border p-4">
        <div className="max-w-7xl mx-auto flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={translations.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={translations.filterByStatus} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{translations.all}</SelectItem>
              <SelectItem value="queued">{translations.queued}</SelectItem>
              <SelectItem value="running">{translations.running}</SelectItem>
              <SelectItem value="completed">{translations.completed}</SelectItem>
              <SelectItem value="failed">{translations.failed}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">{translations.loading}</span>
            </div>
          ) : filteredRuns.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center space-y-4">
                  <FileText className="w-16 h-16 mx-auto text-muted-foreground" />
                  <div>
                    <h3 className="text-lg font-medium">{translations.noExtractions}</h3>
                    <p className="text-muted-foreground">{translations.startFirstExtraction}</p>
                  </div>
                  <Button onClick={handleNewExtraction}>
                    <Upload className="w-4 h-4 mr-2" />
                    {translations.uploadPDF}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Extractions ({filteredRuns.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">{translations.fileName}</th>
                        <th className="text-left py-3 px-4">{translations.status}</th>
                        <th className="text-left py-3 px-4">{translations.stage}</th>
                        <th className="text-right py-3 px-4">{translations.namsFound}</th>
                        <th className="text-right py-3 px-4">{translations.namsValid}</th>
                        <th className="text-left py-3 px-4">{translations.date}</th>
                        <th className="text-right py-3 px-4">{translations.actions}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRuns.map((run) => (
                        <tr key={run.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4">
                            <div className="flex items-center">
                              <FileText className="w-4 h-4 mr-2 text-muted-foreground" />
                              <span className="font-medium">{run.fileName}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {getStatusBadge(run.status)}
                          </td>
                          <td className="py-3 px-4">
                            {run.status === "running" && run.stage && getStageBadge(run.stage)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {run.namsFound !== null && run.namsFound !== undefined
                              ? run.namsFound
                              : "-"}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {run.namsValid !== null && run.namsValid !== undefined ? (
                              <span className="text-green-600 font-medium">{run.namsValid}</span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">
                            {format(new Date(run.createdAt), "d MMM yyyy HH:mm", { locale: fr })}
                            {run.processingTimeMs && run.status === "completed" && (
                              <div className="text-xs">
                                {(run.processingTimeMs / 1000).toFixed(1)}s
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewRun(run.id)}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              {translations.viewResults}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
