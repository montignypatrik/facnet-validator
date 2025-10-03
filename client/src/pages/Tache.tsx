import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckSquare, ListTodo } from "lucide-react";

export default function Tache() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Page Header */}
      <header className="bg-card border-b border-border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tâche</h1>
            <p className="text-muted-foreground">
              Gestion des tâches et workflows
            </p>
          </div>
        </div>
      </header>

      {/* Page Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-center flex items-center justify-center gap-2">
                <CheckSquare className="w-6 h-6" />
                Module Tâche
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center py-8">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <ListTodo className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-xl font-medium text-foreground mb-3">
                Fonctionnalité à venir
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Le module Tâche sera bientôt disponible. Il vous permettra de gérer vos tâches,
                projets et workflows de manière efficace et collaborative.
              </p>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p className="flex items-center justify-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full"></span>
                  Création et suivi de tâches
                </p>
                <p className="flex items-center justify-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full"></span>
                  Gestion de projets et workflows
                </p>
                <p className="flex items-center justify-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full"></span>
                  Collaboration d'équipe en temps réel
                </p>
              </div>
              <div className="mt-8">
                <Button variant="outline" disabled>
                  En développement
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
