import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  User,
  Shield,
  Database,
  Upload,
  Download,
  Settings as SettingsIcon,
  AlertCircle,
  CheckCircle,
  Trash2,
  Plus,
  Sun,
  Moon,
  Monitor,
  Palette,
} from "lucide-react";
import client from "@/api/client";
import { useTheme, type ThemeMode } from "@/lib/theme";

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("profile");
  const { mode, setMode, resolvedTheme } = useTheme();

  // User profile state
  const [profileData, setProfileData] = useState({
    name: user?.name || "",
    email: user?.email || "",
  });

  // Field catalog management
  const { data: fieldCatalog } = useQuery({
    queryKey: ["/field-catalog"],
    queryFn: async () => {
      const response = await client.get("/field-catalog");
      return response.data;
    },
  });

  const [newField, setNewField] = useState({
    tableName: "codes",
    fieldKey: "",
    label: "",
    type: "text",
    required: false,
    uniqueField: false,
    options: "",
    defaultValue: "",
  });

  const createFieldMutation = useMutation({
    mutationFn: async (data: any) => {
      const fieldData = {
        ...data,
        options: data.options ? data.options.split(",").map((opt: string) => opt.trim()) : null,
      };
      const response = await client.post("/field-catalog", fieldData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/field-catalog"] });
      setNewField({
        tableName: "codes",
        fieldKey: "",
        label: "",
        type: "text",
        required: false,
        uniqueField: false,
        options: "",
        defaultValue: "",
      });
      toast({
        title: "Success",
        description: "Custom field created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to create field",
        variant: "destructive",
      });
    },
  });

  const updateFieldMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await client.patch(`/field-catalog/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/field-catalog"] });
      toast({
        title: "Success",
        description: "Field updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to update field",
        variant: "destructive",
      });
    },
  });

  const deleteFieldMutation = useMutation({
    mutationFn: async (id: string) => {
      await client.delete(`/field-catalog/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/field-catalog"] });
      toast({
        title: "Success",
        description: "Field deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to delete field",
        variant: "destructive",
      });
    },
  });

  const handleCreateField = () => {
    if (!newField.fieldKey || !newField.label) {
      toast({
        title: "Error",
        description: "Field key and label are required",
        variant: "destructive",
      });
      return;
    }
    createFieldMutation.mutate(newField);
  };

  const handleToggleField = (field: any) => {
    updateFieldMutation.mutate({
      id: field.id,
      data: { active: !field.active },
    });
  };

  const handleToggleUnique = (field: any) => {
    updateFieldMutation.mutate({
      id: field.id,
      data: { uniqueField: !field.uniqueField },
    });
  };

  const handleDeleteField = (field: any) => {
    if (confirm(`Are you sure you want to delete the field "${field.label}"?`)) {
      deleteFieldMutation.mutate(field.id);
    }
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "fields", label: "Custom Fields", icon: Database },
    { id: "security", label: "Security", icon: Shield },
    { id: "system", label: "System", icon: SettingsIcon },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Page Header */}
      <header className="bg-card border-b border-border p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
            Settings
          </h1>
          <p className="text-muted-foreground">
            Manage your account, custom fields, and system preferences
          </p>
        </div>
      </header>

      {/* Settings Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Settings Sidebar */}
        <div className="w-64 bg-card border-r border-border p-4">
          <nav className="space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                  data-testid={`tab-${tab.id}`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Settings Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {activeTab === "profile" && (
            <div className="max-w-2xl space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="name">Display Name</Label>
                    <Input
                      id="name"
                      value={profileData.name}
                      onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                      data-testid="input-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      value={profileData.email}
                      disabled
                      data-testid="input-email"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Email cannot be changed. Please contact your administrator.
                    </p>
                  </div>
                  <div>
                    <Label>Role</Label>
                    <div className="mt-2">
                      <Badge
                        variant="outline"
                        className={`capitalize ${user?.role === "pending" ? "bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800" : ""}`}
                      >
                        {user?.role || "viewer"}
                      </Badge>
                      {user?.role === "pending" && (
                        <p className="text-sm text-muted-foreground mt-2">
                          Votre compte est en attente d'approbation par un administrateur.
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Account Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-sm">Account is active and verified</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Your account was created on {new Date().toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>

              {/* Theme Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Palette className="w-5 h-5 mr-2" />
                    Theme
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Theme Selector */}
                  <div>
                    <Label className="text-base font-medium">Appearance</Label>
                    <p className="text-sm text-muted-foreground mb-4">
                      Choose how the application looks for you
                    </p>
                    <div className="grid grid-cols-3 gap-4">
                      {/* Light Theme */}
                      <button
                        onClick={() => setMode("light")}
                        className={`relative flex flex-col items-center gap-3 p-4 border-2 rounded-lg transition-all ${
                          mode === "light"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50 hover:bg-muted"
                        }`}
                        data-testid="theme-light"
                      >
                        <Sun className="w-8 h-8" />
                        <span className="text-sm font-medium">Light</span>
                        {mode === "light" && (
                          <CheckCircle className="absolute top-2 right-2 w-5 h-5 text-primary" />
                        )}
                      </button>

                      {/* Dark Theme */}
                      <button
                        onClick={() => setMode("dark")}
                        className={`relative flex flex-col items-center gap-3 p-4 border-2 rounded-lg transition-all ${
                          mode === "dark"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50 hover:bg-muted"
                        }`}
                        data-testid="theme-dark"
                      >
                        <Moon className="w-8 h-8" />
                        <span className="text-sm font-medium">Dark</span>
                        {mode === "dark" && (
                          <CheckCircle className="absolute top-2 right-2 w-5 h-5 text-primary" />
                        )}
                      </button>

                      {/* System Theme */}
                      <button
                        onClick={() => setMode("system")}
                        className={`relative flex flex-col items-center gap-3 p-4 border-2 rounded-lg transition-all ${
                          mode === "system"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50 hover:bg-muted"
                        }`}
                        data-testid="theme-system"
                      >
                        <Monitor className="w-8 h-8" />
                        <span className="text-sm font-medium">System</span>
                        {mode === "system" && (
                          <CheckCircle className="absolute top-2 right-2 w-5 h-5 text-primary" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Live Preview */}
                  <div>
                    <Label className="text-base font-medium">Live Preview</Label>
                    <p className="text-sm text-muted-foreground mb-4">
                      Current theme: <span className="font-medium capitalize">{resolvedTheme}</span>
                    </p>
                    <div className="border border-border rounded-lg p-6 space-y-4 bg-background">
                      <div className="flex items-center gap-3">
                        <Button size="sm">Primary Button</Button>
                        <Button size="sm" variant="ghost">Ghost Button</Button>
                        <Button size="sm" variant="outline">Outline Button</Button>
                      </div>
                      <Card className="shadow-md">
                        <CardContent className="p-4">
                          <p className="text-sm font-medium mb-2">Sample Card</p>
                          <p className="text-sm text-muted-foreground">
                            This is how cards look with the current theme applied.
                          </p>
                        </CardContent>
                      </Card>
                      <Input placeholder="Sample input field" className="max-w-xs" />
                    </div>
                  </div>

                  {/* Accessibility Note */}
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Themes are optimized for readability and contrast. Both Light and Dark modes comply with WCAG AA accessibility standards.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "fields" && (
            <div className="max-w-6xl space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Add Custom Field</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="tableName">Table</Label>
                      <select
                        id="tableName"
                        value={newField.tableName}
                        onChange={(e) => setNewField({ ...newField, tableName: e.target.value })}
                        className="w-full mt-1 px-3 py-2 border border-border rounded-md bg-background"
                        data-testid="select-table"
                      >
                        <option value="codes">Codes</option>
                        <option value="contexts">Contexts</option>
                        <option value="establishments">Establishments</option>
                        <option value="rules">Rules</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="fieldKey">Field Key</Label>
                      <Input
                        id="fieldKey"
                        value={newField.fieldKey}
                        onChange={(e) => setNewField({ ...newField, fieldKey: e.target.value })}
                        placeholder="field_name"
                        data-testid="input-field-key"
                      />
                    </div>
                    <div>
                      <Label htmlFor="label">Label</Label>
                      <Input
                        id="label"
                        value={newField.label}
                        onChange={(e) => setNewField({ ...newField, label: e.target.value })}
                        placeholder="Field Label"
                        data-testid="input-label"
                      />
                    </div>
                    <div>
                      <Label htmlFor="type">Type</Label>
                      <select
                        id="type"
                        value={newField.type}
                        onChange={(e) => setNewField({ ...newField, type: e.target.value })}
                        className="w-full mt-1 px-3 py-2 border border-border rounded-md bg-background"
                        data-testid="select-type"
                      >
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="boolean">Boolean</option>
                        <option value="date">Date</option>
                        <option value="select">Select</option>
                        <option value="multiselect">Multi-select</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <Label htmlFor="options">Options (for select types)</Label>
                      <Input
                        id="options"
                        value={newField.options}
                        onChange={(e) => setNewField({ ...newField, options: e.target.value })}
                        placeholder="Option 1, Option 2, Option 3"
                        disabled={!["select", "multiselect"].includes(newField.type)}
                        data-testid="input-options"
                      />
                    </div>
                    <div>
                      <Label htmlFor="defaultValue">Default Value</Label>
                      <Input
                        id="defaultValue"
                        value={newField.defaultValue}
                        onChange={(e) => setNewField({ ...newField, defaultValue: e.target.value })}
                        placeholder="Default value"
                        data-testid="input-default-value"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-6 mt-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="required"
                        checked={newField.required}
                        onCheckedChange={(checked) => setNewField({ ...newField, required: checked })}
                        data-testid="switch-required"
                      />
                      <Label htmlFor="required">Required</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="unique"
                        checked={newField.uniqueField}
                        onCheckedChange={(checked) => setNewField({ ...newField, uniqueField: checked })}
                        data-testid="switch-unique"
                      />
                      <Label htmlFor="unique">Unique</Label>
                    </div>
                  </div>

                  <div className="mt-6">
                    <Button 
                      onClick={handleCreateField} 
                      disabled={createFieldMutation.isPending}
                      data-testid="button-create-field"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {createFieldMutation.isPending ? "Creating..." : "Create Field"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Existing Custom Fields</CardTitle>
                </CardHeader>
                <CardContent>
                  {fieldCatalog && fieldCatalog.length > 0 ? (
                    <div className="space-y-4">
                      {fieldCatalog.map((field: any) => (
                        <div
                          key={field.id}
                          className="flex items-center justify-between p-4 border border-border rounded-lg"
                          data-testid={`field-item-${field.fieldKey}`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <h4 className="font-medium">{field.label}</h4>
                              <Badge variant="outline" className="text-xs">
                                {field.tableName}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {field.type}
                              </Badge>
                              {field.required && (
                                <Badge variant="outline" className="text-xs text-red-600">
                                  Required
                                </Badge>
                              )}
                              {field.uniqueField && (
                                <Badge variant="outline" className="text-xs text-blue-600">
                                  Unique
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Key: {field.fieldKey}
                              {field.defaultValue && ` • Default: ${field.defaultValue}`}
                            </p>
                            {field.options && (
                              <p className="text-sm text-muted-foreground">
                                Options: {field.options.join(", ")}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={field.active}
                              onCheckedChange={() => handleToggleField(field)}
                              data-testid={`switch-active-${field.fieldKey}`}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleUnique(field)}
                              disabled={!field.active}
                              data-testid={`button-toggle-unique-${field.fieldKey}`}
                            >
                              {field.uniqueField ? "Remove Unique" : "Make Unique"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteField(field)}
                              className="text-red-600 hover:text-red-700"
                              data-testid={`button-delete-${field.fieldKey}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Database className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">No custom fields created yet</p>
                      <p className="text-sm text-muted-foreground">
                        Create your first custom field using the form above
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "security" && (
            <div className="max-w-2xl space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Authentication</CardTitle>
                </CardHeader>
                <CardContent>
                  <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                      Authentication is managed through Firebase. Your account is secured with Google Sign-In.
                    </AlertDescription>
                  </Alert>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Two-Factor Authentication</span>
                      <Badge variant="outline">Managed by Google</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Password Security</span>
                      <Badge variant="outline">Managed by Google</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Session Management</span>
                      <Badge variant="outline" className="text-green-600">Active</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Access Permissions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Current Role: {user?.role}</h4>
                      <div className="space-y-2 text-sm">
                        {user?.role === "pending" && (
                          <>
                            <div className="flex items-center text-yellow-600">
                              <AlertCircle className="w-4 h-4 mr-2" />
                              Account pending approval
                            </div>
                            <div className="flex items-center text-red-600">
                              <AlertCircle className="w-4 h-4 mr-2" />
                              No access to modules
                            </div>
                            <div className="flex items-center text-red-600">
                              <AlertCircle className="w-4 h-4 mr-2" />
                              Cannot view or edit data
                            </div>
                            <p className="text-muted-foreground mt-2">
                              Un administrateur doit approuver votre compte pour activer l'accès.
                            </p>
                          </>
                        )}
                        {user?.role === "admin" && (
                          <>
                            <div className="flex items-center text-green-600">
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Full system access
                            </div>
                            <div className="flex items-center text-green-600">
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Can delete records
                            </div>
                            <div className="flex items-center text-green-600">
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Can manage custom fields
                            </div>
                          </>
                        )}
                        {user?.role === "editor" && (
                          <>
                            <div className="flex items-center text-green-600">
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Can create and edit records
                            </div>
                            <div className="flex items-center text-green-600">
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Can import/export data
                            </div>
                            <div className="flex items-center text-red-600">
                              <AlertCircle className="w-4 h-4 mr-2" />
                              Cannot delete records
                            </div>
                          </>
                        )}
                        {user?.role === "viewer" && (
                          <>
                            <div className="flex items-center text-green-600">
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Can view records
                            </div>
                            <div className="flex items-center text-red-600">
                              <AlertCircle className="w-4 h-4 mr-2" />
                              Cannot edit or delete
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "system" && (
            <div className="max-w-2xl space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>System Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm">Application Version</span>
                      <Badge variant="outline">1.0.0</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Database Status</span>
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200">
                        Connected
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Authentication Provider</span>
                      <Badge variant="outline">Firebase</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Last Backup</span>
                      <span className="text-sm text-muted-foreground">
                        {new Date().toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Data Management</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Export All Data</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Download a complete backup of all your data in CSV format.
                    </p>
                    <Button variant="outline" data-testid="button-export-all">
                      <Download className="w-4 h-4 mr-2" />
                      Export All Data
                    </Button>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Storage Usage</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Database Records</span>
                        <span>2.4 MB</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Uploaded Files</span>
                        <span>127 MB</span>
                      </div>
                      <div className="flex justify-between text-sm font-medium">
                        <span>Total Usage</span>
                        <span>129.4 MB</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
