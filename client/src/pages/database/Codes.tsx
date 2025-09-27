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
  code: string;
  description: string;
  category?: string;
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
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedCode, setSelectedCode] = useState<Code | null>(null);

  const { data: codesData, isLoading } = useQuery({
    queryKey: ["/codes", { search, page, pageSize: 50 }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: "50",
      });
      if (search) params.append("search", search);

      const response = await client.get(`/codes?${params}`);
      return response.data;
    },
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
    mutationFn: async ({ code, data }: { code: string; data: any }) => {
      const response = await client.patch(`/codes/${code}`, data);
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
    mutationFn: async (code: string) => {
      await client.delete(`/codes/${code}`);
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

      const response = await client.post(`/codes:import?${params}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    },
  });

  const handleEdit = (code: Code) => {
    setSelectedCode(code);
    setShowEditDialog(true);
  };

  const handleDelete = (code: Code) => {
    if (confirm(`Are you sure you want to delete code "${code.code}"?`)) {
      deleteMutation.mutate(code.code);
    }
  };

  const handleExport = async () => {
    try {
      const response = await client.get("/codes:export", {
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

  const columns = [
    {
      key: "code",
      label: "Code",
    },
    {
      key: "description", 
      label: "Description",
    },
    {
      key: "category",
      label: "Category",
      render: (value: string) => value || "-",
    },
    {
      key: "active",
      label: "Active",
      type: "boolean" as const,
    },
    {
      key: "updatedAt",
      label: "Last Updated",
      type: "date" as const,
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
              onSearchChange={setSearch}
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
              onSubmit={(data) => updateMutation.mutate({ code: selectedCode.code, data })}
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
