"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  FolderOpen,
  Plus,
  Database,
  RefreshCw,
  Activity,
  ArrowRight,
  ClipboardList,
  Grid3x3,
  Briefcase,
  Wrench,
  BarChart3,
  FileText,
} from "lucide-react";

interface CaseItem {
  id: string;
  clientName: string;
  status: string;
  updatedAt: string;
  _count: { pastRelevantWork: number; analyses: number };
}

interface SyncItem {
  source: string;
  lastSync: string | null;
  recordCount: number;
  status: string;
}

const TSA_STEPS = [
  {
    num: 1,
    icon: ClipboardList,
    title: "Create a Case",
    desc: "Enter the evaluee\u2019s identifying information: name, date of birth, date of injury, evaluator name, and referral source.",
    link: "/cases/new",
    linkLabel: "New Case",
  },
  {
    num: 2,
    icon: Briefcase,
    title: "Document Past Relevant Work",
    desc: "Enter each job held in the 15 years before disability onset. Link each job to its DOT and/or O*NET code, assign SVP, strength level, skill classification, employer, dates, and duties description.",
    link: null,
    linkLabel: null,
  },
  {
    num: 3,
    icon: Grid3x3,
    title: "Complete Worker Profiles",
    desc: "Build the 4-row \u00d7 24-trait profile grid: Work History profile (DOT-based demands of past jobs), Evaluative profile (medical/FCE data), Pre-injury profile, and Post-injury profile. The Post-injury profile defines the evaluee\u2019s current functional capacity.",
    link: null,
    linkLabel: null,
  },
  {
    num: 4,
    icon: Wrench,
    title: "Extract Acquired Skills",
    desc: "For each PRW entry, identify transferable skills using the SSA format: Action Verb + Object + Context. Document tools/software, materials/services, SVP level, frequency, recency, and performance mode. Mark each skill as transferable or non-transferable per SSA criteria (SVP \u22654, >30 days learning, judgment-based).",
    link: null,
    linkLabel: null,
  },
  {
    num: 5,
    icon: BarChart3,
    title: "Run the PVQ-TM Analysis",
    desc: "The 5-step automated analysis: (1) Review PRW & Skills, (2) Generate candidate occupations via O*NET task/DWA overlap and related occupations, (3) Apply trait filter using post-injury profile, (4) Score vocational adjustment, (5) Compute PVQ scores integrating labor market data.",
    link: null,
    linkLabel: null,
  },
  {
    num: 6,
    icon: FileText,
    title: "Review Results & Generate Report",
    desc: "View ranked viable occupations with STQ, TFQ, VAQ, LMQ, and composite PVQ scores. Expand each occupation for component breakdowns. Download a court-ready PDF report with full methodology disclosure.",
    link: null,
    linkLabel: null,
  },
];

export default function Dashboard() {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/cases").then((r) => r.json()),
      fetch("/api/admin/sync/status").then((r) => r.json()),
    ])
      .then(([c, s]) => {
        setCases(c);
        setSyncStatus(s);
      })
      .catch(() => {
        toast.error("Failed to load data");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-6 md:space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">PVQ-TM Dashboard</h1>
          <p className="text-muted-foreground">
            Public Vocational Quotient — Transferable Skills Analysis
          </p>
        </div>
        <Link href="/cases/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Case
          </Button>
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cases.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Cases</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {cases.filter((c) => c.status === "active").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Cached Occupations
            </CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {syncStatus.find((s) => s.source === "ONET")?.recordCount ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Data Sources</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {syncStatus.filter((s) => s.recordCount > 0).length}/
              {syncStatus.length}
            </div>
            <p className="text-xs text-muted-foreground">synced</p>
          </CardContent>
        </Card>
      </div>

      {/* TSA Workflow Guide */}
      <Card className="border-primary/20 bg-primary/[0.02]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            How to Perform a Transferable Skills Analysis (TSA)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Follow these steps to complete a PVQ-TM analysis for an evaluee.
            Each step builds on the previous one.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {TSA_STEPS.map((step, i) => (
              <div key={step.num} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {step.num}
                  </div>
                  {i < TSA_STEPS.length - 1 && (
                    <div className="w-px flex-1 bg-border mt-1" />
                  )}
                </div>
                <div className="pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <step.icon className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold">{step.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.desc}
                  </p>
                  {step.link && (
                    <Link href={step.link} className="inline-block mt-2">
                      <Button variant="outline" size="sm">
                        {step.linkLabel}
                        <ArrowRight className="ml-1 h-3 w-3" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* PVQ Formula Quick Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">PVQ Scoring Methodology</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <p className="font-mono text-center text-base py-2 bg-muted/50 rounded-md">
            PVQ = 0.45 &times; STQ + 0.25 &times; TFQ + 0.15 &times; VAQ + 0.15 &times; LMQ
          </p>
          <Separator />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <div>
                <p className="font-semibold">STQ — Skill Transfer Quotient (45%)</p>
                <p className="text-muted-foreground text-xs">
                  Measures overlap between acquired skills and target occupation demands:
                  task/DWA similarity, work field/MPSMS overlap, tools/technology match,
                  materials/services similarity, and credential alignment.
                </p>
              </div>
              <div>
                <p className="font-semibold">TFQ — Trait Feasibility Quotient (25%)</p>
                <p className="text-muted-foreground text-xs">
                  Compares the evaluee&apos;s post-injury 24-trait profile against the target
                  occupation&apos;s demands. Any trait where demand exceeds capacity results in
                  exclusion. Reserve margin indicates how much capacity remains.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div>
                <p className="font-semibold">VAQ — Vocational Adjustment Quotient (15%)</p>
                <p className="text-muted-foreground text-xs">
                  Rates how easily the worker can adjust to the target job across four
                  dimensions: tools/equipment, work processes, work setting, and industry.
                  Advanced-age rule requires perfect scores on all.
                </p>
              </div>
              <div>
                <p className="font-semibold">LMQ — Labor Market Quotient (15%)</p>
                <p className="text-muted-foreground text-xs">
                  Evaluates labor market viability: regional employment levels, wage
                  comparison to prior earnings, and projected job openings.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Cases */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Cases</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : cases.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground mb-4">No cases yet. Create your first case to begin a TSA.</p>
              <Link href="/cases/new">
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Create your first case
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {cases.slice(0, 10).map((c) => (
                <Link
                  key={c.id}
                  href={`/cases/${c.id}`}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-md border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <span className="font-medium">{c.clientName}</span>
                    <span className="ml-3 text-sm text-muted-foreground">
                      {c._count.pastRelevantWork} PRW &middot;{" "}
                      {c._count.analyses} analyses
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        c.status === "active" ? "default" : "secondary"
                      }
                    >
                      {c.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(c.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Sources */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Data Sources</CardTitle>
          <Link href="/admin/data-sync">
            <Button variant="outline" size="sm">
              Manage
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {syncStatus.map((s) => (
              <div
                key={s.source}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div>
                  <span className="font-medium">{s.source}</span>
                  <p className="text-xs text-muted-foreground">
                    {s.recordCount} records
                    {s.lastSync
                      ? ` | Last sync: ${new Date(s.lastSync).toLocaleDateString()}`
                      : " | Never synced"}
                  </p>
                </div>
                <Badge variant={s.recordCount > 0 ? "default" : "outline"}>
                  {s.recordCount > 0 ? "Ready" : "Pending"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
