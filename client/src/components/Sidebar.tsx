import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  Home,
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
  Shield,
  Activity,
  Stethoscope,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";
import { useEnabledModules } from "@/api/modules";
import { getModuleConfig, isModuleVisible } from "@/config/modules";

export function Sidebar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [databaseOpen, setDatabaseOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [bookDeMdOpen, setBookDeMdOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Fetch enabled modules from API
  const { modules: enabledModules, isLoading } = useEnabledModules();

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
        {user?.role !== "pending" && !isLoading && (
          <>
            {/* Dynamic Module Links (excluding special cases) */}
            {enabledModules
              .filter((module) =>
                // Exclude database, administration, and book-de-md (handled separately below)
                module.name !== "database" &&
                module.name !== "administration" &&
                module.name !== "book-de-md" &&
                // Check module visibility based on user role
                isModuleVisible(module.name, module.enabled, user?.role)
              )
              .map((module) => {
                const config = getModuleConfig(module.name);
                if (!config) return null;

                const Icon = config.icon;
                return (
                  <div key={module.name} className="pt-4">
                    <Link
                      href={config.route}
                      className={`flex items-center ${sidebarCollapsed ? 'justify-center px-2' : 'space-x-3 px-3'} py-2 rounded-xl font-medium transition-colors ${
                        isActive(config.route)
                          ? "text-primary bg-primary/10"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                      data-testid={`link-${module.name}`}
                    >
                      <Icon className={`${sidebarCollapsed ? 'w-6 h-6' : 'w-5 h-5'}`} />
                      {!sidebarCollapsed && <span>{config.displayName}</span>}
                    </Link>
                  </div>
                );
              })}

            {/* Book de MD Section - Special collapsible handling */}
            {enabledModules.some((m) => m.name === "book-de-md" && m.enabled) && (
            <div className="pt-4">
              {sidebarCollapsed ? (
                <Link href="/book-de-md/list" className={`flex items-center justify-center px-2 py-2 rounded-xl font-medium transition-colors ${
                  isActive("/book-de-md")
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`} data-testid="link-book-de-md">
                  <Stethoscope className="w-6 h-6" />
                </Link>
              ) : (
                <Collapsible open={bookDeMdOpen} onOpenChange={setBookDeMdOpen}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                    <div className="flex items-center space-x-2">
                      <Stethoscope className="w-4 h-4" />
                      <span>Book de MD</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 transition-transform ${bookDeMdOpen ? "rotate-180" : ""}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="ml-6 space-y-1">
                    <Link href="/book-de-md/list" className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                      isActive("/book-de-md/list")
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`} data-testid="link-book-de-md-list">
                      <Users className="w-4 h-4" />
                      <span>Liste des médecins</span>
                    </Link>
                    <Link href="/book-de-md/billing" className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                      isActive("/book-de-md/billing")
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`} data-testid="link-book-de-md-billing">
                      <FileText className="w-4 h-4" />
                      <span>Facturation automatique</span>
                    </Link>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
            )}

            {/* Database Section - Special collapsible handling */}
            {enabledModules.some((m) => m.name === "database" && m.enabled) && (
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
            )}
          </>
        )}

        {/* Admin Section - Only visible for admins and if administration module is enabled */}
        {user?.role === "admin" && !isLoading && enabledModules.some((m) => m.name === "administration" && m.enabled) && (
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
                  <Link href="/admin/knowledge" className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive("/admin/knowledge")
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`} data-testid="link-admin-knowledge">
                    <Database className="w-4 h-4" />
                    <span>Base de Connaissances</span>
                  </Link>
                  <Link href="/admin/queue" className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive("/admin/queue")
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`} data-testid="link-admin-queue">
                    <Activity className="w-4 h-4" />
                    <span>File d'attente</span>
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
