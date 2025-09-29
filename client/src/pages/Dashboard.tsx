import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  Upload
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
    compressedValidator: "Validateur Compact - GitHub Actions Test"
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
        {/* Compressed Validator Module */}
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">{translations.compressedValidator}</CardTitle>
            </CardHeader>
            <CardContent className="text-center py-8">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">{translations.uploadFirstFile}</h3>
              <p className="text-muted-foreground mb-6">Commencez par télécharger un fichier CSV pour validation</p>
              <Link href="/validator/upload">
                <Button className="w-full" data-testid="button-upload-validate">
                  <Upload className="w-5 h-5 mr-2" />
                  {translations.uploadAndValidate}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
