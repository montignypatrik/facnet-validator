import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  Upload,
  ShieldCheck,
  MessageSquare,
  CheckSquare,
  FileText,
  Database,
  Shield,
  Settings
} from "lucide-react";
import client from "@/api/client";

export default function Dashboard() {
  const { user } = useAuth();

  // French translations
  const translations = {
    pageTitle: "Tableau de Bord",
    greeting: "Bonjour",
    uploadAndValidate: "Télécharger et Valider",
    uploadFirstFile: "Téléchargez votre premier fichier CSV pour commencer à valider les données de santé du Québec",
    uploadFile: "Télécharger un Fichier",
    compressedValidator: "Validateur Compact"
  };


  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Page Header */}
      <header className="bg-card border-b border-border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">{translations.pageTitle}</h1>
            <p className="text-muted-foreground">
              {translations.greeting} {user?.name?.split(' ')[0] || 'Utilisateur'}
            </p>
          </div>
        </div>
      </header>

      {/* Dashboard Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        {user?.role === "pending" ? (
          /* Pending Access Message */
          <div className="max-w-md mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-center">Accès en attente</CardTitle>
              </CardHeader>
              <CardContent className="text-center py-8">
                <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">⏳</span>
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">Votre compte est en attente d'activation</h3>
                <p className="text-muted-foreground mb-6">
                  Un administrateur doit approuver votre accès. Vous serez notifié par courriel une fois votre compte activé.
                </p>
                <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800">
                  Statut: En attente
                </Badge>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Module Cards Grid */
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

              {/* Validateur Card */}
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    Validateur
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Validation des données de facturation RAMQ du Québec
                  </p>
                  <Link href="/validator/upload">
                    <Button className="w-full" data-testid="button-upload-validate">
                      <Upload className="w-4 h-4 mr-2" />
                      Télécharger un fichier
                    </Button>
                  </Link>
                  <Link href="/validator">
                    <Button variant="outline" className="w-full">
                      Voir le module complet
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Chatbot Card */}
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-primary" />
                    Chatbot
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Assistant intelligent pour répondre à vos questions
                  </p>
                  <Button className="w-full" disabled>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Démarrer une conversation
                  </Button>
                  <Link href="/chatbot">
                    <Button variant="outline" className="w-full">
                      Voir le module complet
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Tâche Card */}
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckSquare className="w-5 h-5 text-primary" />
                    Tâche
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Gestion de tâches et workflows pour votre équipe
                  </p>
                  <Button className="w-full" disabled>
                    <CheckSquare className="w-4 h-4 mr-2" />
                    Créer une tâche
                  </Button>
                  <Link href="/tache">
                    <Button variant="outline" className="w-full">
                      Voir le module complet
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Hors-RAMQ Card */}
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Hors-RAMQ
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Facturation des services médicaux non couverts par la RAMQ
                  </p>
                  <Button className="w-full" disabled>
                    <FileText className="w-4 h-4 mr-2" />
                    Créer une facture
                  </Button>
                  <Link href="/hors-ramq">
                    <Button variant="outline" className="w-full">
                      Voir le module complet
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Base de Données Card */}
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-primary" />
                    Base de Données
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Gestion des codes, contextes, établissements et règles
                  </p>
                  <Link href="/database/codes">
                    <Button className="w-full">
                      <Database className="w-4 h-4 mr-2" />
                      Gérer les codes
                    </Button>
                  </Link>
                  <Link href="/database">
                    <Button variant="outline" className="w-full">
                      Voir le module complet
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Administration Card - Only for admins */}
              {user?.role === "admin" && (
                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-primary" />
                      Administration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Gestion des utilisateurs et des permissions
                    </p>
                    <Link href="/admin/users">
                      <Button className="w-full">
                        <Shield className="w-4 h-4 mr-2" />
                        Gérer les utilisateurs
                      </Button>
                    </Link>
                    <Link href="/admin">
                      <Button variant="outline" className="w-full">
                        Voir le module complet
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )}

              {/* Paramètres Card */}
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary" />
                    Paramètres
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Configuration du système et personnalisation
                  </p>
                  <Link href="/settings">
                    <Button className="w-full">
                      <Settings className="w-4 h-4 mr-2" />
                      Configurer
                    </Button>
                  </Link>
                  <Link href="/settings">
                    <Button variant="outline" className="w-full">
                      Voir le module complet
                    </Button>
                  </Link>
                </CardContent>
              </Card>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
