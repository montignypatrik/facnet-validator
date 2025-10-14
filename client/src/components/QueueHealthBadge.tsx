import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import client from "@/api/client";

interface QueueHealthData {
  redis: {
    connected: boolean;
    responseTime: number | null;
  };
  worker: {
    status: string;
    lastHeartbeat: string;
    timeSinceHeartbeat: number;
  };
  queue: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    stalled: number;
  };
  metrics: {
    averageProcessingTime: number;
    averageWaitTime: number;
  };
}

/**
 * QueueHealthBadge Component
 *
 * Displays a simple badge showing the current queue health status.
 * Shows in the top-right of the app header with a colored dot indicator.
 *
 * Health Criteria:
 * - Healthy: Redis connected, worker active, <10 waiting jobs
 * - Degraded: Redis connected, worker active, 10-50 waiting jobs
 * - Unhealthy: Redis disconnected OR worker stopped OR >50 waiting jobs
 *
 * Features:
 * - Auto-refreshes every 30 seconds
 * - Tooltip with detailed metrics on hover
 * - Color-coded status indicator (green/yellow/red)
 */
export function QueueHealthBadge() {
  const { data: health, isLoading } = useQuery<QueueHealthData>({
    queryKey: ['/queue/health'],
    queryFn: async () => {
      const response = await client.get('/queue/health');
      return response.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: 1, // Only retry once on failure
  });

  if (isLoading || !health) {
    return null;
  }

  // Validate health data structure
  if (!health.redis || !health.worker || !health.queue) {
    console.error('Invalid queue health data structure:', health);
    return null;
  }

  // Calculate health status from the data
  const isRedisConnected = health.redis.connected;
  const isWorkerActive = health.worker.status === 'running';
  const waitingJobs = health.queue.waiting;

  let healthStatus: 'healthy' | 'degraded' | 'unhealthy';
  if (!isRedisConnected || !isWorkerActive || waitingJobs > 50) {
    healthStatus = 'unhealthy';
  } else if (waitingJobs >= 10) {
    healthStatus = 'degraded';
  } else {
    healthStatus = 'healthy';
  }

  // Determine color based on health status
  const statusConfig = {
    healthy: {
      color: 'bg-green-500',
      badgeVariant: 'default' as const,
      label: 'Système opérationnel',
    },
    degraded: {
      color: 'bg-yellow-500',
      badgeVariant: 'secondary' as const,
      label: 'Performance réduite',
    },
    unhealthy: {
      color: 'bg-red-500',
      badgeVariant: 'destructive' as const,
      label: 'Problème détecté',
    },
  };

  const config = statusConfig[healthStatus];

  // Format last activity time
  const formatLastActivity = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffSeconds < 60) return `${diffSeconds}s`;
      if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m`;
      return `${Math.floor(diffSeconds / 3600)}h`;
    } catch {
      return 'N/A';
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={config.badgeVariant} className="cursor-pointer">
          <div className={`w-2 h-2 rounded-full ${config.color} mr-2 ${healthStatus === 'healthy' ? 'animate-pulse' : ''}`} />
          <span className="text-xs font-medium">File d'attente</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="w-72">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold">{config.label}</span>
            <Badge variant="outline" className="text-xs">
              {healthStatus}
            </Badge>
          </div>

          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Redis:</span>
              <span className={health.redis.connected ? 'text-green-600' : 'text-red-600'}>
                {health.redis.connected ? `Connecté (${health.redis.responseTime}ms)` : 'Déconnecté'}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Worker:</span>
              <span className={isWorkerActive ? 'text-green-600' : 'text-red-600'}>
                {isWorkerActive ? `Actif (${formatLastActivity(health.worker.lastHeartbeat)})` : 'Arrêté'}
              </span>
            </div>

            <div className="border-t border-border my-2 pt-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-muted-foreground">En attente</div>
                  <div className="font-semibold">{health.queue.waiting}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">En cours</div>
                  <div className="font-semibold">{health.queue.active}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Terminés</div>
                  <div className="font-semibold text-green-600">{health.queue.completed}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Échoués</div>
                  <div className="font-semibold text-red-600">{health.queue.failed}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
