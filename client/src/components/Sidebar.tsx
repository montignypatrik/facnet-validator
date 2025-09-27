import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  Home,
  ShieldCheck,
  Upload,
  PlayCircle,
  BarChart3,
  Database,
  Code,
  Layers,
  Building,
  Zap,
  Settings,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

export function Sidebar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [validatorOpen, setValidatorOpen] = useState(true);
  const [databaseOpen, setDatabaseOpen] = useState(true);

  const isActive = (path: string) => location === path || location.startsWith(path + "/");

  return (
    <aside className="w-80 bg-card border-r border-border flex flex-col">
      {/* Brand Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">DashValidator</h1>
            <p className="text-sm text-muted-foreground">Data Management</p>
          </div>
        </div>
      </div>

      {/* User Profile */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center space-x-3 p-3 bg-muted rounded-xl">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <span className="text-xs font-medium text-primary-foreground">
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {/* Dashboard */}
        <Link href="/" className={`flex items-center space-x-3 px-3 py-2 rounded-xl font-medium transition-colors ${
          isActive("/") && location === "/"
            ? "text-primary bg-primary/10"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        }`} data-testid="link-dashboard">
          <Home className="w-5 h-5" />
          <span>Dashboard</span>
        </Link>

        {/* Validator Section */}
        <div className="pt-4">
          <Collapsible open={validatorOpen} onOpenChange={setValidatorOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4" />
                <span>Validator</span>
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${validatorOpen ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="ml-6 space-y-1">
              <Link href="/validator/upload" className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                isActive("/validator/upload")
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`} data-testid="link-validator-upload">
                <Upload className="w-4 h-4" />
                <span>Upload</span>
              </Link>
              <Link href="/validator/runs" className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                isActive("/validator/runs")
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`} data-testid="link-validator-runs">
                <PlayCircle className="w-4 h-4" />
                <span>Runs</span>
              </Link>
              <Link href="/validator/analytics" className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                isActive("/validator/analytics")
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`} data-testid="link-validator-analytics">
                <BarChart3 className="w-4 h-4" />
                <span>Analytics</span>
              </Link>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Database Section */}
        <div className="pt-4">
          <Collapsible open={databaseOpen} onOpenChange={setDatabaseOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4" />
                <span>Database</span>
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${databaseOpen ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="ml-6 space-y-1">
              <Link href="/database/codes" className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                isActive("/database/codes")
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`} data-testid="link-database-codes">
                <Code className="w-4 h-4" />
                <span>Codes</span>
              </Link>
              <Link href="/database/contexts" className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                isActive("/database/contexts")
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`} data-testid="link-database-contexts">
                <Layers className="w-4 h-4" />
                <span>Contexts</span>
              </Link>
              <Link href="/database/establishments" className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                isActive("/database/establishments")
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`} data-testid="link-database-establishments">
                <Building className="w-4 h-4" />
                <span>Establishments</span>
              </Link>
              <Link href="/database/rules" className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                isActive("/database/rules")
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`} data-testid="link-database-rules">
                <Zap className="w-4 h-4" />
                <span>Rules</span>
              </Link>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Settings */}
        <div className="pt-4">
          <Link href="/settings" className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
            isActive("/settings")
              ? "text-primary bg-primary/10"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`} data-testid="link-settings">
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </Link>
        </div>
      </nav>

      {/* Connection Status */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center space-x-2 px-3 py-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-sm text-green-700 dark:text-green-300">API Connected</span>
        </div>
      </div>
    </aside>
  );
}
