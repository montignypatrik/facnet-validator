import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Clock,
  CheckCircle,
  XCircle,
  Loader,
  Activity,
  Database,
  AlertCircle,
} from "lucide-react";
import client from "@/api/client";
import { useAuth } from "@/lib/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface QueueHealthData {
  redis: {
    connected: boolean;
    latency: number;
  };
  worker: {
    active: boolean;
    lastActivity: string;
  };
  counts: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
  health: 'healthy' | 'degraded' | 'unhealthy';
}

interface QueueJob {
  id: string;
  name: string;
  data: {
    validationId: string;
    fileName?: string;
    userId?: string;
  };
  state: 'waiting' | 'active' | 'completed' | 'failed';
  progress: number;
  timestamp: string;
  finishedOn?: string;
  failedReason?: string;
}

/**
 * QueueManagement Page (Admin Only)
 *
 * Comprehensive queue monitoring dashboard for administrators.
 *
 * Features:
 * - Queue health metrics with visual indicators
 * - Real-time job status tracking
 * - Recent jobs table with detailed information
 * - Redis and worker status monitoring
 * - Auto-refresh every 10 seconds
 */
export default function QueueManagementPage() {
  const { user } = useAuth();

  // Fetch queue health metrics
  const { data: health, isLoading: healthLoading } = useQuery<QueueHealthData>({
    queryKey: ['/queue/health'],
    queryFn: async () => {
      const response = await client.get('/queue/health');
      return response.data;
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch recent jobs (admin sees all users' jobs)
  const { data: jobs, isLoading: jobsLoading } = useQuery<QueueJob[]>({
    queryKey: ['/queue/jobs'],
    queryFn: async () => {
      const response = await client.get('/queue/jobs?limit=50');
      return response.data;
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Check if user is admin
  if (user?.role !== 'admin') {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-card border-b border-border p-6">
          <h1 className="text-2xl font-bold text-foreground">Gestion de la file d'attente</h1>
        </header>
        <div className="flex-1 p-6 flex items-center justify-center">
          <Card className="max-w-md">
            <CardContent className="p-12 text-center">
              <AlertCircle className="w-16 h-16 mx-auto mb-4 text-amber-600" />
              <h3 className="text-lg font-medium text-foreground mb-2">Accès refusé</h3>
              <p className="text-muted-foreground">
                Cette page est réservée aux administrateurs. Veuillez contacter votre administrateur système si vous avez besoin d'accéder à ces informations.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const getStatusBadge = (state: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
      completed: { variant: "default", icon: CheckCircle },
      active: { variant: "secondary", icon: Loader },
      failed: { variant: "destructive", icon: XCircle },
      waiting: { variant: "outline", icon: Clock },
    };

    const config = variants[state] || variants.waiting;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="capitalize text-xs">
        <Icon className="w-3 h-3 mr-1" />
        {state}
      </Badge>
    );
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString('fr-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return 'N/A';
    }
  };

  const formatDuration = (start: string, end?: string) => {
    try {
      const startTime = new Date(start).getTime();
      const endTime = end ? new Date(end).getTime() : Date.now();
      const durationMs = endTime - startTime;
      const seconds = Math.floor(durationMs / 1000);

      if (seconds < 60) return `${seconds}s`;
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
      return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Page Header */}
      <header className="bg-card border-b border-border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tableau de bord de la file d'attente</h1>
            <p className="text-muted-foreground mt-1">
              Surveillance et gestion de la file de traitement des validations
            </p>
          </div>
          {health && (
            <Badge
              variant={
                health.health === 'healthy'
                  ? 'default'
                  : health.health === 'degraded'
                  ? 'secondary'
                  : 'destructive'
              }
              className="text-sm"
            >
              <div className={`w-2 h-2 rounded-full mr-2 ${
                health.health === 'healthy'
                  ? 'bg-green-500 animate-pulse'
                  : health.health === 'degraded'
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`} />
              {health.health === 'healthy' && 'Système opérationnel'}
              {health.health === 'degraded' && 'Performance réduite'}
              {health.health === 'unhealthy' && 'Problème détecté'}
            </Badge>
          )}
        </div>
      </header>

      {/* Queue Dashboard Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Queue Metrics Cards */}
          {healthLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="h-24 bg-muted rounded animate-pulse" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : health ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-3xl font-bold text-foreground">
                          {health.counts.waiting}
                        </p>
                        <p className="text-sm text-muted-foreground">En attente</p>
                      </div>
                      <Clock className="w-10 h-10 text-gray-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-3xl font-bold text-foreground">
                          {health.counts.active}
                        </p>
                        <p className="text-sm text-muted-foreground">En cours</p>
                      </div>
                      <Loader className="w-10 h-10 text-blue-600 animate-spin" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-3xl font-bold text-foreground">
                          {health.counts.completed}
                        </p>
                        <p className="text-sm text-muted-foreground">Terminés</p>
                      </div>
                      <CheckCircle className="w-10 h-10 text-green-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-3xl font-bold text-foreground">
                          {health.counts.failed}
                        </p>
                        <p className="text-sm text-muted-foreground">Échoués</p>
                      </div>
                      <XCircle className="w-10 h-10 text-red-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* System Status Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Activity className="w-5 h-5 mr-2 text-blue-600" />
                      État du Worker
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <span className="text-sm font-medium">Statut</span>
                        <Badge variant={health.worker.active ? 'default' : 'destructive'}>
                          {health.worker.active ? 'Actif' : 'Arrêté'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <span className="text-sm font-medium">Dernière activité</span>
                        <span className="text-sm text-muted-foreground">
                          {formatTimestamp(health.worker.lastActivity)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Database className="w-5 h-5 mr-2 text-red-600" />
                      État de Redis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <span className="text-sm font-medium">Connexion</span>
                        <Badge variant={health.redis.connected ? 'default' : 'destructive'}>
                          {health.redis.connected ? 'Connecté' : 'Déconnecté'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <span className="text-sm font-medium">Latence</span>
                        <span className="text-sm text-muted-foreground">
                          {health.redis.latency}ms
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Impossible de charger les métriques de la file d'attente. Veuillez réessayer plus tard.
              </AlertDescription>
            </Alert>
          )}

          {/* Recent Jobs Table */}
          <Card>
            <CardHeader>
              <CardTitle>Tâches récentes (50 dernières)</CardTitle>
            </CardHeader>
            <CardContent>
              {jobsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                  ))}
                </div>
              ) : jobs && jobs.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Fichier</TableHead>
                        <TableHead>État</TableHead>
                        <TableHead>Progression</TableHead>
                        <TableHead>Début</TableHead>
                        <TableHead>Durée</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobs.map((job) => (
                        <TableRow key={job.id}>
                          <TableCell className="font-mono text-xs">
                            {job.data.validationId?.slice(0, 8) || 'N/A'}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {job.data.fileName || 'N/A'}
                          </TableCell>
                          <TableCell>{getStatusBadge(job.state)}</TableCell>
                          <TableCell>
                            {job.state === 'active' ? (
                              <div className="flex items-center space-x-2">
                                <div className="flex-1 bg-muted rounded-full h-2">
                                  <div
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${job.progress}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {job.progress}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                {job.state === 'completed' ? '100%' : '-'}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatTimestamp(job.timestamp)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDuration(job.timestamp, job.finishedOn)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Clock className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Aucune tâche récente</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
