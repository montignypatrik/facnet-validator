import {
  ShieldCheck,
  MessageSquare,
  CheckSquare,
  GraduationCap,
  FileText,
  Database,
  Shield,
  Stethoscope,
  type LucideIcon
} from "lucide-react";

/**
 * Module UI Configuration
 * Maps backend module names to frontend UI metadata
 */
export interface ModuleConfig {
  name: string;
  displayName: string;
  icon: LucideIcon;
  route: string;
  description?: string;
  isCollapsible?: boolean;
  subItems?: Array<{
    name: string;
    route: string;
  }>;
  requiredRole?: string;
}

/**
 * Module configurations for all available modules
 * This maps backend module names to their UI representation
 */
export const MODULE_CONFIGS: Record<string, ModuleConfig> = {
  validateur: {
    name: "validateur",
    displayName: "Validateur",
    icon: ShieldCheck,
    route: "/validator",
    description: "Système de validation des codes de facturation RAMQ",
  },
  "nam-extraction": {
    name: "nam-extraction",
    displayName: "Extraction NAM",
    icon: FileText,
    route: "/nam",
    description: "Extraction de NAM à partir de documents PDF",
  },
  chatbot: {
    name: "chatbot",
    displayName: "Chatbot",
    icon: MessageSquare,
    route: "/chatbot",
    description: "Assistant IA pour le support et les requêtes",
  },
  tasks: {
    name: "tasks",
    displayName: "Tâche",
    icon: CheckSquare,
    route: "/tache",
    description: "Gestion des tâches et du flux de travail",
  },
  "formation-ressourcement": {
    name: "formation-ressourcement",
    displayName: "Formation-Ressourcement",
    icon: GraduationCap,
    route: "/formation",
    description: "Formation et ressources professionnelles",
  },
  "hors-ramq": {
    name: "hors-ramq",
    displayName: "Hors-RAMQ",
    icon: FileText,
    route: "/hors-ramq",
    description: "Facturation hors système RAMQ",
  },
  "book-de-md": {
    name: "book-de-md",
    displayName: "Book de MD",
    icon: Stethoscope,
    route: "/book-de-md",
    description: "Répertoire centralisé de vos médecins",
  },
  database: {
    name: "database",
    displayName: "Base de Données",
    icon: Database,
    route: "/database",
    description: "Gestion des données de référence",
    isCollapsible: true,
    subItems: [
      { name: "Codes", route: "/codes" },
      { name: "Contextes", route: "/contexts" },
      { name: "Établissements", route: "/establishments" },
      { name: "Règles", route: "/rules" },
    ],
  },
  administration: {
    name: "administration",
    displayName: "Administration",
    icon: Shield,
    route: "/admin",
    description: "Gestion des utilisateurs et des permissions",
    requiredRole: "admin",
    isCollapsible: true,
    subItems: [
      { name: "Utilisateurs", route: "/admin/users" },
      { name: "Roles", route: "/admin/roles" },
    ],
  },
};

/**
 * Get module configuration by name
 */
export function getModuleConfig(name: string): ModuleConfig | undefined {
  return MODULE_CONFIGS[name];
}

/**
 * Check if module should be visible based on enabled state and user role
 */
export function isModuleVisible(
  moduleName: string,
  isEnabled: boolean,
  userRole?: string
): boolean {
  if (!isEnabled) return false;

  const config = getModuleConfig(moduleName);
  if (!config) return false;

  // Check role requirement if specified
  if (config.requiredRole && userRole !== config.requiredRole) {
    return false;
  }

  return true;
}
