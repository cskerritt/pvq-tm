"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  MapPin,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  XCircle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { CaseBreadcrumb } from "@/components/case-breadcrumb";
import { WizardNav, WizardNavButtons } from "@/components/wizard-nav";

// ─── Types ──────────────────────────────────────────────────────

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

interface TraitComparisonDetail {
  trait: string;
  label: string;
  workerCapacity: number | null;
  occupationDemand: number | null;
  margin: number | null;
  passes: boolean;
  source: string;
}

interface TfqDetailsShape {
  tfq?: number;
  passes?: boolean;
  failedTraits?: TraitComparisonDetail[];
  traitComparisons?: TraitComparisonDetail[];
  reserveMargin?: number;
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
  tfqDetails: TfqDetailsShape | null;
}

interface Step1Validation {
  prwCount: number;
  transferableSkillCount: number;
  postProfileTraitsFilled: number;
  postProfileExists: boolean;
  loading: boolean;
}

// ─── Trait Labels ───────────────────────────────────────────────

const TRAIT_LABELS: Record<string, string> = {
  reasoning: "Reasoning (GED-R)",
  math: "Math (GED-M)",
  language: "Language (GED-L)",
  spatialPerception: "Spatial",
  formPerception: "Form",
  clericalPerception: "Clerical",
  motorCoordination: "Motor Coord.",
  fingerDexterity: "Finger Dex.",
  manualDexterity: "Manual Dex.",
  eyeHandFoot: "Eye-Hand-Foot",
  colorDiscrimination: "Color Disc.",
  strength: "Strength",
  climbBalance: "Climb/Balance",
  stoopKneel: "Stoop/Kneel",
  reachHandle: "Reach/Handle",
  talkHear: "Talk/Hear",
  see: "See",
  workLocation: "Work Location",
  extremeCold: "Extreme Cold",
  extremeHeat: "Extreme Heat",
  wetnessHumidity: "Wet/Humidity",
  noiseVibration: "Noise/Vibration",
  hazards: "Hazards",
  dustsFumes: "Dusts/Fumes",
};

const COGNITIVE_TRAITS = new Set([
  "reasoning", "math", "language", "spatialPerception",
  "formPerception", "clericalPerception",
]);

const TRAIT_FIELDS = [
  "reasoning", "math", "language", "spatialPerception", "formPerception",
  "clericalPerception", "motorCoordination", "fingerDexterity", "manualDexterity",
  "eyeHandFoot", "colorDiscrimination", "strength", "climbBalance", "stoopKneel",
  "reachHandle", "talkHear", "see", "workLocation", "extremeCold", "extremeHeat",
  "wetnessHumidity", "noiseVibration", "hazards", "dustsFumes",
];

// ─── Steps ──────────────────────────────────────────────────────

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

