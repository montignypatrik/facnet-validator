import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, DollarSign, Clock, FileText, Filter } from "lucide-react";
import client from "@/api/client";

type BillingFrequency = "monthly" | "quarterly";
type BillingStatus = "pending" | "completed" | "skipped";

interface BillingRule {
  id: string;
  code: string;
  description: string;
  frequency: BillingFrequency;
  gmfHours?: number;
  amount?: number;
  active: boolean;
}

interface AutomaticBilling {
  rules?: BillingRule[];
}

interface Doctor {
  id: string;
  name: string;
  automaticBilling?: AutomaticBilling;
}

interface BillingItem {
  doctorId: string;
  doctorName: string;
  rule: BillingRule;
  period: string;
  status: BillingStatus;
}

const frequencyLabels: Record<BillingFrequency, string> = {
  monthly: "Mensuel",
  quarterly: "Trimestriel",
};

const statusLabels: Record<BillingStatus, string> = {
  pending: "En attente",
  completed: "Complété",
  skipped: "Ignoré",
};

const statusColors: Record<BillingStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  skipped: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

// Helper to get current period
const getCurrentPeriod = (frequency: BillingFrequency): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  if (frequency === "monthly") {
    return `${year}-${month.toString().padStart(2, "0")}`;
  } else {
    const quarter = Math.ceil(month / 3);
    return `${year}-Q${quarter}`;
  }
};

export default function BillingRepository() {
  const [periodFilter, setPeriodFilter] = useState<string>("current");
  const [frequencyFilter, setFrequencyFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [billingStatuses, setBillingStatuses] = useState<Record<string, BillingStatus>>({});

  // Fetch all doctors
  const { data: doctorsData, isLoading } = useQuery({
    queryKey: ["/doctors"],
    queryFn: async () => {
      const response = await client.get("/doctors?pageSize=1000");
      return response.data;
    },
  });

  // Generate billing items from doctors' automatic billing rules
  const generateBillingItems = (): BillingItem[] => {
    if (!doctorsData?.data) return [];

    const items: BillingItem[] = [];
    const currentMonth = getCurrentPeriod("monthly");
    const currentQuarter = getCurrentPeriod("quarterly");

    doctorsData.data.forEach((doctor: Doctor) => {
      if (!doctor.automaticBilling?.rules) return;

      doctor.automaticBilling.rules.forEach((rule: BillingRule) => {
        if (!rule.active) return;

        const period = rule.frequency === "monthly" ? currentMonth : currentQuarter;
        const itemKey = `${doctor.id}-${rule.id}-${period}`;

        items.push({
          doctorId: doctor.id,
          doctorName: doctor.name,
          rule,
          period,
          status: billingStatuses[itemKey] || "pending",
        });
      });
    });

    return items;
  };

  const billingItems = generateBillingItems();

  // Apply filters
  const filteredItems = billingItems.filter((item) => {
    if (frequencyFilter && item.rule.frequency !== frequencyFilter) return false;
    if (statusFilter) {
      const itemKey = `${item.doctorId}-${item.rule.id}-${item.period}`;
      const status = billingStatuses[itemKey] || "pending";
      if (status !== statusFilter) return false;
    }
    return true;
  });

  const toggleStatus = (item: BillingItem) => {
    const itemKey = `${item.doctorId}-${item.rule.id}-${item.period}`;
    const currentStatus = billingStatuses[itemKey] || "pending";
    const newStatus: BillingStatus = currentStatus === "pending" ? "completed" : "pending";

    setBillingStatuses({
      ...billingStatuses,
      [itemKey]: newStatus,
    });
  };

  // Calculate statistics
  const totalGmfHours = filteredItems.reduce((sum, item) => sum + (item.rule.gmfHours || 0), 0);
  const totalAmount = filteredItems.reduce((sum, item) => sum + (item.rule.amount || 0), 0);
  const pendingCount = filteredItems.filter((item) => {
    const itemKey = `${item.doctorId}-${item.rule.id}-${item.period}`;
    return (billingStatuses[itemKey] || "pending") === "pending";
  }).length;

  const clearFilters = () => {
    setFrequencyFilter("");
    setStatusFilter("");
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
              <FileText className="w-8 h-8" />
              Facturation Automatique
            </h1>
            <p className="text-muted-foreground mt-1">
              Gérez et suivez toutes vos facturations automatiques et heures GMF
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right space-y-1">
              <div className="text-sm text-muted-foreground">Total Heures GMF</div>
              <div className="text-2xl font-bold text-foreground">{totalGmfHours}h</div>
            </div>
            <div className="text-right space-y-1">
              <div className="text-sm text-muted-foreground">Total Montant</div>
              <div className="text-2xl font-bold text-foreground">{totalAmount.toFixed(2)}$</div>
            </div>
            <div className="text-right space-y-1">
              <div className="text-sm text-muted-foreground">En attente</div>
              <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filtres
              </CardTitle>
              {(frequencyFilter || statusFilter) && (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Effacer les filtres
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Période</label>
                <Select value={periodFilter} onValueChange={setPeriodFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Période courante</SelectItem>
                    <SelectItem value="next">Période suivante</SelectItem>
                    <SelectItem value="all">Toutes les périodes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Fréquence</label>
                <Select
                  value={frequencyFilter || "all"}
                  onValueChange={(value) => setFrequencyFilter(value === "all" ? "" : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    <SelectItem value="monthly">Mensuel</SelectItem>
                    <SelectItem value="quarterly">Trimestriel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Statut</label>
                <Select
                  value={statusFilter || "all"}
                  onValueChange={(value) => setStatusFilter(value === "all" ? "" : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tous" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="pending">En attente</SelectItem>
                    <SelectItem value="completed">Complété</SelectItem>
                    <SelectItem value="skipped">Ignoré</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Billing Items */}
        <Card>
          <CardContent className="p-0">
            {filteredItems.length > 0 ? (
              <div className="divide-y divide-border">
                {filteredItems.map((item) => {
                  const itemKey = `${item.doctorId}-${item.rule.id}-${item.period}`;
                  const status = billingStatuses[itemKey] || "pending";

                  return (
                    <div
                      key={itemKey}
                      className="p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <Checkbox
                            checked={status === "completed"}
                            onCheckedChange={() => toggleStatus(item)}
                          />
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">{item.doctorName}</span>
                              <Badge variant="outline">{item.rule.code}</Badge>
                              <span className="text-sm text-muted-foreground">{item.rule.description}</span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                <span>{frequencyLabels[item.rule.frequency]}</span>
                                <span>({item.period})</span>
                              </div>
                              {item.rule.gmfHours && (
                                <div className="flex items-center gap-1">
                                  <Clock className="w-4 h-4" />
                                  <span>{item.rule.gmfHours}h GMF</span>
                                </div>
                              )}
                              {item.rule.amount && (
                                <div className="flex items-center gap-1">
                                  <DollarSign className="w-4 h-4" />
                                  <span>{item.rule.amount.toFixed(2)}$</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <Badge className={statusColors[status]}>
                          {statusLabels[status]}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">Aucune facturation automatique</p>
                <p className="text-sm">
                  {frequencyFilter || statusFilter
                    ? "Aucune facturation ne correspond aux filtres sélectionnés"
                    : "Configurez des règles de facturation automatique dans les profils des médecins"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
