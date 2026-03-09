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
  Info,
} from "lucide-react";
import { toast } from "sonner";

interface AnalysisData {
  id: string;
  name: string | null;
  status: string;
  step: number;
  ageRule: string | null;
  priorEarnings: number | null;
  targetArea: string | null;
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

  const load = useCallback(async () => {
    const res = await fetch(`/api/cases/${caseId}/analysis`);
    const data = await res.json();
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

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
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
              {active.ageRule && (
                <p className="text-sm text-muted-foreground">
                  Age Rule: {active.ageRule === "advanced_age" ? "Advanced Age (55+)" : active.ageRule === "closely_approaching" ? "Closely Approaching (50-54)" : "Standard"}
                  {active.priorEarnings ? ` | Prior Earnings: $${active.priorEarnings.toLocaleString()}` : ""}
                </p>
              )}
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
                <div className="flex gap-2 pt-2">
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>O*NET Code</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>SVP</TableHead>
                      <TableHead className="text-right">STQ</TableHead>
                      <TableHead className="text-right">TFQ</TableHead>
                      <TableHead className="text-right">VAQ</TableHead>
                      <TableHead className="text-right">LMQ</TableHead>
                      <TableHead className="text-right">PVQ</TableHead>
                      <TableHead className="text-center">Status</TableHead>
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
                          <TableCell className="font-mono text-xs">
                            {t.onetSocCode}
                          </TableCell>
                          <TableCell>{t.title}</TableCell>
                          <TableCell>{t.svp ?? "\u2014"}</TableCell>
                          <TableCell className="text-right">
                            {t.stq?.toFixed(1) ?? "\u2014"}
                          </TableCell>
                          <TableCell className="text-right">
                            {t.tfq?.toFixed(1) ?? "\u2014"}
                          </TableCell>
                          <TableCell className="text-right">
                            {t.vaq?.toFixed(1) ?? "\u2014"}
                          </TableCell>
                          <TableCell className="text-right">
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
