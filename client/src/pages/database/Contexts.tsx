import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DataTable } from "@/components/DataTable";
import { ImportDialog } from "@/components/ImportDialog";
import { DynamicForm } from "@/components/DynamicForm";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import client from "@/api/client";

interface Context {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  customFields: Record<string, any>;
  updatedAt: string;
  updatedBy?: string;
}

export default function ContextsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedContext, setSelectedContext] = useState<Context | null>(null);

  const { data: contextsData, isLoading } = useQuery({
    queryKey: ["/contexts", { search, page, pageSize: 50 }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: "50",
      });
      if (search) params.append("search", search);

      const response = await client.get(`/contexts?${params}`);
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await client.post("/contexts", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/contexts"] });
      setShowAddDialog(false);
      toast({
        title: "Success",
        description: "Context created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to create context",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await client.patch(`/contexts/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/contexts"] });
      setShowEditDialog(false);
      setSelectedContext(null);
      toast({
        title: "Success",
        description: "Context updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to update context",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await client.delete(`/contexts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/contexts"] });
      toast({
        title: "Success",
        description: "Context deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to delete context",
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

      const response = await client.post(`/contexts/import?${params}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === "/contexts" 
      });
    },
  });

  const handleEdit = (context: Context) => {
    setSelectedContext(context);
    setShowEditDialog(true);
  };

  const handleDelete = (context: Context) => {
    if (confirm(`Are you sure you want to delete context "${context.name}"?`)) {
      deleteMutation.mutate(context.id);
    }
  };

  const handleExport = async () => {
    try {
      const response = await client.get("/contexts/export", {
        responseType: "blob",
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "contexts_export.csv");
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
      key: "name",
      label: "Name",
    },
    {
      key: "description", 
      label: "Description",
      render: (value: string) => value || "-",
    },
    {
      key: "tags",
      label: "Tags",
      render: (value: string[]) => {
        if (!value || value.length === 0) return "-";
        return (
          <div className="flex flex-wrap gap-1">
            {value.slice(0, 3).map((tag, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {value.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{value.length - 3}
              </Badge>
            )}
          </div>
        );
      },
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
              Contexts
            </h1>
            <p className="text-muted-foreground">
              Manage data contexts and their classifications
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" data-testid="text-record-count">
              {contextsData?.total || 0} records
            </Badge>
          </div>
        </div>
      </header>

      {/* Contexts Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <Card>
          <CardContent className="p-6">
            <DataTable
              data={contextsData?.data || []}
              columns={columns}
              loading={isLoading}
              onAdd={() => setShowAddDialog(true)}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onImport={() => setShowImportDialog(true)}
              onExport={handleExport}
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ["/contexts"] })}
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
            <DialogTitle>Add New Context</DialogTitle>
          </DialogHeader>
          <DynamicForm
            tableName="contexts"
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
            <DialogTitle>Edit Context</DialogTitle>
          </DialogHeader>
          {selectedContext && (
            <DynamicForm
              tableName="contexts"
              initialData={selectedContext}
              onSubmit={(data) => updateMutation.mutate({ id: selectedContext.id, data })}
              onCancel={() => {
                setShowEditDialog(false);
                setSelectedContext(null);
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
        tableName="contexts"
        onImport={importMutation.mutateAsync}
      />
    </div>
  );
}
