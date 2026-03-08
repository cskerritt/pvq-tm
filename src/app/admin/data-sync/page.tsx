"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Loader2, Database, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface SyncStatus {
  source: string;
  lastSync: string | null;
  recordCount: number;
  version: string | null;
  status: string;
}

export default function DataSyncPage() {
  const [statuses, setStatuses] = useState<SyncStatus[]>([]);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/sync/status");
      setStatuses(await res.json());
    } catch {
      toast.error("Failed to load data");
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
        toast.success(
          `${source} sync complete: ${data.synced ?? 0} records updated`
        );
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
    ONET: "O*NET occupational data (tasks, skills, abilities, tools, related occupations)",
    ORS: "Occupational Requirements Survey (physical, environmental, cognitive demands)",
    OEWS: "Occupational Employment & Wage Statistics (employment, wages by area)",
    PROJECTIONS: "Employment Projections (projected employment, openings)",
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Data Sync</h1>
        <p className="text-muted-foreground">
          Manage cached occupational data from external sources
        </p>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
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
                      {s.recordCount} records
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
                  disabled={!!syncing[s.source]}
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
            O*NET data is fetched from{" "}
            <span className="font-mono">services.onetcenter.org</span> using
            the O*NET Web Services API. This data includes current task
            statements, detailed work activities, tools and technology,
            knowledge, skills, and abilities.
          </p>
          <p>
            ORS, OEWS, and Projections data is fetched from the Bureau of
            Labor Statistics API. ORS provides physical, environmental, and
            cognitive job demands. OEWS provides employment and wage
            statistics.
          </p>
          <p>
            All cached data includes timestamps and version tracking for
            auditability.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
