import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users as UsersIcon, Shield, Edit, Eye, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import client from "@/api/client";

type User = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "editor" | "viewer" | "pending";
  createdAt: string;
};

const roleIcons = {
  admin: Shield,
  editor: Edit,
  viewer: Eye,
  pending: Clock,
};

const roleColors = {
  admin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  editor: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  viewer: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
};

const roleLabels = {
  admin: "Administrateur",
  editor: "Éditeur",
  viewer: "Lecteur",
  pending: "En attente",
};

export default function Users() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch users - hook must be called before any conditional returns
  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/users"],
    queryFn: async () => {
      const response = await client.get("/users");
      return response.data;
    },
    enabled: currentUser?.role === "admin", // Only run query if user is admin
  });

  // Only admins can access this page
  if (currentUser?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <Shield className="w-16 h-16 mx-auto text-muted-foreground" />
          <h2 className="text-2xl font-bold text-foreground">Accès refusé</h2>
          <p className="text-muted-foreground">
            Vous devez être administrateur pour accéder à cette page.
          </p>
        </div>
      </div>
    );
  }

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const response = await client.patch(`/users/${userId}`, { role });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/users"] });
      toast({
        title: "Rôle mis à jour",
        description: "Le rôle de l'utilisateur a été modifié avec succès.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de modifier le rôle de l'utilisateur.",
        variant: "destructive",
      });
    },
  });

  const handleRoleChange = (userId: string, newRole: string) => {
    updateRoleMutation.mutate({ userId, role: newRole });
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
            <h1 className="text-3xl font-bold text-foreground">
              Gestion des Utilisateurs
            </h1>
            <p className="text-muted-foreground mt-1">
              Gérez les rôles et les permissions des utilisateurs
            </p>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <UsersIcon className="w-5 h-5" />
            <span className="text-sm font-medium">
              {users?.length || 0} utilisateurs
            </span>
          </div>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Utilisateurs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {users && users.length > 0 ? (
                <div className="space-y-3">
                  {users.map((user) => {
                    const RoleIcon = roleIcons[user.role];
                    return (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-primary-foreground">
                              {user.name?.charAt(0)?.toUpperCase() || "U"}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {user.name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {user.email}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <Badge
                            className={`${roleColors[user.role]} flex items-center gap-1`}
                          >
                            <RoleIcon className="w-3 h-3" />
                            {roleLabels[user.role]}
                          </Badge>

                          <Select
                            value={user.role}
                            onValueChange={(value) =>
                              handleRoleChange(user.id, value)
                            }
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">
                                <div className="flex items-center gap-2">
                                  <Shield className="w-4 h-4" />
                                  Administrateur
                                </div>
                              </SelectItem>
                              <SelectItem value="editor">
                                <div className="flex items-center gap-2">
                                  <Edit className="w-4 h-4" />
                                  Éditeur
                                </div>
                              </SelectItem>
                              <SelectItem value="viewer">
                                <div className="flex items-center gap-2">
                                  <Eye className="w-4 h-4" />
                                  Lecteur
                                </div>
                              </SelectItem>
                              <SelectItem value="pending">
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4" />
                                  En attente
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Aucun utilisateur trouvé
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Role Descriptions */}
        <Card>
          <CardHeader>
            <CardTitle>Description des Rôles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-5 h-5 text-red-600" />
                  <h3 className="font-semibold text-foreground">Administrateur</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Accès complet incluant la gestion des utilisateurs, suppressions
                  et modifications
                </p>
              </div>
              <div className="p-4 border border-border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Edit className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-foreground">Éditeur</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Accès en lecture et écriture, peut créer et modifier les données
                </p>
              </div>
              <div className="p-4 border border-border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="w-5 h-5 text-green-600" />
                  <h3 className="font-semibold text-foreground">Lecteur</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Accès en lecture seule, peut consulter les données
                </p>
              </div>
              <div className="p-4 border border-border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-yellow-600" />
                  <h3 className="font-semibold text-foreground">En attente</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Aucun accès, en attente d'approbation par un administrateur
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}