"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, CheckCircle2, Archive, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CaseItem {
  id: string;
  clientName: string;
  evaluatorName: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count: { pastRelevantWork: number; analyses: number };
}

const STATUS_TABS = ["all", "active", "completed", "archived"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

const STATUS_BADGE_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800 border-green-300",
  completed: "bg-blue-100 text-blue-800 border-blue-300",
  archived: "bg-gray-100 text-gray-600 border-gray-300",
};

export default function CasesPage() {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusTab>("all");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/cases")
      .then((r) => r.json())
      .then((data) => setCases(Array.isArray(data) ? data : []))
      .catch(() => {
        toast.error("Failed to load data");
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = cases.filter((c) => {
    const matchesSearch = c.clientName
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    all: cases.length,
    active: cases.filter((c) => c.status === "active").length,
    completed: cases.filter((c) => c.status === "completed").length,
    archived: cases.filter((c) => c.status === "archived").length,
  };

  async function updateStatus(caseId: string, newStatus: string) {
    setUpdatingId(caseId);
    try {
      const res = await fetch(`/api/cases/${caseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setCases((prev) =>
          prev.map((c) => (c.id === caseId ? { ...c, status: newStatus } : c))
        );
        toast.success(`Case marked as ${newStatus}`);
      } else {
        toast.error("Failed to update status");
      }
    } catch {
      toast.error("Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cases</h1>
        <Link href="/cases/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Case
          </Button>
        </Link>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-1 border-b">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
              statusFilter === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
            <span className="ml-1.5 text-xs text-muted-foreground">
              ({statusCounts[tab]})
            </span>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search cases..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">
              {search || statusFilter !== "all"
                ? "No matching cases"
                : "No cases yet"}
            </p>
            {!search && statusFilter === "all" && (
              <Link href="/cases/new">
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Create your first case
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <Card key={c.id} className="hover:bg-muted/50 transition-colors">
              <CardContent className="flex items-center justify-between py-4">
                <Link href={`/cases/${c.id}`} className="flex-1 min-w-0">
                  <div>
                    <p className="font-medium">{c.clientName}</p>
                    <p className="text-sm text-muted-foreground">
                      {c.evaluatorName && `Evaluator: ${c.evaluatorName} | `}
                      {c._count.pastRelevantWork} PRW | {c._count.analyses}{" "}
                      analyses
                    </p>
                  </div>
                </Link>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <Badge
                    variant="outline"
                    className={`text-xs ${STATUS_BADGE_COLORS[c.status] ?? ""}`}
                  >
                    {c.status}
                  </Badge>
                  {/* Quick status actions */}
                  {c.status === "active" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      disabled={updatingId === c.id}
                      onClick={(e) => {
                        e.preventDefault();
                        updateStatus(c.id, "completed");
                      }}
                    >
                      {updatingId === c.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3" />
                      )}
                      Complete
                    </Button>
                  )}
                  {c.status === "completed" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      disabled={updatingId === c.id}
                      onClick={(e) => {
                        e.preventDefault();
                        updateStatus(c.id, "archived");
                      }}
                    >
                      {updatingId === c.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Archive className="h-3 w-3" />
                      )}
                      Archive
                    </Button>
                  )}
                  {c.status === "archived" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      disabled={updatingId === c.id}
                      onClick={(e) => {
                        e.preventDefault();
                        updateStatus(c.id, "active");
                      }}
                    >
                      {updatingId === c.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3" />
                      )}
                      Reactivate
                    </Button>
                  )}
                  <span className="text-sm text-muted-foreground">
                    {new Date(c.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
