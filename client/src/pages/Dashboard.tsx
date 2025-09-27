import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  FileText,
  DollarSign,
  TrendingUp,
  RefreshCw,
  Plus,
  Upload,
  Download,
  Check,
  Loader,
  AlertTriangle,
  BarChart3,
  Users,
  Building,
  Layers,
  Zap,
  Code,
  FileDown,
} from "lucide-react";
import client from "@/api/client";

export default function Dashboard() {
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ["/analytics/kpis"],
    queryFn: async () => {
      const response = await client.get("/analytics/kpis");
      return response.data;
    },
  });

  const { data: recentRuns, isLoading: runsLoading } = useQuery({
    queryKey: ["/validations?limit=5"],
    queryFn: async () => {
      const response = await client.get("/validations?limit=5");
      return response.data;
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <Check className="w-5 h-5 text-green-600" />;
      case "running":
        return <Loader className="w-5 h-5 text-blue-600 animate-spin" />;
      case "failed":
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      default:
        return <Loader className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      completed: "default",
      running: "secondary",
      failed: "destructive",
    };
    return (
      <Badge variant={variants[status] || "secondary"} className="capitalize">
        {status}
      </Badge>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Page Header */}
      <header className="bg-card border-b border-border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">Dashboard</h1>
            <p className="text-muted-foreground">Overview of your validation and database management</p>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="outline" data-testid="button-refresh">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Link href="/validator/upload">
              <Button data-testid="button-quick-upload">
                <Plus className="w-4 h-4 mr-2" />
                Quick Upload
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Dashboard Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card data-testid="card-invoices-per-day">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-100 dark:bg-blue-950 rounded-lg">
                  <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-sm text-green-600 font-medium">+12.5%</span>
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-1" data-testid="text-invoices-per-day">
                {kpisLoading ? "..." : kpis?.invoicesPerDay?.toLocaleString() || "0"}
              </h3>
              <p className="text-muted-foreground">Invoices per Day</p>
              <div className="mt-4 text-xs text-muted-foreground">
                Last 30 days average
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-avg-invoice-value">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-green-100 dark:bg-green-950 rounded-lg">
                  <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-sm text-green-600 font-medium">+8.2%</span>
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-1" data-testid="text-avg-invoice-value">
                {kpisLoading ? "..." : `$${kpis?.avgInvoiceValue?.toFixed(2) || "0.00"}`}
              </h3>
              <p className="text-muted-foreground">Average Invoice Value</p>
              <div className="mt-4 text-xs text-muted-foreground">
                Compared to last month
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-avg-daily-total">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-amber-100 dark:bg-amber-950 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-sm text-red-600 font-medium">-2.1%</span>
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-1" data-testid="text-avg-daily-total">
                {kpisLoading ? "..." : `$${kpis?.avgDailyTotal?.toLocaleString() || "0"}`}
              </h3>
              <p className="text-muted-foreground">Average Daily Total</p>
              <div className="mt-4 text-xs text-muted-foreground">
                7-day rolling average
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Validation Runs */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Recent Validation Runs</CardTitle>
                  <Link href="/validator/runs">
                    <Button variant="ghost" size="sm" data-testid="link-view-all-runs">
                      View All
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {runsLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className="flex items-center space-x-4 p-4 bg-muted/50 rounded-xl">
                        <div className="w-10 h-10 bg-muted rounded-lg animate-pulse" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-muted rounded animate-pulse" />
                          <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : recentRuns?.data?.length > 0 ? (
                  <div className="space-y-4">
                    {recentRuns.data.map((run: any, index: number) => (
                      <div
                        key={run.id}
                        className="flex items-center justify-between p-4 bg-muted/50 rounded-xl hover:bg-muted transition-colors cursor-pointer"
                        data-testid={`run-item-${index}`}
                      >
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-green-100 dark:bg-green-950 rounded-lg flex items-center justify-center">
                            {getStatusIcon(run.status)}
                          </div>
                          <div>
                            <p className="font-medium text-foreground" data-testid={`text-run-filename-${index}`}>
                              {run.fileName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {run.status} • {run.totalRows || 0} rows • {run.errorCount || 0} issues
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            {new Date(run.createdAt).toLocaleDateString()}
                          </p>
                          {getStatusBadge(run.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <Upload className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground mb-2">No validation runs yet</h3>
                    <p className="text-muted-foreground mb-4">Upload your first CSV file to start validating data</p>
                    <Link href="/validator/upload">
                      <Button data-testid="button-upload-first-file">
                        Upload File
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            {/* Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href="/validator/upload">
                  <Button className="w-full justify-start" data-testid="button-upload-validate">
                    <Upload className="w-5 h-5 mr-3" />
                    Upload & Validate
                  </Button>
                </Link>
                <Button variant="outline" className="w-full justify-start" data-testid="button-export-database">
                  <Download className="w-5 h-5 mr-3" />
                  Export Database
                </Button>
                <Link href="/database/rules">
                  <Button variant="outline" className="w-full justify-start" data-testid="button-create-rule">
                    <Plus className="w-5 h-5 mr-3" />
                    Create Rule
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* System Status */}
            <Card>
              <CardHeader>
                <CardTitle>System Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Database</span>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200">
                    Healthy
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Validation Engine</span>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200">
                    Running
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Storage</span>
                  <Badge variant="outline">
                    78% Used
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Recent Exports */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Exports</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
                  <FileDown className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">codes_export.csv</p>
                    <p className="text-xs text-muted-foreground">2 hours ago</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
                  <FileDown className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">establishments.csv</p>
                    <p className="text-xs text-muted-foreground">1 day ago</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Additional Dashboard Sections */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Validation Analytics Preview */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Validation Analytics</CardTitle>
                <Link href="/validator/analytics">
                  <Button variant="ghost" size="sm" data-testid="link-full-analytics">
                    View Full Analytics
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {/* Simple Chart Placeholder */}
              <div className="h-48 bg-muted/30 rounded-xl flex items-center justify-center">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">Analytics chart would render here</p>
                  <p className="text-sm text-muted-foreground">Daily validation trends</p>
                </div>
              </div>
              
              <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-foreground">98.7%</p>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">1.2M</p>
                  <p className="text-sm text-muted-foreground">Rows Processed</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">23</p>
                  <p className="text-sm text-muted-foreground">Active Rules</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Database Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Database Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Link href="/database/codes">
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl hover:bg-muted transition-colors cursor-pointer" data-testid="card-database-codes">
                  <div className="flex items-center space-x-3">
                    <Code className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-medium text-foreground">Codes</p>
                      <p className="text-sm text-muted-foreground">View and manage codes</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">+124</p>
                    <p className="text-xs text-muted-foreground">This week</p>
                  </div>
                </div>
              </Link>

              <Link href="/database/establishments">
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl hover:bg-muted transition-colors cursor-pointer" data-testid="card-database-establishments">
                  <div className="flex items-center space-x-3">
                    <Building className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-medium text-foreground">Establishments</p>
                      <p className="text-sm text-muted-foreground">View and manage establishments</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">+18</p>
                    <p className="text-xs text-muted-foreground">This week</p>
                  </div>
                </div>
              </Link>

              <Link href="/database/contexts">
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl hover:bg-muted transition-colors cursor-pointer" data-testid="card-database-contexts">
                  <div className="flex items-center space-x-3">
                    <Layers className="w-5 h-5 text-purple-600" />
                    <div>
                      <p className="font-medium text-foreground">Contexts</p>
                      <p className="text-sm text-muted-foreground">View and manage contexts</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">+7</p>
                    <p className="text-xs text-muted-foreground">This week</p>
                  </div>
                </div>
              </Link>

              <Link href="/database/rules">
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl hover:bg-muted transition-colors cursor-pointer" data-testid="card-database-rules">
                  <div className="flex items-center space-x-3">
                    <Zap className="w-5 h-5 text-amber-600" />
                    <div>
                      <p className="font-medium text-foreground">Rules</p>
                      <p className="text-sm text-muted-foreground">View and manage rules</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">+3</p>
                    <p className="text-xs text-muted-foreground">This week</p>
                  </div>
                </div>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
