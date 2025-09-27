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

interface Establishment {
  id: string;
  name: string;
  type?: string;
  region?: string;
  active: boolean;
  notes?: string;
  customFields: Record<string, any>;
  updatedAt: string;
  updatedBy?: string;
}

export default function EstablishmentsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedEstablishment, setSelectedEstablishment] = useState<Establishment | null>(null);

  const { data: establishmentsData, isLoading } = useQuery({
    queryKey: ["/establishments", { search, page, pageSize: 50 }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: "50",
      });
      if (search) params.append("search", search);

      const response = await client.get(`/establishments?${params}`);
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await client.post("/establishments", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/establishments"] });
      setShowAddDialog(false);
      toast({
        title: "Success",
        description: "Establishment created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to create establishment",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await client.patch(`/establishments/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/establishments"] });
      setShowEditDialog(false);
      setSelectedEstablishment(null);
      toast({
        title: "Success",
        description: "Establishment updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to update establishment",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await client.delete(`/establishments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/establishments"] });
      toast({
        title: "Success",
        description: "Establishment deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to delete establishment",
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

      const response = await client.post(`/establishments/import?${params}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === "/establishments" 
      });
    },
  });

  const handleEdit = (establishment: Establishment) => {
    setSelectedEstablishment(establishment);
    setShowEditDialog(true);
  };

  const handleDelete = (establishment: Establishment) => {
    if (confirm(`Are you sure you want to delete establishment "${establishment.name}"?`)) {
      deleteMutation.mutate(establishment.id);
    }
  };

  const handleExport = async () => {
    try {
      const response = await client.get("/establishments/export", {
        responseType: "blob",
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "establishments_export.csv");
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
      key: "type", 
      label: "Type",
      render: (value: string) => value || "-",
    },
    {
      key: "region",
      label: "Region",
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
              Establishments
            </h1>
            <p className="text-muted-foreground">
              Manage healthcare establishments and facilities
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" data-testid="text-record-count">
              {establishmentsData?.total || 0} records
            </Badge>
          </div>
        </div>
      </header>

      {/* Establishments Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <Card>
          <CardContent className="p-6">
            <DataTable
              data={establishmentsData?.data || []}
              columns={columns}
              loading={isLoading}
              onAdd={() => setShowAddDialog(true)}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onImport={() => setShowImportDialog(true)}
              onExport={handleExport}
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ["/establishments"] })}
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
            <DialogTitle>Add New Establishment</DialogTitle>
          </DialogHeader>
          <DynamicForm
            tableName="establishments"
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
            <DialogTitle>Edit Establishment</DialogTitle>
          </DialogHeader>
          {selectedEstablishment && (
            <DynamicForm
              tableName="establishments"
              initialData={selectedEstablishment}
              onSubmit={(data) => updateMutation.mutate({ id: selectedEstablishment.id, data })}
              onCancel={() => {
                setShowEditDialog(false);
                setSelectedEstablishment(null);
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
        tableName="establishments"
        onImport={importMutation.mutateAsync}
      />
    </div>
  );
}
