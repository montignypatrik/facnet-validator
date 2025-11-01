import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Stethoscope, Plus, Search } from "lucide-react";
import client from "@/api/client";

interface Doctor {
  id: string;
  userId: string;
  clNumber?: string;
  name: string;
  license?: string;
  groupe?: string;
  servicePlan?: string;
  status: "Actif" | "Maternité" | "Maladie" | "Inactif";
  createdAt: string;
  updatedAt: string;
}

const statusColors = {
  Actif: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  Maternité: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  Maladie: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  Inactif: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

// Helper function to format license with groupe
const formatLicense = (license?: string, groupe?: string) => {
  if (!license) return "-";
  if (groupe) return `${license}-${groupe}`;
  return license;
};

export default function DoctorsList() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formData, setFormData] = useState({
    clNumber: "",
    name: "",
    license: "",
    groupe: "",
    servicePlan: "",
    status: "Actif" as "Actif" | "Maternité" | "Maladie" | "Inactif",
  });

  // Fetch doctors
  const { data: doctorsData, isLoading } = useQuery({
    queryKey: ["/doctors", { search, page, pageSize }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search) params.append("search", search);

      const response = await client.get(`/doctors?${params}`);
      return response.data;
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await client.post("/doctors", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/doctors"] });
      setShowAddDialog(false);
      setFormData({
        clNumber: "",
        name: "",
        license: "",
        groupe: "",
        servicePlan: "",
        status: "Actif",
      });
      toast({
        title: "Succès",
        description: "Médecin ajouté avec succès",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.response?.data?.error || "Échec de l'ajout du médecin",
        variant: "destructive",
      });
    },
  });

  const handleRowClick = (doctor: Doctor) => {
    navigate(`/book-de-md/${doctor.id}`);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
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
    createMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Stethoscope className="w-8 h-8" />
              Book de MD
            </h1>
            <p className="text-muted-foreground mt-1">
              Répertoire centralisé de vos médecins
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline">
              {doctorsData?.total || 0} médecins
            </Badge>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Ajouter un médecin
            </Button>
          </div>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, numéro CL ou licence..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="flex-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Doctors Table */}
        <Card>
          <CardContent className="p-0">
            {doctorsData && doctorsData.data.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-border bg-muted/50">
                    <tr>
                      <th className="text-left p-4 font-medium text-foreground">Numéro CL</th>
                      <th className="text-left p-4 font-medium text-foreground">Nom</th>
                      <th className="text-left p-4 font-medium text-foreground">Licence</th>
                      <th className="text-left p-4 font-medium text-foreground">Plan de service</th>
                      <th className="text-left p-4 font-medium text-foreground">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doctorsData.data.map((doctor: Doctor) => (
                      <tr
                        key={doctor.id}
                        onClick={() => handleRowClick(doctor)}
                        className="border-b border-border hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <td className="p-4 text-foreground">{doctor.clNumber || "-"}</td>
                        <td className="p-4 text-foreground font-medium">{doctor.name}</td>
                        <td className="p-4 text-foreground">{formatLicense(doctor.license, doctor.groupe)}</td>
                        <td className="p-4 text-foreground">{doctor.servicePlan || "-"}</td>
                        <td className="p-4">
                          <Badge className={statusColors[doctor.status]}>
                            {doctor.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Stethoscope className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">Aucun médecin trouvé</p>
                <p className="text-sm">
                  {search
                    ? "Essayez de modifier votre recherche"
                    : "Cliquez sur 'Ajouter un médecin' pour commencer"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {doctorsData && doctorsData.total > pageSize && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              Précédent
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} sur {Math.ceil(doctorsData.total / pageSize)}
            </span>
            <Button
              variant="outline"
              onClick={() => setPage(Math.min(Math.ceil(doctorsData.total / pageSize), page + 1))}
              disabled={page >= Math.ceil(doctorsData.total / pageSize)}
            >
              Suivant
            </Button>
          </div>
        )}

        {/* Add Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Ajouter un médecin</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clNumber">Numéro CL</Label>
                  <Input
                    id="clNumber"
                    value={formData.clNumber}
                    onChange={(e) => setFormData({ ...formData, clNumber: e.target.value })}
                    placeholder="Ex: 12345"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nom <span className="text-red-500">*</span></Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Dr. Jean Dupont"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="license">Licence</Label>
                  <Input
                    id="license"
                    value={formData.license}
                    onChange={(e) => setFormData({ ...formData, license: e.target.value })}
                    placeholder="Ex: 1234567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="groupe">Groupe (optionnel)</Label>
                  <Input
                    id="groupe"
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
                <Label htmlFor="servicePlan">Plan de service</Label>
                <Input
                  id="servicePlan"
                  value={formData.servicePlan}
                  onChange={(e) => setFormData({ ...formData, servicePlan: e.target.value })}
                  placeholder="Ex: Plan A"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Statut</Label>
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

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Ajout..." : "Ajouter"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
