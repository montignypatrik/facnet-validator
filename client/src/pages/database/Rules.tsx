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

interface Rule {
  id: string;
  name: string;
  condition: any;
  threshold?: number;
  enabled: boolean;
  customFields: Record<string, any>;
  updatedAt: string;
  updatedBy?: string;
}

export default function RulesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);

  const { data: rulesData, isLoading } = useQuery({
    queryKey: ["/rules", { search, page, pageSize: 50 }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: "50",
      });
      if (search) params.append("search", search);

      const response = await client.get(`/rules?${params}`);
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await client.post("/rules", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/rules"] });
      setShowAddDialog(false);
      toast({
        title: "Success",
        description: "Rule created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to create rule",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await client.patch(`/rules/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/rules"] });
      setShowEditDialog(false);
      setSelectedRule(null);
      toast({
        title: "Success",
        description: "Rule updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to update rule",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await client.delete(`/rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/rules"] });
      toast({
        title: "Success",
        description: "Rule deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to delete rule",
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

      const response = await client.post(`/rules/import?${params}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === "/rules" 
      });
    },
  });

  const handleEdit = (rule: Rule) => {
    // Convert condition object back to JSON string for editing
    const editableRule = {
      ...rule,
      condition: typeof rule.condition === 'object' 
        ? JSON.stringify(rule.condition, null, 2)
        : rule.condition
    };
    setSelectedRule(editableRule);
    setShowEditDialog(true);
  };

  const handleDelete = (rule: Rule) => {
    if (confirm(`Are you sure you want to delete rule "${rule.name}"?`)) {
      deleteMutation.mutate(rule.id);
    }
  };

  const handleExport = async () => {
    try {
      const response = await client.get("/rules/export", {
        responseType: "blob",
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "rules_export.csv");
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
      key: "condition", 
      label: "Condition",
      render: (value: any) => (
        <code className="text-xs bg-muted px-2 py-1 rounded max-w-[200px] block truncate">
          {typeof value === 'object' ? JSON.stringify(value) : value}
        </code>
      ),
    },
    {
      key: "threshold",
      label: "Threshold",
      render: (value: number) => value?.toString() || "-",
    },
    {
      key: "enabled",
      label: "Enabled",
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
              Rules
            </h1>
            <p className="text-muted-foreground">
              Manage validation rules and business logic
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" data-testid="text-record-count">
              {rulesData?.total || 0} records
            </Badge>
          </div>
        </div>
      </header>

      {/* Rules Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <Card>
          <CardContent className="p-6">
            <DataTable
              data={rulesData?.data || []}
              columns={columns}
              loading={isLoading}
              onAdd={() => setShowAddDialog(true)}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onImport={() => setShowImportDialog(true)}
              onExport={handleExport}
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ["/rules"] })}
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
            <DialogTitle>Add New Rule</DialogTitle>
          </DialogHeader>
          <DynamicForm
            tableName="rules"
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
            <DialogTitle>Edit Rule</DialogTitle>
          </DialogHeader>
          {selectedRule && (
            <DynamicForm
              tableName="rules"
              initialData={selectedRule}
              onSubmit={(data) => updateMutation.mutate({ id: selectedRule.id, data })}
              onCancel={() => {
                setShowEditDialog(false);
                setSelectedRule(null);
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
        tableName="rules"
        onImport={importMutation.mutateAsync}
      />
    </div>
  );
}
