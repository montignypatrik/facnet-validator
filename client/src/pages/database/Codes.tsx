import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DataTable } from "@/components/DataTable";
import { ImportDialog } from "@/components/ImportDialog";
import { DynamicForm } from "@/components/DynamicForm";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import client from "@/api/client";

interface Code {
  id: string;
  code: string;
  description: string;
  category?: string;
  place?: string;
  tariffValue?: number;
  extraUnitValue?: number;
  unitRequire?: boolean;
  sourceFile?: string;
  topLevel?: string;
  level1Group?: string;
  level2Group?: string;
  leaf?: string;
  indicators?: string;
  anchorId?: string;
  active: boolean;
  customFields: Record<string, any>;
  updatedAt: string;
  updatedBy?: string;
}

export default function CodesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedCode, setSelectedCode] = useState<Code | null>(null);

  const { data: codesData, isLoading } = useQuery({
    queryKey: ["/codes", { search, page, pageSize, columnFilters }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search) params.append("search", search);

      // Add column filters to query params
      Object.entries(columnFilters).forEach(([key, values]) => {
        if (values && values.length > 0) {
          params.append(`filter[${key}]`, values.join(','));
        }
      });

      const response = await client.get(`/codes?${params}`);
      return response.data;
    },
  });

  // Fetch distinct values for filter columns
  // Map frontend camelCase column names to database snake_case column names
  const filterColumns: Record<string, string> = {
    category: "category",
    place: "place",
    sourceFile: "source_file",
    topLevel: "top_level",
    level1Group: "level1_group",
    level2Group: "level2_group",
    leaf: "leaf",
    indicators: "indicators",
    active: "active",
    unitRequire: "unit_require",
  };

  const { data: distinctValuesData } = useQuery({
    queryKey: ["/codes/distinct", { search }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);

      const distinctValues: Record<string, string[]> = {};

      // Fetch distinct values for all filter columns in parallel
      await Promise.all(
        Object.entries(filterColumns).map(async ([frontendKey, dbColumn]) => {
          try {
            const response = await client.get(`/codes/distinct/${dbColumn}?${params}`);
            // Store with frontend key for DataTable
            distinctValues[frontendKey] = response.data.values || [];
          } catch (error) {
            console.error(`Failed to fetch distinct values for ${dbColumn}:`, error);
            distinctValues[frontendKey] = [];
          }
        })
      );

      return distinctValues;
    },
    enabled: !isLoading, // Only fetch after codes data is loaded
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await client.post("/codes", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/codes"] });
      setShowAddDialog(false);
      toast({
        title: "Success",
        description: "Code created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to create code",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await client.patch(`/codes/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/codes"] });
      setShowEditDialog(false);
      setSelectedCode(null);
      toast({
        title: "Success",
        description: "Code updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to update code",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await client.delete(`/codes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/codes"] });
      toast({
        title: "Success",
        description: "Code deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to delete code",
        variant: "destructive",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (data: { file: File; dryRun: boolean; conflictStrategy: string; autoCreateFields: boolean }) => {
      const formData = new FormData();
      formData.append("file", data.file);

      const params = new URLSearchParams({
        dryRun: data.dryRun.toString(),
        conflictStrategy: data.conflictStrategy,
        autoCreateFields: data.autoCreateFields.toString(),
      });

      const response = await client.post(`/codes/import?${params}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === "/codes" 
      });
    },
  });

  const handleEdit = (code: Code) => {
    setSelectedCode(code);
    setShowEditDialog(true);
  };

  const handleDelete = (code: Code) => {
    if (confirm(`Are you sure you want to delete code "${code.code}"?`)) {
      deleteMutation.mutate(code.id);
    }
  };

  const handleExport = async () => {
    try {
      const response = await client.get("/codes/export", {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "codes_export.csv");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export data",
        variant: "destructive",
      });
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleColumnFiltersChange = (filters: Record<string, string[]>) => {
    setColumnFilters(filters);
    // Reset to page 1 when filters change
    setPage(1);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1); // Reset to first page when changing page size
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1); // Reset to first page when search changes
  };

  const columns = [
    {
      key: "code",
      label: "Code",
      width: 100,
      minWidth: 80,
    },
    {
      key: "description",
      label: "Description",
      width: 300,
      minWidth: 150,
    },
    {
      key: "category",
      label: "Category",
      width: 200,
      minWidth: 100,
      render: (value: string) => value || "-",
    },
    {
      key: "place",
      label: "Place",
      width: 120,
      minWidth: 80,
      render: (value: string) => value || "-",
    },
    {
      key: "tariffValue",
      label: "Tariff Value",
      width: 120,
      minWidth: 100,
      render: (value: string | number) => {
        if (!value) return "-";
        const numValue = typeof value === "string" ? parseFloat(value) : value;
        return isNaN(numValue) ? "-" : `$${numValue.toFixed(2)}`;
      },
    },
    {
      key: "extraUnitValue",
      label: "Extra Unit Value",
      width: 140,
      minWidth: 100,
      render: (value: string | number) => {
        if (!value) return "-";
        const numValue = typeof value === "string" ? parseFloat(value) : value;
        return isNaN(numValue) ? "-" : `$${numValue.toFixed(2)}`;
      },
    },
    {
      key: "unitRequire",
      label: "Unit Required",
      width: 120,
      minWidth: 100,
      type: "boolean" as const,
    },
    {
      key: "sourceFile",
      label: "Source File",
      width: 200,
      minWidth: 150,
      render: (value: string) => value || "-",
    },
    {
      key: "topLevel",
      label: "Top Level",
      width: 200,
      minWidth: 150,
      render: (value: string) => value || "-",
    },
    {
      key: "level1Group",
      label: "Level 1 Group",
      width: 200,
      minWidth: 150,
      render: (value: string) => value || "-",
    },
    {
      key: "level2Group",
      label: "Level 2 Group",
      width: 200,
      minWidth: 150,
      render: (value: string) => value || "-",
    },
    {
      key: "leaf",
      label: "Leaf",
      width: 200,
      minWidth: 150,
      render: (value: string) => value || "-",
    },
    {
      key: "indicators",
      label: "Indicators",
      width: 150,
      minWidth: 100,
      render: (value: string) => value || "-",
    },
    {
      key: "anchorId",
      label: "Anchor ID",
      width: 120,
      minWidth: 100,
      render: (value: string) => value || "-",
    },
    {
      key: "active",
      label: "Active",
      width: 100,
      minWidth: 80,
      type: "boolean" as const,
    },
    {
      key: "updatedAt",
      label: "Last Updated",
      width: 150,
      minWidth: 120,
      type: "date" as const,
    },
    {
      key: "updatedBy",
      label: "Updated By",
      width: 150,
      minWidth: 100,
      render: (value: string) => value || "-",
    },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Page Header */}
      <header className="bg-card border-b border-border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
              Codes
            </h1>
            <p className="text-muted-foreground">
              Manage medical codes and their classifications
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" data-testid="text-record-count">
              {codesData?.total || 0} records
            </Badge>
          </div>
        </div>
      </header>

      {/* Codes Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <Card>
          <CardContent className="p-6">
            <DataTable
              data={codesData?.data || []}
              columns={columns}
              loading={isLoading}
              onAdd={() => setShowAddDialog(true)}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onImport={() => setShowImportDialog(true)}
              onExport={handleExport}
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ["/codes"] })}
              searchValue={search}
              onSearchChange={handleSearchChange}
              columnFilters={columnFilters}
              onColumnFiltersChange={handleColumnFiltersChange}
              distinctValues={distinctValuesData}
              page={page}
              pageSize={pageSize}
              totalRecords={codesData?.total || 0}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          </CardContent>
        </Card>
      </div>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Code</DialogTitle>
          </DialogHeader>
          <DynamicForm
            tableName="codes"
            onSubmit={(data) => createMutation.mutate(data)}
            onCancel={() => setShowAddDialog(false)}
            isLoading={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Code</DialogTitle>
          </DialogHeader>
          {selectedCode && (
            <DynamicForm
              tableName="codes"
              initialData={selectedCode}
              onSubmit={(data) => updateMutation.mutate({ id: selectedCode.id, data })}
              onCancel={() => {
                setShowEditDialog(false);
                setSelectedCode(null);
              }}
              isLoading={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <ImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        tableName="codes"
        onImport={importMutation.mutateAsync}
      />
    </div>
  );
}
