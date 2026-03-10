"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, Download, ChevronDown, ChevronUp, ExternalLink, DollarSign, TrendingUp, ArrowUpDown, Sparkles, Loader2, RefreshCw, AlertTriangle, BarChart3 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Fragment } from "react";
import { CaseBreadcrumb } from "@/components/case-breadcrumb";

interface AnalysisResult {
  id: string;
  name: string | null;
  status: string;
  ageRule: string | null;
  priorEarnings: number | null;
  preInjuryViableCount: number | null;
  preInjuryTotalEmployment: number | null;
  preInjuryJoltsOpenings: number | null;
  postInjuryViableCount: number | null;
  postInjuryTotalEmployment: number | null;
  postInjuryJoltsOpenings: number | null;
  // MVQS aggregates
  mvqsPostEcMedian: number | null;
  mvqsPreEcMedian: number | null;
  mvqsEcLoss: number | null;
  mvqsEcLossPct: number | null;
  case: { clientName: string; id: string; dateOfInjury: string | null };
  targetOccupations: TargetOcc[];
}

interface TargetOcc {
  id: string;
  onetSocCode: string;
  title: string;
  svp: number | null;
  stq: number | null;
  stqDetails: Record<string, unknown> | null;
  tfq: number | null;
  tfqDetails: Record<string, unknown> | null;
  vaq: number | null;
  vaqDetails: Record<string, unknown> | null;
  lmq: number | null;
  lmqDetails: Record<string, unknown> | null;
  pvq: number | null;
  excluded: boolean;
  exclusionReason: string | null;
  confidenceGrade: string | null;
  preTfq: number | null;
  preTfqPasses: boolean | null;
  preTfqDetails: Record<string, unknown> | null;
  joltsIndustryCode: string | null;
  joltsIndustryName: string | null;
  joltsCurrentOpenings: number | null;
  joltsPreInjuryOpenings: number | null;
  // MVQS fields
  vqScore: number | null;
  vqBand: number | null;
  vqDetails: Record<string, unknown> | null;
  tspScore: number | null;
  tspTier: number | null;
  tspLabel: string | null;
  tspDetails: Record<string, unknown> | null;
  ecMedian: number | null;
  ecMean: number | null;
  ec10: number | null;
  ec25: number | null;
  ec75: number | null;
  ec90: number | null;
  ecSee: number | null;
  ecConfLow: number | null;
  ecConfHigh: number | null;
  ecGeoAdjusted: boolean | null;
  ecDetails: Record<string, unknown> | null;
  preVqScore: number | null;
  preEcMedian: number | null;
  preEcDetails: Record<string, unknown> | null;
}

function ScoreCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">{"\u2014"}</span>;
  const pct = value;
  let color = "text-red-600";
  if (pct >= 70) color = "text-green-600";
  else if (pct >= 40) color = "text-yellow-600";
  return <span className={`font-mono font-bold ${color}`}>{value.toFixed(1)}</span>;
}

function getGradeColor(grade: string | null): string {
  switch (grade) {
    case "A": return "bg-green-100 text-green-800";
    case "B": return "bg-blue-100 text-blue-800";
    case "C": return "bg-yellow-100 text-yellow-800";
    case "D": return "bg-red-100 text-red-800";
    default: return "";
  }
}

function formatUSD(val: unknown): string {
  if (typeof val !== "number") return "\u2014";
  return "$" + val.toLocaleString();
}

function formatHourly(val: number | null): string {
  if (val === null) return "\u2014";
  return `$${val.toFixed(2)}`;
}

function getVQBandColor(band: number | null): string {
  switch (band) {
    case 1: return "bg-blue-100 text-blue-800";
    case 2: return "bg-green-100 text-green-800";
    case 3: return "bg-amber-100 text-amber-800";
    case 4: return "bg-red-100 text-red-800";
    default: return "";
  }
}

function getVQBandLabel(band: number | null): string {
  switch (band) {
    case 1: return "Below/Mid-Avg";
    case 2: return "Mid/High-Avg";
    case 3: return "High/Very-High";
    case 4: return "Extremely High";
    default: return "\u2014";
  }
}

function getTSPTierColor(tier: number | null): string {
  switch (tier) {
    case 5: return "bg-green-100 text-green-800";
    case 4: return "bg-emerald-100 text-emerald-800";
    case 3: return "bg-yellow-100 text-yellow-800";
    case 2: return "bg-orange-100 text-orange-800";
    case 1: return "bg-red-100 text-red-800";
    default: return "";
  }
}

