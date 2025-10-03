import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  Home,
  ShieldCheck,
  Shield,
  Database,
  Code,
  Layers,
  Building,
  Zap,
  Settings,
  LogOut,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Users,
  MessageSquare,
  CheckSquare,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

export function Sidebar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [databaseOpen, setDatabaseOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const isActive = (path: string) => location === path || location.startsWith(path + "/");

  return (
    <div className="relative">
      <aside className={`${sidebarCollapsed ? 'w-16' : 'w-80'} h-screen bg-card border-r border-border flex flex-col transition-all duration-300 relative`}>
      {/* Collapse Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className={`absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background border-2 border-border shadow-md hover:shadow-lg transition-all duration-300 z-10 ${sidebarCollapsed ? '-right-4' : '-right-4'}`}
      >
        {sidebarCollapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </Button>

      {/* Brand Header */}
      <div className={`${sidebarCollapsed ? 'p-3' : 'p-6'} border-b border-border`}>
        <div className="flex items-center space-x-3">
          <div className={`${sidebarCollapsed ? 'w-10 h-10' : 'w-12 h-12'} flex items-center justify-center`}>
            <img
              src="/logo.png"
              alt="DASH Logo"
              className="w-full h-full object-contain dark:invert transition-all"
            />
          </div>
          {!sidebarCollapsed && (
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-wider">DASH</h1>
            </div>
          )}
        </div>
      </div>

      {/* User Profile */}
      <div className={`${sidebarCollapsed ? 'p-2' : 'p-4'} border-b border-border`}>
        <div className={`flex items-center ${sidebarCollapsed ? 'justify-center p-2' : 'space-x-3 p-3'} bg-muted rounded-xl`}>
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <span className="text-xs font-medium text-primary-foreground">
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </span>
          </div>
          {!sidebarCollapsed && (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className={`flex-1 ${sidebarCollapsed ? 'p-2' : 'p-4'} space-y-2 overflow-y-auto`}>
        {/* Dashboard - Always visible */}
        <Link href="/" className={`flex items-center ${sidebarCollapsed ? 'justify-center px-2' : 'space-x-3 px-3'} py-2 rounded-xl font-medium transition-colors ${
          isActive("/") && location === "/"
            ? "text-primary bg-primary/10"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        }`} data-testid="link-dashboard">
          <Home className={`${sidebarCollapsed ? 'w-6 h-6' : 'w-5 h-5'}`} />
          {!sidebarCollapsed && <span>Tableau de Bord</span>}
        </Link>

        {/* Only show these sections if user is not pending */}
        {user?.role !== "pending" && (
          <>
            {/* Validator Section */}
            <div className="pt-4">
              <Link href="/validator" className={`flex items-center ${sidebarCollapsed ? 'justify-center px-2' : 'space-x-3 px-3'} py-2 rounded-xl font-medium transition-colors ${
                isActive("/validator")
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`} data-testid="link-validator">
                <ShieldCheck className={`${sidebarCollapsed ? 'w-6 h-6' : 'w-5 h-5'}`} />
                {!sidebarCollapsed && <span>Validateur</span>}
              </Link>
            </div>

            {/* Chatbot Section */}
            <div className="pt-4">
              <Link href="/chatbot" className={`flex items-center ${sidebarCollapsed ? 'justify-center px-2' : 'space-x-3 px-3'} py-2 rounded-xl font-medium transition-colors ${
                isActive("/chatbot")
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`} data-testid="link-chatbot">
                <MessageSquare className={`${sidebarCollapsed ? 'w-6 h-6' : 'w-5 h-5'}`} />
                {!sidebarCollapsed && <span>Chatbot</span>}
              </Link>
            </div>

            {/* Tâche Section */}
            <div className="pt-4">
              <Link href="/tache" className={`flex items-center ${sidebarCollapsed ? 'justify-center px-2' : 'space-x-3 px-3'} py-2 rounded-xl font-medium transition-colors ${
                isActive("/tache")
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`} data-testid="link-tache">
                <CheckSquare className={`${sidebarCollapsed ? 'w-6 h-6' : 'w-5 h-5'}`} />
                {!sidebarCollapsed && <span>Tâche</span>}
              </Link>
            </div>

            {/* Hors-RAMQ Section */}
            <div className="pt-4">
              <Link href="/hors-ramq" className={`flex items-center ${sidebarCollapsed ? 'justify-center px-2' : 'space-x-3 px-3'} py-2 rounded-xl font-medium transition-colors ${
                isActive("/hors-ramq")
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`} data-testid="link-hors-ramq">
                <FileText className={`${sidebarCollapsed ? 'w-6 h-6' : 'w-5 h-5'}`} />
                {!sidebarCollapsed && <span>Hors-RAMQ</span>}
              </Link>
            </div>

            {/* Database Section */}
            <div className="pt-4">
              {sidebarCollapsed ? (
                <Link href="/database/codes" className={`flex items-center justify-center px-2 py-2 rounded-xl font-medium transition-colors ${
                  isActive("/database")
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`} data-testid="link-database">
                  <Database className="w-6 h-6" />
                </Link>
              ) : (
                <Collapsible open={databaseOpen} onOpenChange={setDatabaseOpen}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                    <div className="flex items-center space-x-2">
                      <Database className="w-4 h-4" />
                      <span>Base de Données</span>
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
                      <span>Contextes</span>
                    </Link>
                    <Link href="/database/establishments" className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                      isActive("/database/establishments")
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`} data-testid="link-database-establishments">
                      <Building className="w-4 h-4" />
                      <span>Établissements</span>
                    </Link>
                    <Link href="/database/rules" className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                      isActive("/database/rules")
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`} data-testid="link-database-rules">
                      <Zap className="w-4 h-4" />
                      <span>Règles</span>
                    </Link>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          </>
        )}

        {/* Admin Section - Only visible for admins */}
        {user?.role === "admin" && (
          <div className="pt-4">
            {sidebarCollapsed ? (
              <Link href="/admin/users" className={`flex items-center justify-center px-2 py-2 rounded-xl font-medium transition-colors ${
                isActive("/admin")
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`} data-testid="link-admin">
                <Shield className="w-6 h-6" />
              </Link>
            ) : (
              <Collapsible open={adminOpen} onOpenChange={setAdminOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                  <div className="flex items-center space-x-2">
                    <Shield className="w-4 h-4" />
                    <span>Administration</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform ${adminOpen ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="ml-6 space-y-1">
                  <Link href="/admin/users" className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive("/admin/users")
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`} data-testid="link-admin-users">
                    <Users className="w-4 h-4" />
                    <span>Utilisateurs</span>
                  </Link>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )}

        {/* Settings - Always visible */}
        <div className="pt-4">
          <Link href="/settings" className={`flex items-center ${sidebarCollapsed ? 'justify-center px-2' : 'space-x-3 px-3'} py-2 rounded-lg transition-colors ${
            isActive("/settings")
              ? "text-primary bg-primary/10"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`} data-testid="link-settings">
            <Settings className={`${sidebarCollapsed ? 'w-6 h-6' : 'w-5 h-5'}`} />
            {!sidebarCollapsed && <span>Paramètres</span>}
          </Link>
        </div>
      </nav>

      {/* Connection Status */}
      <div className={`${sidebarCollapsed ? 'p-2' : 'p-4'} border-t border-border`}>
        <div className={`flex items-center ${sidebarCollapsed ? 'justify-center px-2' : 'space-x-2 px-3'} py-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg`}>
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          {!sidebarCollapsed && (
            <span className="text-sm text-green-700 dark:text-green-300">API Connectée</span>
          )}
        </div>
      </div>
    </aside>
    </div>
  );
}