// ─── Main Component ─────────────────────────────────────────────

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
  const [caseData, setCaseData] = useState<{
    zipCode?: string | null;
    metroAreaCode?: string | null;
    metroAreaName?: string | null;
  } | null>(null);
  const [overrideLocation, setOverrideLocation] = useState(false);

  // Step 1 validation state
  const [step1, setStep1] = useState<Step1Validation>({
    prwCount: 0,
    transferableSkillCount: 0,
    postProfileTraitsFilled: 0,
    postProfileExists: false,
    loading: true,
  });

  // Intermediate review state
  const [showAllCandidates, setShowAllCandidates] = useState(false);
  const [showExcludedDetails, setShowExcludedDetails] = useState(false);
  const [expandedExcluded, setExpandedExcluded] = useState<string | null>(null);

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

  // Fetch case data for ZIP/metro auto-population
  useEffect(() => {
    async function fetchCase() {
      try {
        const res = await fetch(`/api/cases/${caseId}`);
        if (res.ok) {
          const data = await res.json();
          setCaseData({
            zipCode: data.zipCode,
            metroAreaCode: data.metroAreaCode,
            metroAreaName: data.metroAreaName,
          });
        }
      } catch {
        // Non-critical — form still works without case data
      }
    }
    fetchCase();
  }, [caseId]);

  // Step 1 validation: fetch PRW, skills, and profile data
  useEffect(() => {
    if (!active || active.step !== 1) return;

    async function fetchValidation() {
      setStep1((prev) => ({ ...prev, loading: true }));
      try {
        const [prwRes, skillsRes, profilesRes] = await Promise.all([
          fetch(`/api/cases/${caseId}/prw`),
          fetch(`/api/cases/${caseId}/skills`),
          fetch(`/api/cases/${caseId}/profiles`),
        ]);

        const prwData = prwRes.ok ? await prwRes.json() : [];
        const skillsData = skillsRes.ok ? await skillsRes.json() : [];
        const profilesData = profilesRes.ok ? await profilesRes.json() : [];

        const prwCount = Array.isArray(prwData) ? prwData.length : 0;

        // Count transferable skills (isTransferable && svpLevel >= 4)
        const transferableSkillCount = Array.isArray(skillsData)
          ? skillsData.filter(
              (s: { isTransferable?: boolean; svpLevel?: number | null }) =>
                s.isTransferable && s.svpLevel != null && s.svpLevel >= 4
            ).length
          : 0;

        // Check POST profile completeness
        const postProfile = Array.isArray(profilesData)
          ? profilesData.find(
              (p: { profileType: string }) => p.profileType === "POST"
            )
          : null;

        let postProfileTraitsFilled = 0;
        if (postProfile) {
          for (const field of TRAIT_FIELDS) {
            if (
              postProfile[field] !== null &&
              postProfile[field] !== undefined
            ) {
              postProfileTraitsFilled++;
            }
          }
        }

        setStep1({
          prwCount,
          transferableSkillCount,
          postProfileTraitsFilled,
          postProfileExists: !!postProfile,
          loading: false,
        });
      } catch {
        setStep1((prev) => ({ ...prev, loading: false }));
      }
    }

    fetchValidation();
  }, [caseId, active]);

  const step1AllPassed =
    step1.prwCount >= 1 &&
    step1.transferableSkillCount >= 1 &&
    step1.postProfileExists &&
    step1.postProfileTraitsFilled === 24;

  async function createAnalysis(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    const form = new FormData(e.currentTarget);
    // Use override fields if user chose to override, otherwise use case data
    const targetArea = overrideLocation
      ? (form.get("targetArea") as string) || null
      : caseData?.metroAreaCode || null;
    const targetAreaName = overrideLocation
      ? (form.get("targetAreaName") as string) || null
      : caseData?.metroAreaName || null;

    const data = {
      name: form.get("name") || null,
      ageRule: form.get("ageRule") || "standard",
      priorEarnings: form.get("priorEarnings")
        ? parseFloat(form.get("priorEarnings") as string)
        : null,
      targetArea,
      targetAreaName,
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

  // Compute intermediate review data
  const totalOccs = active?.targetOccupations?.length ?? 0;
  const viableOccs = active?.targetOccupations?.filter((t) => !t.excluded) ?? [];
  const excludedOccs = active?.targetOccupations?.filter((t) => t.excluded) ?? [];

  return (
    <div>
      <WizardNav caseId={caseId} currentStep={5} />
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
                  <Label>Target Metro Area</Label>
                  {caseData?.metroAreaCode && !overrideLocation ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>
                          Location: ZIP {caseData.zipCode ?? "\u2014"} \u2014 {caseData.metroAreaName ?? caseData.metroAreaCode} metro area
                        </span>
                      </div>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:underline cursor-pointer"
                        onClick={() => setOverrideLocation(true)}
                      >
                        Use a different area
                      </button>
                    </div>
                  ) : !caseData?.metroAreaCode && !overrideLocation ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 rounded-md border border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950/30 px-3 py-2 text-sm text-yellow-800 dark:text-yellow-200">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>No ZIP/metro area set on case. National-level data will be used, or specify an area below.</span>
                      </div>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:underline cursor-pointer"
                        onClick={() => setOverrideLocation(true)}
                      >
                        Specify a metro area manually
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        id="targetArea"
                        name="targetArea"
                        placeholder="e.g. 0000000 for national"
                        defaultValue={caseData?.metroAreaCode ?? ""}
                      />
                      <Input
                        name="targetAreaName"
                        placeholder="Area name (optional)"
                        defaultValue={caseData?.metroAreaName ?? ""}
                      />
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:underline cursor-pointer"
                        onClick={() => setOverrideLocation(false)}
                      >
                        {caseData?.metroAreaCode ? "Use case location instead" : "Cancel"}
                      </button>
                    </div>
                  )}
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
      {analyses.length > 0 && (
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
                {active.name ?? "Analysis"} \u2014 Step {active.step} of 5
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
                      {/* Step 2 & 3: Run button */}
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
                      {/* Step 1: Continue with validation gate */}
                      {isCurrent && !s.action && s.num === 1 && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => runStep(2)}
                                  disabled={running || step1.loading || !step1AllPassed}
                                >
                                  {step1.loading ? (
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                  ) : null}
                                  Continue
                                  <ArrowRight className="ml-1 h-3 w-3" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            {!step1AllPassed && !step1.loading && (
                              <TooltipContent side="bottom" className="max-w-xs">
                                <p className="text-sm font-medium mb-1">Cannot proceed yet:</p>
                                <ul className="text-xs space-y-0.5">
                                  {step1.prwCount < 1 && (
                                    <li>Add at least one past relevant work entry</li>
                                  )}
                                  {step1.transferableSkillCount < 1 && (
                                    <li>Mark at least one acquired skill as transferable (SVP 4+)</li>
                                  )}
                                  {(!step1.postProfileExists || step1.postProfileTraitsFilled < 24) && (
                                    <li>Complete all 24 traits on the POST worker profile ({step1.postProfileTraitsFilled}/24 filled)</li>
                                  )}
                                </ul>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
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

              {/* ═══════════════════════════════════════════════════════════
                  Step 1 Validation Checklist
                  ═══════════════════════════════════════════════════════════ */}
              {active.step === 1 && (
                <Card className="border-blue-200 bg-blue-50/30 dark:border-blue-800 dark:bg-blue-950/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Pre-Analysis Checklist</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {step1.loading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Checking requirements...
                      </div>
                    ) : (
                      <>
                        {/* PRW check */}
                        <Link href={`/cases/${caseId}/prw`} className="flex items-center gap-2 text-sm hover:underline group">
                          {step1.prwCount >= 1 ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                          )}
                          <span className={step1.prwCount >= 1 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                            Past Relevant Work: {step1.prwCount} {step1.prwCount === 1 ? "entry" : "entries"}
                          </span>
                          <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                        {step1.prwCount < 1 && (
                          <p className="text-xs text-muted-foreground ml-6">
                            Add at least one past relevant work entry to proceed.
                          </p>
                        )}

                        {/* Transferable skills check */}
                        <Link href={`/cases/${caseId}/skills`} className="flex items-center gap-2 text-sm hover:underline group">
                          {step1.transferableSkillCount >= 1 ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                          )}
                          <span className={step1.transferableSkillCount >= 1 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                            Transferable Skills: {step1.transferableSkillCount} {step1.transferableSkillCount === 1 ? "skill" : "skills"}
                          </span>
                          <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                        {step1.transferableSkillCount < 1 && (
                          <p className="text-xs text-muted-foreground ml-6">
                            Mark at least one acquired skill as transferable with SVP level 4 or higher.
                          </p>
                        )}

                        {/* POST profile check */}
                        <Link href={`/cases/${caseId}/profiles`} className="flex items-center gap-2 text-sm hover:underline group">
                          {step1.postProfileExists && step1.postProfileTraitsFilled === 24 ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                          )}
                          <span className={step1.postProfileExists && step1.postProfileTraitsFilled === 24 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                            Post-Injury Profile: {step1.postProfileTraitsFilled}/24 traits filled
                          </span>
                          <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                        {(!step1.postProfileExists || step1.postProfileTraitsFilled < 24) && (
                          <p className="text-xs text-muted-foreground ml-6">
                            {!step1.postProfileExists
                              ? "Create a POST worker profile and fill all 24 traits."
                              : `Complete the remaining ${24 - step1.postProfileTraitsFilled} trait${24 - step1.postProfileTraitsFilled === 1 ? "" : "s"} on the POST profile.`}
                          </p>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  Intermediate Review: After Step 2 (before Step 3)
                  Shows candidate generation summary
                  ═══════════════════════════════════════════════════════════ */}
              {active.step === 3 && totalOccs > 0 && (
                <Card className="border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-950/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Step 2 Complete: {totalOccs} candidate occupations generated
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      {(active.targetOccupations ?? [])
                        .slice(0, showAllCandidates ? undefined : 10)
                        .map((t) => (
                          <div key={t.id} className="flex items-center gap-2 text-xs">
                            <span className="font-mono text-muted-foreground w-24 shrink-0">{t.onetSocCode}</span>
                            <span>{t.title}</span>
                          </div>
                        ))}
                    </div>
                    {totalOccs > 10 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => setShowAllCandidates(!showAllCandidates)}
                      >
                        {showAllCandidates ? (
                          <>Show less <ChevronUp className="ml-1 h-3 w-3" /></>
                        ) : (
                          <>View all {totalOccs} candidates <ChevronDown className="ml-1 h-3 w-3" /></>
                        )}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  Intermediate Review: After Step 3 (before Step 4)
                  Trait Filter Results with Failure Drill-Down
                  ═══════════════════════════════════════════════════════════ */}
              {active.step === 4 && totalOccs > 0 && (
                <Card className="border-amber-200 bg-amber-50/30 dark:border-amber-800 dark:bg-amber-950/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Step 3 Complete: Trait Filter Results
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border p-3 text-center bg-green-50 dark:bg-green-950/30">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Passed</p>
                        <p className="text-2xl font-bold text-green-600">{viableOccs.length}</p>
                        <p className="text-[10px] text-muted-foreground">occupations viable</p>
                      </div>
                      <div className="rounded-lg border p-3 text-center bg-red-50 dark:bg-red-950/30">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Excluded</p>
                        <p className="text-2xl font-bold text-red-600">{excludedOccs.length}</p>
                        <p className="text-[10px] text-muted-foreground">trait failures</p>
                      </div>
                    </div>

                    {/* Excluded occupations drill-down */}
                    {excludedOccs.length > 0 && (
                      <div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs w-full justify-between"
                          onClick={() => setShowExcludedDetails(!showExcludedDetails)}
                        >
                          <span className="text-red-600 font-medium">
                            View {excludedOccs.length} excluded {excludedOccs.length === 1 ? "occupation" : "occupations"} with trait failure details
                          </span>
                          {showExcludedDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </Button>
                        {showExcludedDetails && (
                          <div className="space-y-1 mt-2">
                            {excludedOccs.map((t) => {
                              const isExpanded = expandedExcluded === t.id;
                              const tfqData = t.tfqDetails as TfqDetailsShape | null;
                              const failedTraits = tfqData?.failedTraits ?? [];

                              return (
                                <div key={t.id} className="rounded border bg-white dark:bg-gray-950">
                                  <button
                                    className="w-full flex items-center gap-2 p-2 text-left text-xs hover:bg-muted/50"
                                    onClick={() => setExpandedExcluded(isExpanded ? null : t.id)}
                                  >
                                    {isExpanded ? <ChevronUp className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />}
                                    <span className="font-mono text-muted-foreground w-24 shrink-0">{t.onetSocCode}</span>
                                    <span className="flex-1 font-medium">{t.title}</span>
                                    <Badge variant="destructive" className="text-[10px]">
                                      {failedTraits.length} failed {failedTraits.length === 1 ? "trait" : "traits"}
                                    </Badge>
                                  </button>
                                  {isExpanded && failedTraits.length > 0 && (
                                    <div className="px-4 pb-3 pt-1 border-t">
                                      <p className="text-xs font-medium text-red-600 mb-2">Failed Trait Comparisons</p>
                                      <div className="space-y-1.5">
                                        {failedTraits.map((ft, i) => {
                                          const deficit = ft.margin != null ? ft.margin : (ft.workerCapacity != null && ft.occupationDemand != null ? ft.workerCapacity - ft.occupationDemand : null);
                                          const isLearnable = COGNITIVE_TRAITS.has(ft.trait);
                                          return (
                                            <div key={i} className="flex items-center gap-2 text-xs">
                                              <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                                              <span className="font-medium w-28 shrink-0">{ft.label || TRAIT_LABELS[ft.trait] || ft.trait}</span>
                                              <span className="text-muted-foreground">Worker:</span>
                                              <span className="font-mono w-6 text-right">{ft.workerCapacity ?? "\u2014"}</span>
                                              <span className="text-muted-foreground">Demand:</span>
                                              <span className="font-mono w-6 text-right">{ft.occupationDemand ?? "\u2014"}</span>
                                              {deficit != null && (
                                                <span className="font-mono text-red-600 font-semibold">
                                                  {deficit >= 0 ? `+${deficit}` : deficit}
                                                </span>
                                              )}
                                              <Badge
                                                variant="outline"
                                                className={`text-[10px] px-1 ${isLearnable ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-orange-50 text-orange-700 border-orange-200"}`}
                                              >
                                                {isLearnable ? "Cognitive" : "Physical/Env"}
                                              </Badge>
                                            </div>
                                          );
                                        })}
                                      </div>
                                      {/* Show exclusion reason text */}
                                      {t.exclusionReason && (
                                        <p className="text-xs text-red-600 mt-2 italic">{t.exclusionReason}</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

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

      <WizardNavButtons caseId={caseId} currentStep={5} />
      </div>
    </div>
  );
}
