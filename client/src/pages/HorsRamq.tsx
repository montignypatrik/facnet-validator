import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, DollarSign } from "lucide-react";

export default function HorsRamq() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Page Header */}
      <header className="bg-card border-b border-border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Hors-RAMQ</h1>
            <p className="text-muted-foreground">
              Facturation étendue au-delà de la RAMQ
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
                <FileText className="w-6 h-6" />
                Module Hors-RAMQ
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center py-8">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <DollarSign className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-xl font-medium text-foreground mb-3">
                Fonctionnalité à venir
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Le module Hors-RAMQ sera bientôt disponible. Il vous permettra de gérer la
                facturation pour les services médicaux non couverts par la RAMQ.
              </p>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p className="flex items-center justify-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full"></span>
                  Gestion des services privés
                </p>
                <p className="flex items-center justify-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full"></span>
                  Facturation directe aux patients
                </p>
                <p className="flex items-center justify-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full"></span>
                  Suivi des paiements et reçus
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