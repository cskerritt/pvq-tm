"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Play,
  CheckCircle,
  Loader2,
  ArrowRight,
  Plus,
  BarChart3,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { CaseBreadcrumb } from "@/components/case-breadcrumb";

interface AnalysisData {
  id: string;
  name: string | null;
  status: string;
  step: number;
  ageRule: string | null;
  priorEarnings: number | null;
  targetArea: string | null;
  targetAreaName: string | null;
  targetOccupations: TargetOcc[];
}

interface TargetOcc {
  id: string;
  onetSocCode: string;
  title: string;
  svp: number | null;
  stq: number | null;
  tfq: number | null;
  vaq: number | null;
  lmq: number | null;
  pvq: number | null;
  excluded: boolean;
  exclusionReason: string | null;
  confidenceGrade: string | null;
}

const STEPS = [
  {
    num: 1,
    label: "Review PRW & Skills",
    desc: "Confirm that all Past Relevant Work and Acquired Skills are complete and accurate before generating candidates.",
    action: null,
  },
  {
    num: 2,
    label: "Generate Candidates",
    desc: "Search O*NET for target occupations using task/DWA overlap, related occupations, and Career Changers data. Candidates are filtered to same or lower SVP.",
    action: "generate-candidates",
  },
  {
    num: 3,
    label: "Trait Filter",
    desc: "Apply the evaluee\u2019s Post-injury 24-trait profile against each candidate\u2019s occupational demands. Occupations where any trait demand exceeds capacity are excluded.",
    action: "filter-traits",
  },
  {
    num: 4,
    label: "Vocational Adjustment",
    desc: "Rate how easily the worker can adjust to each surviving occupation across tools/equipment, work processes, work setting, and industry. Advanced-age requires perfect scores.",
    action: null,
  },
  {
    num: 5,
    label: "Compute PVQ",
    desc: "Calculate all four quotients (STQ, TFQ, VAQ, LMQ) and the composite PVQ score. Integrates labor market data (wages, employment, projections) from BLS.",
    action: "compute",
  },
];

