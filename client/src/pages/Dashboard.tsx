import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  Upload,
  Database,
  Shield,
  Settings
} from "lucide-react";
import client from "@/api/client";
import { useEnabledModules } from "@/api/modules";
import { getModuleConfig, isModuleVisible } from "@/config/modules";

export default function Dashboard() {
  const { user } = useAuth();

  // Fetch enabled modules from API
  const { modules: enabledModules, isLoading } = useEnabledModules();

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
            {isLoading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Chargement des modules...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* Dynamic Module Cards */}
                {enabledModules
                  .filter((module) =>
                    // Exclude settings (handled separately below)
                    module.name !== "settings" &&
                    // Check module visibility based on user role
                    isModuleVisible(module.name, module.enabled, user?.role)
                  )
                  .map((module) => {
                    const config = getModuleConfig(module.name);
                    if (!config) return null;

                    const Icon = config.icon;

                    // Special handling for validateur module
                    if (module.name === "validateur") {
                      return (
                        <Card key={module.name} className="hover:shadow-lg transition-shadow">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Icon className="w-5 h-5 text-primary" />
                              {config.displayName}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                              {config.description}
                            </p>
                            <Link href="/validator/upload">
                              <Button className="w-full" data-testid="button-upload-validate">
                                <Upload className="w-4 h-4 mr-2" />
                                Télécharger un fichier
                              </Button>
                            </Link>
                            <Link href={config.route}>
                              <Button variant="outline" className="w-full">
                                Voir le module complet
                              </Button>
                            </Link>
                          </CardContent>
                        </Card>
                      );
                    }

                    // Special handling for database module
                    if (module.name === "database") {
                      return (
                        <Card key={module.name} className="hover:shadow-lg transition-shadow">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Icon className="w-5 h-5 text-primary" />
                              {config.displayName}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                              {config.description}
                            </p>
                            <Link href="/database/codes">
                              <Button className="w-full">
                                <Icon className="w-4 h-4 mr-2" />
                                Gérer les codes
                              </Button>
                            </Link>
                            <Link href={config.route}>
                              <Button variant="outline" className="w-full">
                                Voir le module complet
                              </Button>
                            </Link>
                          </CardContent>
                        </Card>
                      );
                    }

                    // Special handling for administration module
                    if (module.name === "administration") {
                      return (
                        <Card key={module.name} className="hover:shadow-lg transition-shadow">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Icon className="w-5 h-5 text-primary" />
                              {config.displayName}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                              {config.description}
                            </p>
                            <Link href="/admin/users">
                              <Button className="w-full">
                                <Icon className="w-4 h-4 mr-2" />
                                Gérer les utilisateurs
                              </Button>
                            </Link>
                            <Link href={config.route}>
                              <Button variant="outline" className="w-full">
                                Voir le module complet
                              </Button>
                            </Link>
                          </CardContent>
                        </Card>
                      );
                    }

                    // Generic module card for other modules
                    return (
                      <Card key={module.name} className="hover:shadow-lg transition-shadow">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Icon className="w-5 h-5 text-primary" />
                            {config.displayName}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <p className="text-sm text-muted-foreground">
                            {config.description}
                          </p>
                          <Link href={config.route}>
                            <Button className="w-full">
                              <Icon className="w-4 h-4 mr-2" />
                              Accéder au module
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>
                    );
                  })}

                {/* Paramètres Card - Always visible */}
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}
