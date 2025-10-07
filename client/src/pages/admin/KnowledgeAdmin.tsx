/**
 * Knowledge Base Admin Page
 *
 * Admin interface for managing RAG documents
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  Upload,
  RefreshCw,
  Trash2,
  Eye,
  Download,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  Database,
  FolderSync,
  Play,
} from "lucide-react";
import * as chatbotAdmin from "@/api/chatbot-admin";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function KnowledgeAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("ramq-official");

  // Fetch documents
  const { data: documents = [], isLoading: documentsLoading } = useQuery({
    queryKey: ["/chatbot/admin/documents"],
    queryFn: chatbotAdmin.getDocuments,
    refetchInterval: 5000, // Poll every 5 seconds
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ["/chatbot/admin/stats"],
    queryFn: chatbotAdmin.getStats,
    refetchInterval: 5000,
  });

  // Fetch selected document details
  const { data: documentDetails } = useQuery({
    queryKey: ["/chatbot/admin/documents", selectedDocument],
    queryFn: () => chatbotAdmin.getDocument(selectedDocument!),
    enabled: !!selectedDocument,
  });

  // Scan directory mutation
  const scanMutation = useMutation({
    mutationFn: chatbotAdmin.scanDirectory,
    onSuccess: () => {
      toast({
        title: "Scan démarré",
        description: "Analyse du répertoire en cours...",
      });
      queryClient.invalidateQueries({ queryKey: ["/chatbot/admin/documents"] });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de démarrer l'analyse",
        variant: "destructive",
      });
    },
  });

  // Bulk import mutation
  const bulkImportMutation = useMutation({
    mutationFn: chatbotAdmin.bulkImport,
    onSuccess: () => {
      toast({
        title: "Import en masse démarré",
        description: "Traitement de tous les documents en attente...",
      });
      queryClient.invalidateQueries({ queryKey: ["/chatbot/admin/documents"] });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de démarrer l'import en masse",
        variant: "destructive",
      });
    },
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: ({ file, category }: { file: File; category: string }) =>
      chatbotAdmin.uploadDocument(file, category),
    onSuccess: () => {
      toast({
        title: "Document téléchargé",
        description: "Le document sera traité automatiquement",
      });
      queryClient.invalidateQueries({ queryKey: ["/chatbot/admin/documents"] });
      setUploadDialogOpen(false);
      setSelectedFile(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur de téléchargement",
        description: error.response?.data?.error || "Impossible de télécharger le fichier",
        variant: "destructive",
      });
    },
  });

  // Reprocess mutation
  const reprocessMutation = useMutation({
    mutationFn: chatbotAdmin.reprocessDocument,
    onSuccess: () => {
      toast({
        title: "Retraitement démarré",
        description: "Le document sera retraité automatiquement",
      });
      queryClient.invalidateQueries({ queryKey: ["/chatbot/admin/documents"] });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de retraiter le document",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: chatbotAdmin.deleteDocument,
    onSuccess: () => {
      toast({
        title: "Document supprimé",
        description: "Le document a été supprimé avec succès",
      });
      queryClient.invalidateQueries({ queryKey: ["/chatbot/admin/documents"] });
      setSelectedDocument(null);
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le document",
        variant: "destructive",
      });
    },
  });

  const handleUpload = () => {
    if (!selectedFile) return;
    uploadMutation.mutate({ file: selectedFile, category: selectedCategory });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Complété</Badge>;
      case "processing":
        return <Badge className="bg-blue-500"><Loader2 className="w-3 h-3 mr-1 animate-spin" />En cours</Badge>;
      case "pending":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />En attente</Badge>;
      case "error":
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Erreur</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      "ramq-official": "Documents officiels RAMQ",
      "billing-guides": "Guides de facturation",
      "code-references": "Références de codes",
      "regulations": "Réglementations",
      "faq": "Questions fréquentes",
    };
    return labels[category] || category;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Page Header */}
      <header className="bg-card border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold text-foreground">Base de Connaissances RAG</h1>
              <p className="text-sm text-muted-foreground">Gestion des documents pour l'assistant IA</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => scanMutation.mutate()}
              disabled={scanMutation.isPending}
              variant="outline"
              size="sm"
            >
              <FolderSync className="w-4 h-4 mr-1" />
              Scanner
            </Button>
            <Button
              onClick={() => bulkImportMutation.mutate()}
              disabled={bulkImportMutation.isPending}
              variant="outline"
              size="sm"
            >
              <Play className="w-4 h-4 mr-1" />
              Import en masse
            </Button>
            <Button onClick={() => setUploadDialogOpen(true)} size="sm">
              <Upload className="w-4 h-4 mr-1" />
              Télécharger
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 p-6 overflow-y-auto">
        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Documents</p>
                  <p className="text-2xl font-bold">{stats.documents.totalDocuments}</p>
                </div>
                <FileText className="w-8 h-8 text-muted-foreground" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Chunks Générés</p>
                  <p className="text-2xl font-bold">{stats.documents.totalChunks}</p>
                </div>
                <Database className="w-8 h-8 text-muted-foreground" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">En attente</p>
                  <p className="text-2xl font-bold">{stats.queue.waiting}</p>
                </div>
                <Clock className="w-8 h-8 text-blue-500" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">En cours</p>
                  <p className="text-2xl font-bold">{stats.queue.active}</p>
                </div>
                <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
              </div>
            </Card>
          </div>
        )}

        {/* Documents Table */}
        <Card>
          <div className="p-4 border-b border-border">
            <h2 className="font-medium">Documents</h2>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom du fichier</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Taille</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documentsLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Chargement...
                    </TableCell>
                  </TableRow>
                ) : documents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Aucun document trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">{doc.filename}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{doc.fileType.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{getCategoryLabel(doc.category)}</TableCell>
                      <TableCell>{getStatusBadge(doc.status)}</TableCell>
                      <TableCell>{(parseInt(doc.fileSizeBytes) / 1024).toFixed(1)} KB</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(doc.createdAt).toLocaleDateString("fr-CA")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedDocument(doc.id)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => reprocessMutation.mutate(doc.id)}
                            disabled={reprocessMutation.isPending}
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("Supprimer ce document ?")) {
                                deleteMutation.mutate(doc.id);
                              }
                            }}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Télécharger un document</DialogTitle>
            <DialogDescription>
              Ajoutez un nouveau document HTML ou PDF à la base de connaissances
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium mb-2">Catégorie</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ramq-official">Documents officiels RAMQ</SelectItem>
                  <SelectItem value="billing-guides">Guides de facturation</SelectItem>
                  <SelectItem value="code-references">Références de codes</SelectItem>
                  <SelectItem value="regulations">Réglementations</SelectItem>
                  <SelectItem value="faq">Questions fréquentes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Fichier</label>
              <input
                type="file"
                accept=".html,.htm,.pdf"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Formats acceptés: HTML, PDF (max 10MB)
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploadMutation.isPending}
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Téléchargement...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Télécharger
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Document Details Dialog */}
      <Dialog open={!!selectedDocument} onOpenChange={(open) => !open && setSelectedDocument(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détails du document</DialogTitle>
          </DialogHeader>
          {documentDetails && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nom du fichier</p>
                  <p className="font-medium">{documentDetails.document.filename}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Statut</p>
                  {getStatusBadge(documentDetails.document.status)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p>{documentDetails.document.fileType.toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Catégorie</p>
                  <p>{getCategoryLabel(documentDetails.document.category)}</p>
                </div>
              </div>
              {documentDetails.document.errorMessage && (
                <div className="bg-red-50 border border-red-200 rounded p-3">
                  <p className="text-sm text-red-800">{documentDetails.document.errorMessage}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium mb-2">
                  Chunks générés ({documentDetails.chunks.length})
                </p>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {documentDetails.chunks.slice(0, 10).map((chunk) => (
                    <Card key={chunk.id} className="p-3">
                      <p className="text-xs text-muted-foreground mb-1">
                        Chunk {chunk.chunkIndex} • {chunk.tokenCount} tokens
                        {chunk.sectionTitle && ` • ${chunk.sectionTitle}`}
                      </p>
                      <p className="text-sm line-clamp-3">{chunk.content}</p>
                    </Card>
                  ))}
                  {documentDetails.chunks.length > 10 && (
                    <p className="text-sm text-muted-foreground text-center">
                      ... et {documentDetails.chunks.length - 10} autres chunks
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