export default function AnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.id as string;
  const [analyses, setAnalyses] = useState<AnalysisData[]>([]);
  const [active, setActive] = useState<AnalysisData | null>(null);
  const [running, setRunning] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingEarnings, setEditingEarnings] = useState(false);
  const [earningsInput, setEarningsInput] = useState("");
  const [savingEarnings, setSavingEarnings] = useState(false);
  const [editingAgeRule, setEditingAgeRule] = useState(false);
  const [ageRuleInput, setAgeRuleInput] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/cases/${caseId}/analysis`);
    const raw = await res.json();
    const data = Array.isArray(raw) ? raw : [];
    setAnalyses(data);
    if (data.length > 0 && !active) {
      setActive(data[0]);
    }
  }, [caseId, active]);

  useEffect(() => {
    load();
  }, [load]);

  async function createAnalysis(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    const form = new FormData(e.currentTarget);
    const data = {
      name: form.get("name") || null,
      ageRule: form.get("ageRule") || "standard",
      priorEarnings: form.get("priorEarnings")
        ? parseFloat(form.get("priorEarnings") as string)
        : null,
      targetArea: form.get("targetArea") || null,
      targetAreaName: form.get("targetAreaName") || null,
    };

    const res = await fetch(`/api/cases/${caseId}/analysis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      const newAnalysis = await res.json();
      toast.success("Analysis created");
      setActive(newAnalysis);
      load();
    }
    setCreating(false);
  }

  async function runStep(step: number) {
    if (!active) return;
    setRunning(true);

    try {
      let endpoint = "";
      switch (step) {
        case 2:
          endpoint = "generate-candidates";
          break;
        case 3:
          endpoint = "filter-traits";
          break;
        case 5:
          endpoint = "compute";
          break;
        default:
          setRunning(false);
          return;
      }

      const res = await fetch(
        `/api/cases/${caseId}/analysis/${active.id}/${endpoint}`,
        { method: "POST" }
      );
      const data = await res.json();

      if (res.ok) {
        toast.success(`Step ${step} completed`);
        const refreshed = await fetch(`/api/cases/${caseId}/analysis`);
        const all = await refreshed.json();
        setAnalyses(all);
        setActive(all.find((a: AnalysisData) => a.id === active.id) ?? null);
      } else {
        toast.error(data.error ?? "Step failed");
      }
    } catch {
      toast.error("Failed to run step");
    }

    setRunning(false);
  }

  async function saveEarnings() {
    if (!active) return;
    setSavingEarnings(true);
    try {
      const val = earningsInput ? parseFloat(earningsInput) : null;
      const res = await fetch(`/api/cases/${caseId}/analysis`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: active.id, priorEarnings: val }),
      });
      if (res.ok) {
        const updated = await res.json();
        setActive({ ...active, priorEarnings: updated.priorEarnings });
        setAnalyses((prev) =>
          prev.map((a) => (a.id === active.id ? { ...a, priorEarnings: updated.priorEarnings } : a))
        );
        toast.success("Prior earnings updated");
        setEditingEarnings(false);
      } else {
        toast.error("Failed to update earnings");
      }
    } catch {
      toast.error("Failed to update earnings");
    }
    setSavingEarnings(false);
  }

  async function saveAgeRule() {
    if (!active) return;
    try {
      const res = await fetch(`/api/cases/${caseId}/analysis`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: active.id, ageRule: ageRuleInput }),
      });
      if (res.ok) {
        const updated = await res.json();
        setActive({ ...active, ageRule: updated.ageRule });
        setAnalyses((prev) =>
          prev.map((a) => (a.id === active.id ? { ...a, ageRule: updated.ageRule } : a))
        );
        toast.success("Age rule updated");
        setEditingAgeRule(false);
      } else {
        toast.error("Failed to update age rule");
      }
    } catch {
      toast.error("Failed to update age rule");
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <CaseBreadcrumb caseId={caseId} currentPage="Analysis" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analysis</h1>
          <p className="text-muted-foreground">
            PVQ-TM 5-step transferable skills analysis workflow
          </p>
        </div>
      </div>

      {/* Create New Analysis */}
      {!active && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Analysis</CardTitle>
            <p className="text-sm text-muted-foreground">
              Configure the analysis parameters. The age rule determines how strictly
              vocational adjustment is evaluated. Prior earnings are used to score
              wage competitiveness of target occupations.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={createAnalysis} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Analysis Name</Label>
                  <Input id="name" name="name" placeholder="Optional name" />
                </div>
                <div className="space-y-2">
                  <Label>Age Rule</Label>
                  <Select name="ageRule" defaultValue="standard">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="closely_approaching">
                        Closely Approaching Advanced Age (50-54)
                      </SelectItem>
                      <SelectItem value="advanced_age">
                        Advanced Age (55+)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Advanced Age requires perfect vocational adjustment scores (100/100 on all four dimensions)
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priorEarnings">
                    Prior Earnings (annual)
                  </Label>
                  <Input
                    id="priorEarnings"
                    name="priorEarnings"
                    type="number"
                    placeholder="e.g. 45000"
                  />
                  <p className="text-xs text-muted-foreground">
                    Used to compare target occupation wages against the evaluee&apos;s prior income
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="targetArea">Target Metro Area Code</Label>
                  <Input
                    id="targetArea"
                    name="targetArea"
                    placeholder="e.g. 0000000 for national"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave blank or use 0000000 for national-level labor market data
                  </p>
                </div>
              </div>
              <Button type="submit" disabled={creating}>
                <Plus className="mr-2 h-4 w-4" />
                {creating ? "Creating..." : "Create Analysis"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Analysis Selector */}
      {analyses.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {analyses.map((a) => (
            <Button
              key={a.id}
              variant={active?.id === a.id ? "default" : "outline"}
              size="sm"
              onClick={() => setActive(a)}
            >
              {a.name ?? "Analysis"}{" "}
              <Badge variant="secondary" className="ml-2">
                {a.status}
              </Badge>
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActive(null)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Workflow Steps */}
      {active && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                {active.name ?? "Analysis"} — Step {active.step} of 5
              </CardTitle>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {/* Age Rule - inline editable */}
                <div className="flex items-center gap-1">
                  <span className="font-medium">Age Rule:</span>
                  {editingAgeRule ? (
                    <div className="flex items-center gap-1">
                      <Select value={ageRuleInput} onValueChange={(v) => setAgeRuleInput(v ?? "standard")}>
                        <SelectTrigger className="h-7 w-[220px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="closely_approaching">Closely Approaching (50-54)</SelectItem>
                          <SelectItem value="advanced_age">Advanced Age (55+)</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={saveAgeRule}>
                        <Check className="h-3 w-3 text-green-600" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingAgeRule(false)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <span
                      className="cursor-pointer hover:underline inline-flex items-center gap-1"
                      onClick={() => {
                        setAgeRuleInput(active.ageRule ?? "standard");
                        setEditingAgeRule(true);
                      }}
                    >
                      {active.ageRule === "advanced_age" ? "Advanced Age (55+)" : active.ageRule === "closely_approaching" ? "Closely Approaching (50-54)" : "Standard"}
                      <Pencil className="h-3 w-3 opacity-50" />
                    </span>
                  )}
                </div>

                <Separator orientation="vertical" className="h-4" />

                {/* Prior Earnings - inline editable */}
                <div className="flex items-center gap-1">
                  <span className="font-medium">Prior Earnings:</span>
                  {editingEarnings ? (
                    <div className="flex items-center gap-1">
                      <span className="text-sm">$</span>
                      <Input
                        className="h-7 w-28 text-xs"
                        type="number"
                        placeholder="e.g. 45000"
                        value={earningsInput}
                        onChange={(e) => setEarningsInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEarnings();
                          if (e.key === "Escape") setEditingEarnings(false);
                        }}
                        autoFocus
                      />
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={saveEarnings} disabled={savingEarnings}>
                        {savingEarnings ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 text-green-600" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingEarnings(false)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <span
                      className="cursor-pointer hover:underline inline-flex items-center gap-1"
                      onClick={() => {
                        setEarningsInput(active.priorEarnings?.toString() ?? "");
                        setEditingEarnings(true);
                      }}
                    >
                      {active.priorEarnings ? `$${active.priorEarnings.toLocaleString()}` : "Not set"}
                      <Pencil className="h-3 w-3 opacity-50" />
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={(active.step / 5) * 100} />

              {/* Step Cards */}
              <div className="space-y-3">
                {STEPS.map((s) => {
                  const isCurrent = s.num === active.step;
                  const isComplete = s.num < active.step;
                  const isFuture = s.num > active.step;

                  return (
                    <div
                      key={s.num}
                      className={`flex items-start gap-3 rounded-md border p-3 ${
                        isCurrent
                          ? "border-primary bg-primary/5"
                          : isComplete
                            ? "bg-muted/30"
                            : "opacity-50"
                      }`}
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm">
                        {isComplete ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : isCurrent && running ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <span className="font-medium">{s.num}</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{s.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {s.desc}
                        </p>
                      </div>
                      {isCurrent && s.action && (
                        <Button
                          size="sm"
                          onClick={() => runStep(s.num)}
                          disabled={running}
                        >
                          {running ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <Play className="mr-1 h-3 w-3" />
                          )}
                          Run
                        </Button>
                      )}
                      {isCurrent && !s.action && s.num === 1 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => runStep(2)}
                          disabled={running}
                        >
                          Continue
                          <ArrowRight className="ml-1 h-3 w-3" />
                        </Button>
                      )}
                      {isCurrent && !s.action && s.num === 4 && (
                        <Button
                          size="sm"
                          onClick={() => runStep(5)}
                          disabled={running}
                        >
                          {running ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <ArrowRight className="mr-1 h-3 w-3" />
                          )}
                          Compute PVQ
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>

              {active.status === "completed" && (
                <div className="flex flex-col gap-2 sm:flex-row pt-2">
                  <Button
                    onClick={() =>
                      router.push(`/cases/${caseId}/results`)
                    }
                  >
                    View Results
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      window.open(
                        `/api/cases/${caseId}/analysis/${active.id}/report`,
                        "_blank"
                      );
                    }}
                  >
                    Download PDF Report
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Target Occupations Table */}
          {active.targetOccupations && active.targetOccupations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>
                    Target Occupations ({active.targetOccupations.length})
                  </span>
                  <div className="flex gap-2 text-xs font-normal">
                    <Badge variant="default">
                      {active.targetOccupations.filter((t) => !t.excluded).length} viable
                    </Badge>
                    <Badge variant="destructive">
                      {active.targetOccupations.filter((t) => t.excluded).length} excluded
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                <Table className="table-fixed md:table-auto">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="hidden md:table-cell">O*NET Code</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead className="hidden md:table-cell">SVP</TableHead>
                      <TableHead className="hidden md:table-cell text-right">STQ</TableHead>
                      <TableHead className="hidden md:table-cell text-right">TFQ</TableHead>
                      <TableHead className="hidden md:table-cell text-right">VAQ</TableHead>
                      <TableHead className="hidden md:table-cell text-right">LMQ</TableHead>
                      <TableHead className="w-12 md:w-auto text-right">PVQ</TableHead>
                      <TableHead className="w-20 md:w-auto text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {active.targetOccupations
                      .sort((a, b) => {
                        if (a.excluded !== b.excluded) return a.excluded ? 1 : -1;
                        return (b.pvq ?? 0) - (a.pvq ?? 0);
                      })
                      .map((t) => (
                        <TableRow
                          key={t.id}
                          className={t.excluded ? "opacity-50" : ""}
                        >
                          <TableCell className="hidden md:table-cell font-mono text-xs">
                            {t.onetSocCode}
                          </TableCell>
                          <TableCell>
                            {t.title}
                            <span className="block md:hidden text-xs text-muted-foreground font-mono">{t.onetSocCode}</span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">{t.svp ?? "\u2014"}</TableCell>
                          <TableCell className="hidden md:table-cell text-right">
                            {t.stq?.toFixed(1) ?? "\u2014"}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-right">
                            {t.tfq?.toFixed(1) ?? "\u2014"}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-right">
                            {t.vaq?.toFixed(1) ?? "\u2014"}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-right">
                            {t.lmq?.toFixed(1) ?? "\u2014"}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {t.pvq?.toFixed(1) ?? "\u2014"}
                          </TableCell>
                          <TableCell className="text-center">
                            {t.excluded ? (
                              <Badge variant="destructive" className="text-xs">
                                {t.exclusionReason ?? "Excluded"}
                              </Badge>
                            ) : t.pvq !== null ? (
                              <Badge variant="default" className="text-xs">
                                {t.confidenceGrade ?? "\u2014"}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                Pending
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