function formatNum(val: unknown): string {
  if (typeof val !== "number") return "\u2014";
  return val.toLocaleString();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getNestedVal(obj: any, ...keys: string[]): unknown {
  let cur = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[k];
  }
  return cur;
}

export default function ResultsPage() {
  const params = useParams();
  const caseId = params.id as string;
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [selected, setSelected] = useState<AnalysisResult | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [narrative, setNarrative] = useState("");
  const [generatingNarrative, setGeneratingNarrative] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/cases/${caseId}/analysis`);
      const raw = await res.json();
      const data = Array.isArray(raw) ? raw : [];
      const completed = data.filter(
        (a: AnalysisResult) => a.status === "completed"
      );
      setAnalyses(completed);
      if (completed.length > 0) setSelected(completed[0]);
    } catch {
      toast.error("Failed to load data");
    }
    setLoading(false);
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  async function downloadReport() {
    if (!selected) return;
    setDownloading(true);
    try {
      const res = await fetch(
        `/api/cases/${caseId}/analysis/${selected.id}/report`
      );
      if (!res.ok) throw new Error("Failed to generate report");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") ??
        "PVQ-TM_Report.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Something went wrong");
    }
    setDownloading(false);
  }

  async function generateNarrative() {
    if (!selected) return;
    setGeneratingNarrative(true);
    try {
      const viableOccs = selected.targetOccupations
        .filter((t) => !t.excluded)
        .sort((a, b) => (b.pvq ?? 0) - (a.pvq ?? 0));
      const excludedOccs = selected.targetOccupations.filter((t) => t.excluded);

      const topOccupations = viableOccs.slice(0, 5).map((t) => {
        const d = (t.lmqDetails as Record<string, unknown>)?.details as Record<string, unknown> | undefined;
        return {
          title: t.title,
          pvq: t.pvq ?? 0,
          medianWage: (d?.medianWage as number) ?? null,
          grade: t.confidenceGrade ?? "—",
        };
      });

      const res = await fetch("/api/ai/narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: selected.case?.clientName ?? "Client",
          ageRule: selected.ageRule ?? "standard",
          priorEarnings: selected.priorEarnings,
          prwSummary: "Past relevant work analyzed per case file",
          viableCount: viableOccs.length,
          excludedCount: excludedOccs.length,
          topOccupations,
        }),
      });

      if (res.status === 503) {
        toast.error("AI not available — OpenAI key not configured");
        return;
      }

      const data = await res.json();
      if (data.narrative) {
        setNarrative(data.narrative);
        toast.success("Vocational opinion generated!");
      } else {
        toast.error("Failed to generate narrative");
      }
    } catch {
      toast.error("Failed to generate narrative");
    }
    setGeneratingNarrative(false);
  }

  if (loading) return <div className="p-6">Loading...</div>;

  if (!selected) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Results</h1>
        <Card>
          <CardContent className="py-8 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              No completed analyses yet. Run an analysis first.
            </p>
            <Link href={`/cases/${caseId}/analysis`}>
              <Button variant="outline">Go to Analysis</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const viable = selected.targetOccupations
    .filter((t) => !t.excluded)
    .sort((a, b) => (b.pvq ?? 0) - (a.pvq ?? 0));
  const excluded = selected.targetOccupations.filter((t) => t.excluded);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <CaseBreadcrumb caseId={caseId} currentPage="Results" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analysis Results</h1>
          <p className="text-muted-foreground">
            {selected.case?.clientName} — {selected.name ?? "Analysis"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={getGradeColor(null)} variant="outline">
            {selected.ageRule === "advanced_age"
              ? "Advanced Age"
              : selected.ageRule === "closely_approaching"
                ? "Closely Approaching"
                : "Standard"}{" "}
            Rule
          </Badge>
          <Button onClick={downloadReport} disabled={downloading}>
            <Download className="mr-2 h-4 w-4" />
            {downloading ? "Generating..." : "Download PDF Report"}
          </Button>
        </div>
      </div>

      {/* Analysis Selector */}
      {analyses.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {analyses.map((a) => (
            <Button
              key={a.id}
              variant={selected?.id === a.id ? "default" : "outline"}
              size="sm"
              onClick={() => { setSelected(a); setExpandedRow(null); }}
            >
              {a.name ?? "Analysis"}
            </Button>
          ))}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Candidates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{selected.targetOccupations.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Viable</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{viable.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Excluded</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{excluded.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top PVQ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {viable.length > 0 ? Math.max(...viable.map((t) => t.pvq ?? 0)).toFixed(1) : "\u2014"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Prior Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {selected.priorEarnings ? formatUSD(selected.priorEarnings) : "\u2014"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Labor Market Access — Pre/Post Injury Comparison */}
      {selected.preInjuryViableCount !== null && selected.preInjuryViableCount !== undefined && (
        <Card className="border-amber-200 bg-amber-50/30 dark:border-amber-800 dark:bg-amber-950/20">
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Labor Market Access — Pre vs. Post Injury
              </CardTitle>
              <Link href={`/cases/${caseId}/comparison${selected ? `?analysisId=${selected.id}` : ""}`}>
                <Button variant="outline" size="sm">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  View Detailed Comparison
                </Button>
              </Link>
            </div>
            {selected.case?.dateOfInjury && (
              <p className="text-sm text-muted-foreground">
                Date of Injury: {new Date(selected.case.dateOfInjury).toLocaleDateString()}
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Occupations */}
              <div className="rounded-lg border p-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Accessible Occupations</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Pre-Injury</p>
                    <p className="text-2xl font-bold text-blue-600">{selected.preInjuryViableCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Post-Injury</p>
                    <p className="text-2xl font-bold text-amber-600">{selected.postInjuryViableCount ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Lost</p>
                    <p className="text-2xl font-bold text-red-600">
                      {selected.preInjuryViableCount - (selected.postInjuryViableCount ?? 0)}
                    </p>
                    <p className="text-xs text-red-500">
                      {selected.preInjuryViableCount > 0
                        ? `(${(((selected.preInjuryViableCount - (selected.postInjuryViableCount ?? 0)) / selected.preInjuryViableCount) * 100).toFixed(0)}%)`
                        : ""}
                    </p>
                  </div>
                </div>
              </div>

              {/* Employment */}
              <div className="rounded-lg border p-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Employment</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Pre-Injury</p>
                    <p className="text-lg font-bold text-blue-600">
                      {selected.preInjuryTotalEmployment !== null
                        ? (selected.preInjuryTotalEmployment / 1000).toFixed(0) + "K"
                        : "\u2014"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Post-Injury</p>
                    <p className="text-lg font-bold text-amber-600">
                      {selected.postInjuryTotalEmployment !== null
                        ? ((selected.postInjuryTotalEmployment ?? 0) / 1000).toFixed(0) + "K"
                        : "\u2014"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Lost</p>
                    <p className="text-lg font-bold text-red-600">
                      {selected.preInjuryTotalEmployment !== null && selected.postInjuryTotalEmployment !== null
                        ? ((selected.preInjuryTotalEmployment - (selected.postInjuryTotalEmployment ?? 0)) / 1000).toFixed(0) + "K"
                        : "\u2014"}
                    </p>
                  </div>
                </div>
              </div>

              {/* JOLTS Openings */}
              <div className="rounded-lg border p-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">JOLTS Openings (thousands)</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Pre-Injury</p>
                    <p className="text-lg font-bold text-blue-600">
                      {selected.preInjuryJoltsOpenings !== null
                        ? selected.preInjuryJoltsOpenings.toFixed(0) + "K"
                        : "\u2014"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Current</p>
                    <p className="text-lg font-bold text-amber-600">
                      {selected.postInjuryJoltsOpenings !== null
                        ? (selected.postInjuryJoltsOpenings ?? 0).toFixed(0) + "K"
                        : "\u2014"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Change</p>
                    <p className="text-lg font-bold text-red-600">
                      {selected.preInjuryJoltsOpenings !== null && selected.postInjuryJoltsOpenings !== null
                        ? ((selected.postInjuryJoltsOpenings ?? 0) - selected.preInjuryJoltsOpenings).toFixed(0) + "K"
                        : "\u2014"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* MVQS Earning Capacity Summary */}
      {(selected.mvqsPostEcMedian !== null || selected.mvqsPreEcMedian !== null) && (
        <Card className="border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              MVQS Earning Capacity Analysis
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Vocational Quotient-based earning capacity estimates with OEWS wage data and ECLR geographic adjustments.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {selected.mvqsPreEcMedian !== null && (
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pre-Injury EC</p>
                  <p className="text-2xl font-bold text-blue-600">{formatHourly(selected.mvqsPreEcMedian)}/hr</p>
                  <p className="text-xs text-muted-foreground">${((selected.mvqsPreEcMedian ?? 0) * 2080).toLocaleString("en-US", { maximumFractionDigits: 0 })}/yr</p>
                </div>
              )}
              <div className="rounded-lg border p-4 text-center">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Post-Injury EC</p>
                <p className="text-2xl font-bold text-amber-600">{formatHourly(selected.mvqsPostEcMedian)}/hr</p>
                <p className="text-xs text-muted-foreground">${((selected.mvqsPostEcMedian ?? 0) * 2080).toLocaleString("en-US", { maximumFractionDigits: 0 })}/yr</p>
              </div>
              {selected.mvqsEcLoss !== null && (
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">EC Loss</p>
                  <p className={`text-2xl font-bold ${(selected.mvqsEcLoss ?? 0) > 0 ? "text-red-600" : "text-green-600"}`}>
                    {(selected.mvqsEcLoss ?? 0) > 0 ? "-" : "+"}{formatHourly(Math.abs(selected.mvqsEcLoss ?? 0))}/hr
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ${(Math.abs((selected.mvqsEcLoss ?? 0)) * 2080).toLocaleString("en-US", { maximumFractionDigits: 0 })}/yr
                  </p>
                </div>
              )}
              {selected.mvqsEcLossPct !== null && (
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Loss %</p>
                  <p className={`text-2xl font-bold ${(selected.mvqsEcLossPct ?? 0) > 0 ? "text-red-600" : "text-green-600"}`}>
                    {selected.mvqsEcLossPct.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Earning capacity reduction</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Viable Occupations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Viable Occupations ({viable.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="table-fixed md:table-auto">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8 md:w-8" />
                  <TableHead className="hidden md:table-cell">Rank</TableHead>
                  <TableHead className="hidden md:table-cell">O*NET</TableHead>
                  <TableHead className="md:min-w-[180px]">Title</TableHead>
                <TableHead className="hidden md:table-cell">SVP</TableHead>
                <TableHead className="hidden md:table-cell text-right">STQ</TableHead>
                <TableHead className="hidden md:table-cell text-right">TFQ</TableHead>
                <TableHead className="hidden md:table-cell text-right">VAQ</TableHead>
                <TableHead className="hidden md:table-cell text-right">LMQ</TableHead>
                <TableHead className="w-14 md:w-auto text-right">PVQ</TableHead>
                <TableHead className="hidden md:table-cell text-right">VQ</TableHead>
                <TableHead className="hidden md:table-cell text-right">TSP</TableHead>
                <TableHead className="hidden md:table-cell text-right">EC $/hr</TableHead>
                <TableHead className="w-14 md:w-auto text-center">Grade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {viable.map((t, i) => (
                <Fragment key={t.id}>
                  <TableRow
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setExpandedRow(expandedRow === t.id ? null : t.id)}
                  >
                    <TableCell>
                      {expandedRow === t.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </TableCell>
                    <TableCell className="hidden md:table-cell font-bold">{i + 1}</TableCell>
                    <TableCell className="hidden md:table-cell font-mono text-xs">{t.onetSocCode}</TableCell>
                    <TableCell className="font-medium">
                      <span className="md:hidden text-xs text-muted-foreground">#{i + 1} · </span>
                      {t.title}
                      <span className="block md:hidden text-xs text-muted-foreground font-mono">{t.onetSocCode}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{t.svp ?? "\u2014"}</TableCell>
                    <TableCell className="hidden md:table-cell text-right"><ScoreCell value={t.stq} /></TableCell>
                    <TableCell className="hidden md:table-cell text-right"><ScoreCell value={t.tfq} /></TableCell>
                    <TableCell className="hidden md:table-cell text-right"><ScoreCell value={t.vaq} /></TableCell>
                    <TableCell className="hidden md:table-cell text-right"><ScoreCell value={t.lmq} /></TableCell>
                    <TableCell className="text-right"><ScoreCell value={t.pvq} /></TableCell>
                    <TableCell className="hidden md:table-cell text-right">
                      {t.vqScore !== null ? (
                        <div className="flex items-center justify-end gap-1">
                          <span className="font-mono text-sm">{t.vqScore.toFixed(0)}</span>
                          <Badge className={`${getVQBandColor(t.vqBand)} text-[10px] px-1`} variant="outline">
                            B{t.vqBand}
                          </Badge>
                        </div>
                      ) : "\u2014"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right">
                      {t.tspScore !== null ? (
                        <div className="flex items-center justify-end gap-1">
                          <span className="font-mono text-sm">{t.tspScore.toFixed(0)}%</span>
                          <Badge className={`${getTSPTierColor(t.tspTier)} text-[10px] px-1`} variant="outline">
                            T{t.tspTier}
                          </Badge>
                        </div>
                      ) : "\u2014"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right">
                      {t.ecMedian !== null ? (
                        <span className="font-mono text-sm font-semibold text-green-700">{formatHourly(t.ecMedian)}</span>
                      ) : "\u2014"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={getGradeColor(t.confidenceGrade)} variant="outline">
                        {t.confidenceGrade ?? "\u2014"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                  {expandedRow === t.id && (
                    <TableRow>
                      <TableCell colSpan={14}>
                        <div className="p-4 bg-muted/30 rounded-md space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4 text-sm">
                            {/* STQ Details */}
                            <div>
                              <p className="font-medium mb-2">STQ Components</p>
                              {t.stqDetails && (
                                <div className="space-y-1 text-muted-foreground text-xs">
                                  <p>Task/DWA: {(getNestedVal(t.stqDetails, "components", "taskDwaOverlap") as number)?.toFixed(1) ?? "\u2014"}</p>
                                  <p>WF/MPSMS: {(getNestedVal(t.stqDetails, "components", "wfMpsmsOverlap") as number)?.toFixed(1) ?? "\u2014"}</p>
                                  <p>Tools: {(getNestedVal(t.stqDetails, "components", "toolsOverlap") as number)?.toFixed(1) ?? "\u2014"}</p>
                                  <p>Materials: {(getNestedVal(t.stqDetails, "components", "materialsOverlap") as number)?.toFixed(1) ?? "\u2014"}</p>
                                  <p>Credentials: {(getNestedVal(t.stqDetails, "components", "credentialOverlap") as number)?.toFixed(1) ?? "\u2014"}</p>
                                </div>
                              )}
                            </div>

                            {/* TFQ Details */}
                            <div>
                              <p className="font-medium mb-2">TFQ Details</p>
                              <div className="space-y-1 text-muted-foreground text-xs">
                                <p>Reserve Margin: {(getNestedVal(t.tfqDetails, "reserveMargin") as number)?.toFixed(1) ?? "\u2014"}%</p>
                                <p>Traits Passing: {(getNestedVal(t.tfqDetails, "traitsPassing") as number) ?? "\u2014"}/24</p>
                                {t.tfqDetails && (getNestedVal(t.tfqDetails, "failedTraits") as string[])?.length > 0 && (
                                  <p className="text-red-500">Failed: {(getNestedVal(t.tfqDetails, "failedTraits") as string[])?.join(", ")}</p>
                                )}
                              </div>
                            </div>

                            {/* VAQ Details */}
                            <div>
                              <p className="font-medium mb-2">VAQ Adjustment</p>
                              {t.vaqDetails && (
                                <div className="space-y-1 text-muted-foreground text-xs">
                                  <p>Tools: {getNestedVal(t.vaqDetails, "adjustment", "tools") as number ?? "\u2014"}/100</p>
                                  <p>Processes: {getNestedVal(t.vaqDetails, "adjustment", "workProcesses") as number ?? "\u2014"}/100</p>
                                  <p>Setting: {getNestedVal(t.vaqDetails, "adjustment", "workSetting") as number ?? "\u2014"}/100</p>
                                  <p>Industry: {getNestedVal(t.vaqDetails, "adjustment", "industry") as number ?? "\u2014"}/100</p>
                                </div>
                              )}
                            </div>

                            {/* LMQ Details */}
                            <div>
                              <p className="font-medium mb-2">Labor Market Data</p>
                              {t.lmqDetails && (
                                <div className="space-y-1 text-muted-foreground text-xs">
                                  <p>Employment: {formatNum(getNestedVal(t.lmqDetails, "details", "employment"))}</p>
                                  <p>Median Wage: {formatUSD(getNestedVal(t.lmqDetails, "details", "medianWage"))}</p>
                                  <p>Mean Wage: {formatUSD(getNestedVal(t.lmqDetails, "details", "meanWage"))}</p>
                                  <p>Projected Openings: {formatNum(getNestedVal(t.lmqDetails, "details", "openingsAnnual"))}</p>
                                  <p>Projected Growth: {(getNestedVal(t.lmqDetails, "details", "changePct") as number)?.toFixed(1) ?? "\u2014"}%</p>
                                </div>
                              )}
                            </div>

                            {/* JOLTS / Pre-Injury Data */}
                            <div>
                              <p className="font-medium mb-2">Industry & Pre-Injury</p>
                              <div className="space-y-1 text-muted-foreground text-xs">
                                {t.joltsIndustryName && (
                                  <p>Industry: {t.joltsIndustryName}</p>
                                )}
                                {t.joltsCurrentOpenings !== null && (
                                  <p>JOLTS Openings (Current): {t.joltsCurrentOpenings.toFixed(1)}K</p>
                                )}
                                {t.joltsPreInjuryOpenings !== null && (
                                  <p>JOLTS Openings (At DOI): {t.joltsPreInjuryOpenings.toFixed(1)}K</p>
                                )}
                                {t.preTfqPasses !== null && (
                                  <p>
                                    Pre-Injury TFQ:{" "}
                                    <span className={t.preTfqPasses ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                                      {t.preTfqPasses ? "PASS" : "FAIL"}
                                    </span>
                                    {t.preTfq !== null && ` (${t.preTfq.toFixed(1)})`}
                                  </p>
                                )}
                                {t.preTfqPasses === null && (
                                  <p className="italic">No pre-injury profile</p>
                                )}
                              </div>
                            </div>

                            {/* MVQS Analysis */}
                            <div>
                              <p className="font-medium mb-2">MVQS Analysis</p>
                              <div className="space-y-1 text-muted-foreground text-xs">
                                {t.vqScore !== null && (
                                  <>
                                    <p>VQ Score: <span className="font-semibold text-foreground">{t.vqScore.toFixed(1)}</span></p>
                                    <p>VQ Band: <Badge className={`${getVQBandColor(t.vqBand)} text-[10px] px-1`} variant="outline">Band {t.vqBand}</Badge> {getVQBandLabel(t.vqBand)}</p>
                                  </>
                                )}
                                {t.tspScore !== null && (
                                  <>
                                    <p>TSP: <span className="font-semibold text-foreground">{t.tspScore.toFixed(1)}%</span> (Tier {t.tspTier})</p>
                                    <p className="text-[10px] leading-tight">{t.tspLabel}</p>
                                  </>
                                )}
                                {t.ecMedian !== null && (
                                  <>
                                    <Separator className="my-1" />
                                    <p>EC Median: <span className="font-semibold text-green-700">{formatHourly(t.ecMedian)}/hr</span></p>
                                    <p>EC Mean: {formatHourly(t.ecMean)}/hr</p>
                                    <p>95% CI: [{formatHourly(t.ecConfLow)}, {formatHourly(t.ecConfHigh)}]</p>
                                    <p>SEE: {formatHourly(t.ecSee)}/hr</p>
                                    {t.ecGeoAdjusted && (
                                      <p className="text-blue-600">ECLR Geo-Adjusted</p>
                                    )}
                                  </>
                                )}
                                {t.preEcMedian !== null && (
                                  <p>Pre-Injury EC: {formatHourly(t.preEcMedian)}/hr</p>
                                )}
                              </div>
                            </div>
                          </div>

                          <Separator />
                          <div className="flex gap-2">
                            <Link href={`/occupations/${t.onetSocCode}`}>
                              <Button variant="outline" size="sm">
                                <ExternalLink className="mr-1 h-3 w-3" />
                                View Occupation Details
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Wage Comparison for Viable Occupations */}
      {viable.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Wage Comparison — Viable Occupations
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Annual wage data from the Bureau of Labor Statistics (OEWS).
              {selected.priorEarnings
                ? ` Prior earnings of ${formatUSD(selected.priorEarnings)} shown for comparison.`
                : " Set prior earnings on the analysis to see wage differentials."}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
            <Table className="table-fixed md:table-auto">
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden md:table-cell">Rank</TableHead>
                  <TableHead className="md:min-w-[180px]">Occupation</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Employment</TableHead>
                  <TableHead className="hidden md:table-cell text-right">10th %ile</TableHead>
                  <TableHead className="hidden md:table-cell text-right">25th %ile</TableHead>
                  <TableHead className="w-20 md:w-auto text-right">Median</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Mean</TableHead>
                  <TableHead className="hidden md:table-cell text-right">75th %ile</TableHead>
                  <TableHead className="hidden md:table-cell text-right">90th %ile</TableHead>
                  {selected.priorEarnings && (
                    <TableHead className="w-16 md:w-auto text-right">vs. Prior</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {viable.map((t, i) => {
                  const lmq = t.lmqDetails as Record<string, unknown> | null;
                  const d = lmq?.details as Record<string, unknown> | undefined;
                  const medianWage = (d?.medianWage as number) ?? null;
                  const meanWage = (d?.meanWage as number) ?? null;
                  const employment = (d?.employment as number) ?? null;
                  const pct10 = (d?.pct10 as number) ?? null;
                  const pct25 = (d?.pct25 as number) ?? null;
                  const pct75 = (d?.pct75 as number) ?? null;
                  const pct90 = (d?.pct90 as number) ?? null;

                  const priorDiff =
                    selected.priorEarnings && medianWage
                      ? ((medianWage - selected.priorEarnings) / selected.priorEarnings) * 100
                      : null;

                  return (
                    <TableRow key={t.id}>
                      <TableCell className="hidden md:table-cell font-bold">{i + 1}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">
                            <span className="md:hidden text-xs text-muted-foreground">#{i + 1} · </span>
                            {t.title}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">{t.onetSocCode}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-right text-sm">
                        {employment !== null ? formatNum(employment) : "\u2014"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-right text-sm text-muted-foreground">
                        {pct10 !== null ? formatUSD(pct10) : "\u2014"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-right text-sm text-muted-foreground">
                        {pct25 !== null ? formatUSD(pct25) : "\u2014"}
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold">
                        {medianWage !== null ? formatUSD(medianWage) : "\u2014"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-right text-sm">
                        {meanWage !== null ? formatUSD(meanWage) : "\u2014"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-right text-sm text-muted-foreground">
                        {pct75 !== null ? formatUSD(pct75) : "\u2014"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-right text-sm text-muted-foreground">
                        {pct90 !== null ? formatUSD(pct90) : "\u2014"}
                      </TableCell>
                      {selected.priorEarnings && (
                        <TableCell className="text-right text-sm">
                          {priorDiff !== null ? (
                            <span
                              className={`font-semibold ${
                                priorDiff >= 0 ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              {priorDiff >= 0 ? "+" : ""}
                              {priorDiff.toFixed(0)}%
                            </span>
                          ) : (
                            "\u2014"
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>

            {/* Wage Summary Stats */}
            {(() => {
              const wages = viable
                .map((t) => {
                  const d = (t.lmqDetails as Record<string, unknown>)?.details as Record<string, unknown> | undefined;
                  return (d?.medianWage as number) ?? null;
                })
                .filter((w): w is number => w !== null);

              if (wages.length === 0) return null;

              const minWage = Math.min(...wages);
              const maxWage = Math.max(...wages);
              const avgWage = wages.reduce((a, b) => a + b, 0) / wages.length;

              return (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4 pt-2">
                  <div className="rounded-md border p-3 text-center">
                    <p className="text-xs text-muted-foreground">Lowest Median</p>
                    <p className="text-lg font-bold">{formatUSD(minWage)}</p>
                  </div>
                  <div className="rounded-md border p-3 text-center">
                    <p className="text-xs text-muted-foreground">Average Median</p>
                    <p className="text-lg font-bold">{formatUSD(Math.round(avgWage))}</p>
                  </div>
                  <div className="rounded-md border p-3 text-center">
                    <p className="text-xs text-muted-foreground">Highest Median</p>
                    <p className="text-lg font-bold">{formatUSD(maxWage)}</p>
                  </div>
                  <div className="rounded-md border p-3 text-center">
                    <p className="text-xs text-muted-foreground">Wage Range</p>
                    <p className="text-lg font-bold">
                      {formatUSD(maxWage - minWage)}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Visual wage bars */}
            {(() => {
              const wageData = viable
                .map((t) => {
                  const d = (t.lmqDetails as Record<string, unknown>)?.details as Record<string, unknown> | undefined;
                  return {
                    title: t.title,
                    median: (d?.medianWage as number) ?? null,
                  };
                })
                .filter((w): w is { title: string; median: number } => w.median !== null);

              if (wageData.length === 0) return null;

              const maxWage = Math.max(...wageData.map((w) => w.median));

              return (
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-medium text-muted-foreground">Median Wage Comparison</p>
                  {wageData.map((w) => (
                    <div key={w.title} className="flex items-center gap-3">
                      <span className="text-xs w-24 sm:w-44 truncate text-right" title={w.title}>
                        {w.title}
                      </span>
                      <div className="flex-1 relative h-6 bg-muted/50 rounded overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 bg-green-500/70 rounded"
                          style={{ width: `${(w.median / maxWage) * 100}%` }}
                        />
                        {selected.priorEarnings && selected.priorEarnings <= maxWage && (
                          <div
                            className="absolute inset-y-0 w-px bg-red-500"
                            style={{ left: `${(selected.priorEarnings / maxWage) * 100}%` }}
                            title={`Prior Earnings: ${formatUSD(selected.priorEarnings)}`}
                          />
                        )}
                      </div>
                      <span className="text-xs font-mono w-16 sm:w-20 text-right">
                        {formatUSD(w.median)}
                      </span>
                    </div>
                  ))}
                  {selected.priorEarnings && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                      <div className="w-3 h-px bg-red-500" />
                      <span>Prior Earnings ({formatUSD(selected.priorEarnings)})</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* AI Vocational Opinion */}
      {viable.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                AI Vocational Opinion
              </CardTitle>
              <Button
                onClick={generateNarrative}
                disabled={generatingNarrative}
                variant={narrative ? "outline" : "default"}
                size="sm"
              >
                {generatingNarrative ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>
                ) : narrative ? (
                  <><RefreshCw className="mr-2 h-4 w-4" />Regenerate</>
                ) : (
                  <><Sparkles className="mr-2 h-4 w-4" />Generate Vocational Opinion</>
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              AI-generated professional vocational opinion narrative using PVQ-TM methodology.
              Review and edit before including in reports.
            </p>
          </CardHeader>
          <CardContent>
            {!narrative && !generatingNarrative && (
              <div className="text-center py-6 text-muted-foreground">
                <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Click &quot;Generate Vocational Opinion&quot; to create an AI-drafted narrative</p>
                <p className="text-xs mt-1">Uses analysis results, wage data, and transferability findings</p>
              </div>
            )}
            {generatingNarrative && (
              <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Writing vocational opinion...</span>
              </div>
            )}
            {narrative && !generatingNarrative && (
              <div className="space-y-3">
                <Textarea
                  value={narrative}
                  onChange={(e) => setNarrative(e.target.value)}
                  rows={12}
                  className="text-sm leading-relaxed"
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    AI-generated — review and edit before use in reports
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(narrative);
                      toast.success("Copied to clipboard!");
                    }}
                  >
                    Copy to Clipboard
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Excluded Occupations */}
      {excluded.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Excluded Occupations ({excluded.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>O*NET</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>SVP</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {excluded.map((t) => (
                  <TableRow key={t.id} className="opacity-60">
                    <TableCell className="font-mono text-xs">{t.onetSocCode}</TableCell>
                    <TableCell>{t.title}</TableCell>
                    <TableCell>{t.svp ?? "\u2014"}</TableCell>
                    <TableCell className="text-sm text-red-600">
                      {t.exclusionReason ?? "Excluded"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PVQ Formula Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Methodology Reference</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p className="font-mono text-center py-1 bg-muted/50 rounded">
            PVQ = 0.45 &times; STQ + 0.25 &times; TFQ + 0.15 &times; VAQ + 0.15 &times; LMQ
          </p>
          <Separator />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <p><strong>STQ</strong> (Skill Transfer Quotient): Task/DWA overlap, WF/MPSMS similarity, tools, materials, credentials</p>
              <p><strong>TFQ</strong> (Trait Feasibility Quotient): 24-trait post-profile vs occupation demands</p>
            </div>
            <div>
              <p><strong>VAQ</strong> (Vocational Adjustment Quotient): Tools, processes, setting, industry adjustment</p>
              <p><strong>LMQ</strong> (Labor Market Quotient): Employment, wages, projected openings</p>
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-xs">
            <div><Badge className={getGradeColor("A")} variant="outline">A</Badge> High confidence, complete data</div>
            <div><Badge className={getGradeColor("B")} variant="outline">B</Badge> Good confidence, minor gaps</div>
            <div><Badge className={getGradeColor("C")} variant="outline">C</Badge> Moderate confidence, some gaps</div>
            <div><Badge className={getGradeColor("D")} variant="outline">D</Badge> Low confidence, significant gaps</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
