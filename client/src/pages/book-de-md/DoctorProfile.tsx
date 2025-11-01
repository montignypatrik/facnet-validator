import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, Edit, Trash2, Save, X } from "lucide-react";
import client from "@/api/client";

type RemunerationType = "Acte" | "Mixte" | "TH" | "Dépanage";

interface Practice {
  active: boolean;
  remuneration: RemunerationType | null;
}

interface Practices {
  cab?: Practice;
  urg?: Practice;
  hospit?: Practice;
  chsld?: Practice;
  sad?: Practice;
  siad?: Practice;
}

interface Doctor {
  id: string;
  userId: string;
  clNumber?: string;
  name: string;
  license?: string;
  groupe?: string;
  servicePlan?: string;
  status: "Actif" | "Maternité" | "Maladie" | "Inactif";
  practices?: Practices;
  createdAt: string;
  updatedAt: string;
}

const statusColors = {
  Actif: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  Maternité: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  Maladie: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  Inactif: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

const practiceLabels: Record<string, string> = {
  cab: "Cabinet",
  urg: "Urgence",
  hospit: "Hospitalier",
  chsld: "CHSLD",
  sad: "SAD",
  siad: "SIAD",
};

const remunerationColors: Record<RemunerationType, string> = {
  Acte: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300",
  Mixte: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-300",
  TH: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-300",
  Dépanage: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-300",
};

// Helper function to format license with groupe
const formatLicense = (license?: string, groupe?: string) => {
  if (!license) return "-";
  if (groupe) return `${license}-${groupe}`;
  return license;
};

export default function DoctorProfile() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [formData, setFormData] = useState({
    clNumber: "",
    name: "",
    license: "",
    groupe: "",
    servicePlan: "",
    status: "Actif" as "Actif" | "Maternité" | "Maladie" | "Inactif",
    practices: {} as Practices,
  });

  const doctorId = params.id;

  // Fetch doctor
  const { data: doctor, isLoading } = useQuery<Doctor>({
    queryKey: ["/doctors", doctorId],
    queryFn: async () => {
      const response = await client.get(`/doctors/${doctorId}`);
      return response.data;
    },
    enabled: !!doctorId,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await client.patch(`/doctors/${doctorId}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/doctors"] });
      setShowEditDialog(false);
      toast({
        title: "Succès",
        description: "Médecin mis à jour avec succès",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.response?.data?.error || "Échec de la mise à jour du médecin",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await client.delete(`/doctors/${doctorId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/doctors"] });
      toast({
        title: "Succès",
        description: "Médecin supprimé avec succès",
      });
      navigate("/book-de-md/list");
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.response?.data?.error || "Échec de la suppression du médecin",
        variant: "destructive",
      });
    },
  });

  const handleEdit = () => {
    if (doctor) {
      setFormData({
        clNumber: doctor.clNumber || "",
        name: doctor.name,
        license: doctor.license || "",
        groupe: doctor.groupe || "",
        servicePlan: doctor.servicePlan || "",
        status: doctor.status,
        practices: doctor.practices || {},
      });
      setShowEditDialog(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({
        title: "Erreur",
        description: "Le nom est requis",
        variant: "destructive",
      });
      return;
    }
    updateMutation.mutate(formData);
  };

  const handleDelete = () => {
    deleteMutation.mutate();
    setShowDeleteDialog(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-foreground">Médecin non trouvé</h2>
          <p className="text-muted-foreground">
            Ce médecin n'existe pas ou vous n'avez pas la permission de le voir.
          </p>
          <Button onClick={() => navigate("/book-de-md/list")}>
            Retour à la liste
          </Button>
        </div>
      </div>
    );
  }

  const isAdmin = user?.role === "admin";

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/book-de-md/list")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{doctor.name}</h1>
              <p className="text-muted-foreground mt-1">Profil du médecin</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleEdit}>
              <Edit className="w-4 h-4 mr-2" />
              Modifier
            </Button>
            {isAdmin && (
              <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
                <Trash2 className="w-4 h-4 mr-2" />
                Supprimer
              </Button>
            )}
          </div>
        </div>

        {/* Doctor Information */}
        <Card>
          <CardHeader>
            <CardTitle>Informations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Numéro CL</p>
                <p className="text-base font-medium text-foreground">
                  {doctor.clNumber || "-"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Nom</p>
                <p className="text-base font-medium text-foreground">{doctor.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Licence</p>
                <p className="text-base font-medium text-foreground">
                  {formatLicense(doctor.license, doctor.groupe)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Plan de service</p>
                <p className="text-base font-medium text-foreground">
                  {doctor.servicePlan || "-"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Statut</p>
                <Badge className={statusColors[doctor.status]}>
                  {doctor.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pratique Section */}
        {doctor.practices && Object.keys(doctor.practices).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Pratique</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(doctor.practices).map(([key, practice]) => {
                  if (practice?.active && practice?.remuneration) {
                    return (
                      <Badge
                        key={key}
                        className={`${remunerationColors[practice.remuneration]} border-2`}
                      >
                        {practiceLabels[key]} - {practice.remuneration}
                      </Badge>
                    );
                  }
                  return null;
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Metadata */}
        <Card>
          <CardHeader>
            <CardTitle>Métadonnées</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Créé le:</span>
              <span className="text-sm font-medium text-foreground">
                {new Date(doctor.createdAt).toLocaleDateString("fr-CA", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Modifié le:</span>
              <span className="text-sm font-medium text-foreground">
                {new Date(doctor.updatedAt).toLocaleDateString("fr-CA", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Modifier le médecin</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-clNumber">Numéro CL</Label>
                  <Input
                    id="edit-clNumber"
                    value={formData.clNumber}
                    onChange={(e) => setFormData({ ...formData, clNumber: e.target.value })}
                    placeholder="Ex: 12345"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Nom <span className="text-red-500">*</span></Label>
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Dr. Jean Dupont"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-license">Licence</Label>
                  <Input
                    id="edit-license"
                    value={formData.license}
                    onChange={(e) => setFormData({ ...formData, license: e.target.value })}
                    placeholder="Ex: 1234567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-groupe">Groupe (optionnel)</Label>
                  <Input
                    id="edit-groupe"
                    value={formData.groupe}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 5);
                      setFormData({ ...formData, groupe: value });
                    }}
                    placeholder="Ex: 12345"
                    maxLength={5}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-servicePlan">Plan de service</Label>
                <Input
                  id="edit-servicePlan"
                  value={formData.servicePlan}
                  onChange={(e) => setFormData({ ...formData, servicePlan: e.target.value })}
                  placeholder="Ex: Plan A"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-status">Statut</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: any) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Actif">Actif</SelectItem>
                    <SelectItem value="Maternité">Maternité</SelectItem>
                    <SelectItem value="Maladie">Maladie</SelectItem>
                    <SelectItem value="Inactif">Inactif</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Pratique Section */}
              <div className="space-y-3">
                <Label>Pratique</Label>
                <div className="space-y-3 border rounded-lg p-4">
                  {Object.entries(practiceLabels).map(([key, label]) => {
                    const practice = formData.practices[key as keyof Practices];
                    return (
                      <div key={key} className="flex items-center gap-4">
                        <div className="flex items-center space-x-2 w-32">
                          <Checkbox
                            id={`practice-${key}`}
                            checked={practice?.active || false}
                            onCheckedChange={(checked) => {
                              setFormData({
                                ...formData,
                                practices: {
                                  ...formData.practices,
                                  [key]: {
                                    active: checked as boolean,
                                    remuneration: practice?.remuneration || null,
                                  },
                                },
                              });
                            }}
                          />
                          <Label htmlFor={`practice-${key}`} className="font-normal cursor-pointer">
                            {label}
                          </Label>
                        </div>
                        {practice?.active && (
                          <Select
                            value={practice.remuneration || ""}
                            onValueChange={(value: RemunerationType) => {
                              setFormData({
                                ...formData,
                                practices: {
                                  ...formData.practices,
                                  [key]: {
                                    active: true,
                                    remuneration: value,
                                  },
                                },
                              });
                            }}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Rémunération" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Acte">Acte</SelectItem>
                              <SelectItem value="Mixte">Mixte</SelectItem>
                              <SelectItem value="TH">TH</SelectItem>
                              <SelectItem value="Dépanage">Dépanage</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                  <X className="w-4 h-4 mr-2" />
                  Annuler
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  {updateMutation.isPending ? "Sauvegarde..." : "Sauvegarder"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmer la suppression</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Êtes-vous sûr de vouloir supprimer le médecin <strong>{doctor.name}</strong> ?
                Cette action est irréversible.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                  Annuler
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
                  {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
