import { useQuery } from "@tanstack/react-query";
import apiClient from "./client";

/**
 * Module information from backend
 */
export interface DashModule {
  name: string;
  version: string;
  description: string;
  enabled: boolean;
}

/**
 * Response from /api/modules endpoint
 */
interface ModulesResponse {
  platform: string;
  version: string;
  modules: DashModule[];
}

/**
 * Fetch all modules from the backend
 */
async function fetchModules(): Promise<ModulesResponse> {
  const response = await apiClient.get("/modules");
  return response.data;
}

/**
 * React Query hook to fetch all modules
 */
export function useModules() {
  return useQuery({
    queryKey: ["modules"],
    queryFn: fetchModules,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });
}

/**
 * React Query hook to fetch only enabled modules
 */
export function useEnabledModules() {
  const { data, isLoading, error } = useModules();

  const enabledModules = data?.modules.filter((module) => module.enabled) || [];

  return {
    modules: enabledModules,
    isLoading,
    error,
  };
}
