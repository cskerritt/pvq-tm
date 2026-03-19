"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  Loader2,
  Database,
  CheckCircle,
  Clock,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

interface SyncStatus {
  source: string;
  lastSync: string | null;
  recordCount: number;
  totalOccupations: number;
  version: string | null;
  status: string;
}

interface AutoSyncInfo {
  enabled: boolean;
  schedule: string;
  isSyncing: boolean;
}

interface SyncStatusResponse {
  sources: SyncStatus[];
  autoSync: AutoSyncInfo;
}

export default function DataSyncPage() {
  const [statuses, setStatuses] = useState<SyncStatus[]>([]);
  const [autoSync, setAutoSync] = useState<AutoSyncInfo | null>(null);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/sync/status");
      const data: SyncStatusResponse = await res.json();
      // Handle both old format (array) and new format (object with sources)
      if (Array.isArray(data)) {
        setStatuses(data);
      } else {
        setStatuses(data.sources ?? []);
        setAutoSync(data.autoSync ?? null);
      }
    } catch {
      toast.error("Failed to load sync status");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function triggerSync(source: string) {
    setSyncing((prev) => ({ ...prev, [source]: true }));
    try {
      const res = await fetch(`/api/admin/sync/${source.toLowerCase()}`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        if (source === "ALL") {
          const total = Object.values(
            data as Record<string, { synced?: number }>
          ).reduce((sum: number, s) => sum + (s.synced ?? 0), 0);
          toast.success(`Full sync complete: ${total} total records updated`);
        } else {
          toast.success(
            `${source} sync complete: ${data.synced ?? 0} records updated`
          );
        }
      } else {
        toast.error(data.error ?? `${source} sync failed`);
      }
    } catch {
      toast.error(`Failed to sync ${source}`);
    }
    setSyncing((prev) => ({ ...prev, [source]: false }));
    load();
  }

  const sourceDescriptions: Record<string, string> = {
    ONET: "O*NET occupational data — all 1,016+ occupations with tasks, skills, abilities, tools, knowledge, work context, and related occupations",
    ORS: "Occupational Requirements Survey — comprehensive physical demands, environmental conditions, cognitive demands, and education/training requirements",
    OEWS: "Occupational Employment & Wage Statistics — national employment levels and annual wage percentiles (10th, 25th, median, 75th, 90th)",
    PROJECTIONS: "Employment Projections — projected employment, growth rates, and annual openings estimates",
    JOLTS: "JOLTS (Job Openings & Labor Turnover Survey) — industry-level job openings and hires data for 21 industries (2014-2025)",
  };

  const isSyncingAny = Object.values(syncing).some(Boolean) || autoSync?.isSyncing;

  function getFreshnessInfo(lastSync: string | null): { color: string; label: string; bgClass: string; textClass: string } {
    if (!lastSync) return { color: "gray", label: "Never synced", bgClass: "bg-gray-100 dark:bg-gray-800", textClass: "text-gray-600 dark:text-gray-400" };
    const now = new Date();
    const syncDate = new Date(lastSync);
    const monthsAgo = (now.getTime() - syncDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (monthsAgo < 3) return { color: "green", label: "Fresh", bgClass: "bg-green-100 dark:bg-green-900/30", textClass: "text-green-700 dark:text-green-400" };
    if (monthsAgo < 12) return { color: "yellow", label: "Aging", bgClass: "bg-yellow-100 dark:bg-yellow-900/30", textClass: "text-yellow-700 dark:text-yellow-400" };
    return { color: "red", label: "Stale", bgClass: "bg-red-100 dark:bg-red-900/30", textClass: "text-red-700 dark:text-red-400" };
  }

  function getDaysSinceSync(lastSync: string | null): string {
    if (!lastSync) return "Never";
    const now = new Date();
    const syncDate = new Date(lastSync);
    const days = Math.floor((now.getTime() - syncDate.getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "1 day ago";
    if (days < 30) return `${days} days ago`;
    const months = Math.floor(days / 30);
    if (months === 1) return "1 month ago";
    if (months < 12) return `${months} months ago`;
    const years = Math.floor(months / 12);
    return years === 1 ? "1 year ago" : `${years} years ago`;
  }

  async function syncAll() {
    const sources = statuses.map((s) => s.source);
    for (const source of sources) {
      await triggerSync(source);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Data Sync</h1>
        <p className="text-muted-foreground">
          Manage cached occupational data from external sources
        </p>
      </div>

      {/* Data Freshness Dashboard */}
      {!loading && statuses.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Data Freshness
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={syncAll}
                disabled={!!isSyncingAny}
              >
                {isSyncingAny ? (
                  <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Syncing...</>
                ) : (
                  <><RefreshCw className="mr-1 h-3 w-3" />Sync All</>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {statuses.map((s) => {
                const freshness = getFreshnessInfo(s.lastSync);
                return (
                  <div
                    key={s.source}
                    className={`rounded-lg p-3 ${freshness.bgClass}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{s.source}</span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${freshness.textClass} border-current`}
                      >
                        {freshness.label}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p>{getDaysSinceSync(s.lastSync)}</p>
                      <p className="font-medium">
                        {s.recordCount.toLocaleString()} records
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-3 border-t flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-green-500" /> Fresh (&lt;3 months)
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-yellow-500" /> Aging (3-12 months)
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-500" /> Stale (&gt;12 months)
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Auto-Sync Status Card */}
      {autoSync && (
        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="font-medium flex items-center gap-2">
                    Automatic Sync
                    <Badge
                      variant={autoSync.enabled ? "default" : "outline"}
                      className="text-xs"
                    >
                      {autoSync.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {autoSync.schedule}
                    {autoSync.isSyncing && (
                      <span className="text-blue-600 ml-2">
                        <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
                        Sync in progress...
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Button
                variant="default"
                onClick={() => triggerSync("ALL")}
                disabled={!!isSyncingAny}
              >
                {syncing["ALL"] ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="mr-2 h-4 w-4" />
                )}
                {syncing["ALL"] ? "Syncing All..." : "Sync All Now"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Loading sync status...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {statuses.map((s) => (
            <Card key={s.source}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  {s.source}
                </CardTitle>
                <Badge
                  variant={s.recordCount > 0 ? "default" : "outline"}
                >
                  {s.recordCount > 0 ? (
                    <>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {s.recordCount.toLocaleString()}
                      {s.totalOccupations > 0 && s.recordCount < s.totalOccupations
                        ? ` / ${s.totalOccupations.toLocaleString()}`
                        : ""}{" "}
                      records
                    </>
                  ) : (
                    "No data"
                  )}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {sourceDescriptions[s.source] ?? s.source}
                </p>
                <div className="text-xs text-muted-foreground">
                  {s.lastSync ? (
                    <p>
                      Last sync:{" "}
                      {new Date(s.lastSync).toLocaleString()}
                    </p>
                  ) : (
                    <p>Never synced</p>
                  )}
                  {s.version && <p>Version: {s.version}</p>}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => triggerSync(s.source)}
                  disabled={!!syncing[s.source] || !!isSyncingAny}
                >
                  {syncing[s.source] ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  {syncing[s.source] ? "Syncing..." : "Sync Now"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Data Source Information</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>O*NET:</strong> All occupations are synced via the browse
            API at{" "}
            <span className="font-mono text-xs">api-v2.onetcenter.org</span>.
            This includes tasks, detailed work activities, tools and technology,
            knowledge, skills, abilities, work activities, work context, related
            occupations, and job zone data.
          </p>
          <p>
            <strong>OEWS &amp; ORS:</strong> Fetched from the Bureau of Labor
            Statistics API. OEWS provides national employment and wage
            statistics. Due to BLS daily API limits (500 queries/day), OEWS
            data is synced incrementally — ~700 occupations per daily run,
            prioritising occupations with missing or oldest data. Full
            coverage is achieved in ~2 daily runs. ORS provides comprehensive
            physical, environmental, cognitive, and education/training demands.
          </p>
          <p>
            <strong>Auto-Sync:</strong> Data is automatically synced daily at
            5:00 AM. On server startup, a sync is triggered if data is older
            than 23 hours. OEWS syncs are incremental to respect BLS API
            limits — records will grow each day until all occupations are
            covered. All sync operations are tracked in the DataSyncLog for
            auditability.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
