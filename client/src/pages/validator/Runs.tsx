import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Filter, 
  Eye, 
  Calendar,
  FileText,
  CheckCircle,
  Loader,
  AlertTriangle,
  XCircle
} from "lucide-react";
import client from "@/api/client";

interface ValidationRun {
  id: string;
  fileName: string;
  status: string;
  totalRows: number;
  processedRows: number;
  errorCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function RunsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data: runsData, isLoading } = useQuery({
    queryKey: ["/validations", { search, status: statusFilter, page, pageSize }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      
      if (search) params.append("search", search);
      if (statusFilter) params.append("status", statusFilter);

      const response = await client.get(`/validations?${params}`);
      return response.data;
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "running":
        return <Loader className="w-4 h-4 text-blue-600 animate-spin" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-600" />;
      case "queued":
        return <Loader className="w-4 h-4 text-gray-600" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      completed: "default",
      running: "secondary",
      failed: "destructive",
      queued: "outline",
    };
    return (
      <Badge variant={variants[status] || "outline"} className="capitalize">
        {status}
      </Badge>
    );
  };

  const getProgressPercentage = (run: ValidationRun) => {
    if (!run.totalRows || run.totalRows === 0) return 0;
    return Math.round((run.processedRows / run.totalRows) * 100);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Page Header */}
      <header className="bg-card border-b border-border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
              Validation Runs
            </h1>
            <p className="text-muted-foreground">
              Monitor and manage your data validation processes
            </p>
          </div>
          <Link href="/validator/upload">
            <Button data-testid="button-new-upload">
              <FileText className="w-4 h-4 mr-2" />
              New Upload
            </Button>
          </Link>
        </div>
      </header>

      {/* Filters */}
      <div className="bg-card border-b border-border p-6">
        <div className="flex items-center space-x-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by filename..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48" data-testid="select-status-filter">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Statuses</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Runs List */}
      <div className="flex-1 p-6 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Card key={index}>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-muted rounded-lg animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded animate-pulse" />
                      <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : runsData?.data?.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium text-foreground mb-2">No validation runs found</h3>
              <p className="text-muted-foreground mb-4">
                {search || statusFilter 
                  ? "Try adjusting your search criteria or filters" 
                  : "Upload your first CSV file to start validating data"
                }
              </p>
              <Link href="/validator/upload">
                <Button data-testid="button-upload-first">
                  <FileText className="w-4 h-4 mr-2" />
                  Upload File
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {runsData.data.map((run: ValidationRun, index: number) => (
              <Card key={run.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                        {getStatusIcon(run.status)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-1">
                          <h3 className="font-medium text-foreground" data-testid={`text-run-filename-${index}`}>
                            {run.fileName}
                          </h3>
                          {getStatusBadge(run.status)}
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            {new Date(run.createdAt).toLocaleDateString()}
                          </div>
                          {run.totalRows > 0 && (
                            <span>{run.totalRows.toLocaleString()} rows</span>
                          )}
                          {run.errorCount > 0 && (
                            <span className="text-red-600">{run.errorCount} errors</span>
                          )}
                          {run.status === "running" && run.totalRows > 0 && (
                            <span>{getProgressPercentage(run)}% complete</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Link href={`/validator/runs/${run.id}`}>
                        <Button variant="outline" size="sm" data-testid={`button-view-run-${index}`}>
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </Button>
                      </Link>
                    </div>
                  </div>
                  
                  {run.status === "running" && run.totalRows > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{getProgressPercentage(run)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${getProgressPercentage(run)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {/* Pagination */}
            {runsData?.total > pageSize && (
              <div className="flex items-center justify-center space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  data-testid="button-prev-page"
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {Math.ceil(runsData.total / pageSize)}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= Math.ceil(runsData.total / pageSize)}
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
