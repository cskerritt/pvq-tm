"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
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
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Minus,
  TrendingDown,
  TrendingUp,
  BarChart3,
  DollarSign,
  MapPin,
  Target,
  Layers,
  Activity,
  Briefcase,
} from "lucide-react";
import { toast } from "sonner";
import { CaseBreadcrumb } from "@/components/case-breadcrumb";
import { WizardNav, WizardNavButtons } from "@/components/wizard-nav";
import {
  ScoreTooltip,
  buildVQBreakdown,
  buildECBreakdown,
  buildSTQBreakdown,
} from "@/components/score-tooltip";

interface Profile {
  profileType: string;
  reasoning: number | null;
  math: number | null;
  language: number | null;
  spatialPerception: number | null;
  formPerception: number | null;
  clericalPerception: number | null;
  motorCoordination: number | null;
  fingerDexterity: number | null;
  manualDexterity: number | null;
  eyeHandFoot: number | null;
  colorDiscrimination: number | null;
  strength: number | null;
  climbBalance: number | null;
  stoopKneel: number | null;
  reachHandle: number | null;
  talkHear: number | null;
  see: number | null;
  workLocation: number | null;
  extremeCold: number | null;
  extremeHeat: number | null;
  wetnessHumidity: number | null;
  noiseVibration: number | null;
  hazards: number | null;
  dustsFumes: number | null;
}

interface TargetOcc {
  id: string;
  onetSocCode: string;
  title: string;
  svp: number | null;
  pvq: number | null;
  tfq: number | null;
  stq: number | null;
  excluded: boolean;
  exclusionReason: string | null;
  preTfq: number | null;
  preTfqPasses: boolean | null;
  joltsIndustryCode: string | null;
  joltsIndustryName: string | null;
  joltsCurrentOpenings: number | null;
  joltsPreInjuryOpenings: number | null;
  // VQS fields
  vqScore: number | null;
  vqBand: number | null;
  tspScore: number | null;
  tspTier: number | null;
  tspLabel: string | null;
  ecMedian: number | null;
  ecMean: number | null;
  ec10: number | null;
  ec25: number | null;
  ec75: number | null;
  ec90: number | null;
  ecConfLow: number | null;
  ecConfHigh: number | null;
  ecSee: number | null;
  ecGeoAdjusted: boolean | null;
  preVqScore: number | null;
  preEcMedian: number | null;
  // Detail JSON fields for score breakdowns
  stqDetails: Record<string, unknown> | null;
  tfqDetails: Record<string, unknown> | null;
  vaqDetails: Record<string, unknown> | null;
  lmqDetails: Record<string, unknown> | null;
  vqDetails: Record<string, unknown> | null;
  ecDetails: Record<string, unknown> | null;
  confidenceGrade: string | null;
  // Near-miss fields
  nearMissSeverity: string | null;
  nearMissDetails: Record<string, unknown> | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
interface AnalysisData {
  id: string;
  name: string | null;
  preInjuryViableCount: number | null;
  preInjuryTotalEmployment: number | null;
  preInjuryJoltsOpenings: number | null;
  postInjuryViableCount: number | null;
  postInjuryTotalEmployment: number | null;
  postInjuryJoltsOpenings: number | null;
  // Area employment
  preInjuryAreaEmployment: number | null;
  postInjuryAreaEmployment: number | null;
  stateJoltsCurrent: number | null;
  stateJoltsPreInjury: number | null;
  stateName: string | null;
  // VQS aggregates
  vqsPostEcMedian: number | null;
  vqsPreEcMedian: number | null;
  vqsEcLoss: number | null;
  vqsEcLossPct: number | null;
  // JSON analysis fields
  nearMissAnalysis: any;
  viableSetAnalysis: any;
  regionalLaborMarket: any;
  hiredJobsComparison: any;
  laborMarketAccess: any;
  case: { clientName: string; id: string; dateOfInjury: string | null };
  targetOccupations: TargetOcc[];
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** 24 traits in display order */
const TRAIT_DEFS: { key: keyof Profile; label: string; category: string }[] = [
  // Aptitudes
  { key: "reasoning", label: "Reasoning (GED-R)", category: "Aptitude" },
  { key: "math", label: "Math (GED-M)", category: "Aptitude" },
  { key: "language", label: "Language (GED-L)", category: "Aptitude" },
  { key: "spatialPerception", label: "Spatial Perception", category: "Aptitude" },
  { key: "formPerception", label: "Form Perception", category: "Aptitude" },
  { key: "clericalPerception", label: "Clerical Perception", category: "Aptitude" },
  { key: "motorCoordination", label: "Motor Coordination", category: "Aptitude" },
  { key: "fingerDexterity", label: "Finger Dexterity", category: "Aptitude" },
  { key: "manualDexterity", label: "Manual Dexterity", category: "Aptitude" },
  { key: "eyeHandFoot", label: "Eye-Hand-Foot", category: "Aptitude" },
  { key: "colorDiscrimination", label: "Color Discrimination", category: "Aptitude" },
  // Physical
  { key: "strength", label: "Strength", category: "Physical" },
  { key: "climbBalance", label: "Climbing/Balancing", category: "Physical" },
  { key: "stoopKneel", label: "Stooping/Kneeling", category: "Physical" },
  { key: "reachHandle", label: "Reaching/Handling", category: "Physical" },
  { key: "talkHear", label: "Talking/Hearing", category: "Physical" },
  { key: "see", label: "Seeing", category: "Physical" },
  // Environmental
  { key: "workLocation", label: "Work Location", category: "Environmental" },
  { key: "extremeCold", label: "Extreme Cold", category: "Environmental" },
  { key: "extremeHeat", label: "Extreme Heat", category: "Environmental" },
  { key: "wetnessHumidity", label: "Wetness/Humidity", category: "Environmental" },
  { key: "noiseVibration", label: "Noise/Vibration", category: "Environmental" },
  { key: "hazards", label: "Hazards", category: "Environmental" },
  { key: "dustsFumes", label: "Dusts/Fumes", category: "Environmental" },
];

function traitLabel(val: number | null): string {
  if (val === null) return "\u2014";
  return String(val);
}

function formatHourly(val: number | null): string {
  if (val === null) return "\u2014";
  return `$${val.toFixed(2)}`;
}

function formatAnnual(hourly: number | null): string {
  if (hourly === null) return "\u2014";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(hourly * 2080);
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
    case 1: return "High";
    case 2: return "Above Average";
    case 3: return "Below Average";
    case 4: return "Low";
    default: return "";
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

/** Strength level labels for narrative */
function strengthLabel(val: number | null): string {
  switch (val) {
    case 0: return "Unlimited";
    case 1: return "Heavy";
    case 2: return "Medium";
    case 3: return "Light";
    case 4: return "Sedentary";
    default: return String(val ?? "\u2014");
  }
}

/** Safe JSON parse helper */
function safeJson(val: unknown): Record<string, unknown> | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "object") return val as Record<string, unknown>;
  if (typeof val === "string") {
    try { return JSON.parse(val); } catch { return null; }
  }
  return null;
}

export default function ComparisonPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const caseId = params.id as string;
  const analysisId = searchParams.get("analysisId");

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [profilesRes, analysisRes] = await Promise.all([
        fetch(`/api/cases/${caseId}/profiles`),
        fetch(`/api/cases/${caseId}/analysis`),
      ]);
      const profilesData = await profilesRes.json();
      const analysisData = await analysisRes.json();

      setProfiles(Array.isArray(profilesData) ? profilesData : []);

      const allAnalyses = Array.isArray(analysisData) ? analysisData : [];
      const completed = allAnalyses.filter(
        (a: AnalysisData) => a.targetOccupations?.length > 0
      );

      if (analysisId) {
        const found = completed.find((a: AnalysisData) => a.id === analysisId);
        setAnalysis(found ?? completed[0] ?? null);
      } else {
        setAnalysis(completed[0] ?? null);
      }
    } catch {
      toast.error("Failed to load data");
    }
    setLoading(false);
  }, [caseId, analysisId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className="p-6">Loading...</div>;

  const preProfile = profiles.find((p) => p.profileType === "PRE") ?? null;
  const postProfile = profiles.find((p) => p.profileType === "POST") ?? null;

  const targets = analysis?.targetOccupations ?? [];
  const dateOfInjury = analysis?.case?.dateOfInjury;

  // Categorize occupations
  const lostAccess = targets.filter(
    (t) => t.preTfqPasses === true && t.excluded
  );
  const stillAccessible = targets.filter(
    (t) => t.preTfqPasses === true && !t.excluded
  );
  const alreadyExcluded = targets.filter(
    (t) => t.preTfqPasses !== true
  );

  // JOLTS summary by industry
  const industryMap = new Map<
    string,
    {
      name: string;
      preAccess: number;
      postAccess: number;
      currentOpenings: number;
      preOpenings: number;
    }
  >();
  for (const t of targets) {
    const code = t.joltsIndustryCode ?? "unknown";
    const name = t.joltsIndustryName ?? "Unknown";
    if (!industryMap.has(code)) {
      industryMap.set(code, {
        name,
        preAccess: 0,
        postAccess: 0,
        currentOpenings: 0,
        preOpenings: 0,
      });
    }
    const entry = industryMap.get(code)!;
    if (t.preTfqPasses) entry.preAccess++;
    if (!t.excluded) entry.postAccess++;
    entry.currentOpenings += t.joltsCurrentOpenings ?? 0;
    entry.preOpenings += t.joltsPreInjuryOpenings ?? 0;
  }
  const industrySummary = [...industryMap.entries()]
    .filter(([code]) => code !== "unknown")
    .sort((a, b) => (b[1].preAccess - b[1].postAccess) - (a[1].preAccess - a[1].postAccess));

  // --- Trait Delta Analysis ---
  const traitDeltas = preProfile && postProfile
    ? TRAIT_DEFS.map(({ key, label }) => {
        const pre = preProfile[key] as number | null;
        const post = postProfile[key] as number | null;
        const delta = pre !== null && post !== null ? post - pre : null;
        // Count occupations lost due to this trait (rough: check exclusion reasons)
        const occsLost = delta !== null && delta > 0
          ? lostAccess.filter((t) => {
              const reason = t.exclusionReason ?? "";
              return reason.toLowerCase().includes(key.toLowerCase()) ||
                     reason.toLowerCase().includes(label.toLowerCase().split(" ")[0].toLowerCase());
            }).length
          : 0;
        return { key, label, pre, post, delta, occsLost };
      }).filter((d) => d.delta !== null)
    : [];

  const criticalChanges = traitDeltas.filter((d) => d.delta !== null && d.delta >= 2);
  const moderateChanges = traitDeltas.filter((d) => d.delta !== null && d.delta === 1);
  const unchangedTraits = traitDeltas.filter((d) => d.delta !== null && d.delta <= 0);

  // --- Near-Miss Data ---
  const nearMissData = safeJson(analysis?.nearMissAnalysis);
  const nearMissOccs = targets.filter((t) => t.nearMissSeverity === "marginal" || t.nearMissSeverity === "moderate");

  // --- Viable Set Data ---
  const viableSetData = safeJson(analysis?.viableSetAnalysis);

  // --- Regional Labor Market Data ---
  const regionalData = safeJson(analysis?.regionalLaborMarket);

  return (
    <div>
      <WizardNav caseId={caseId} currentStep={7} />
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <CaseBreadcrumb caseId={caseId} currentPage="Pre/Post Comparison" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pre-Injury vs. Post-Injury Comparison</h1>
          <p className="text-muted-foreground">
            {analysis?.case?.clientName} — {analysis?.name ?? "Analysis"}
            {dateOfInjury && (
              <span className="ml-2 text-sm">
                (DOI: {new Date(dateOfInjury).toLocaleDateString()})
              </span>
            )}
          </p>
        </div>
        <Link href={`/cases/${caseId}/results`}>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Results
          </Button>
        </Link>
      </div>

      {/* Loss of Access Summary */}
      {analysis?.preInjuryViableCount !== null && analysis?.preInjuryViableCount !== undefined && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-blue-50 dark:bg-blue-950/30">
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-xs text-muted-foreground">Pre-Injury Access</p>
              <p className="text-3xl font-bold text-blue-600">{analysis.preInjuryViableCount}</p>
              <p className="text-xs text-muted-foreground">occupations</p>
            </CardContent>
          </Card>
          <Card className="bg-amber-50 dark:bg-amber-950/30">
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-xs text-muted-foreground">Post-Injury Access</p>
              <p className="text-3xl font-bold text-amber-600">{analysis.postInjuryViableCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">occupations</p>
            </CardContent>
          </Card>
          <Card className="bg-red-50 dark:bg-red-950/30">
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-xs text-muted-foreground">Net Loss</p>
              <p className="text-3xl font-bold text-red-600">
                {analysis.preInjuryViableCount - (analysis.postInjuryViableCount ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">occupations lost</p>
            </CardContent>
          </Card>
          <Card className="bg-red-50 dark:bg-red-950/30">
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-xs text-muted-foreground">% Loss of Access</p>
              <p className="text-3xl font-bold text-red-600">
                {analysis.preInjuryViableCount > 0
                  ? (
                      ((analysis.preInjuryViableCount - (analysis.postInjuryViableCount ?? 0)) /
                        analysis.preInjuryViableCount) *
                      100
                    ).toFixed(1)
                  : "0"}
                %
              </p>
              <p className="text-xs text-muted-foreground">of labor market</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Section 6: Area Employment Comparison Cards */}
      {(analysis?.preInjuryAreaEmployment != null || analysis?.postInjuryAreaEmployment != null ||
        analysis?.stateJoltsCurrent != null || analysis?.stateJoltsPreInjury != null) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {analysis?.preInjuryAreaEmployment != null && (
            <Card className="bg-blue-50 dark:bg-blue-950/30">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-xs text-muted-foreground">Area Employment (Pre)</p>
                <p className="text-2xl font-bold text-blue-600">
                  {analysis.preInjuryAreaEmployment.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-muted-foreground">jobs in metro area</p>
              </CardContent>
            </Card>
          )}
          {analysis?.postInjuryAreaEmployment != null && (
            <Card className="bg-amber-50 dark:bg-amber-950/30">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-xs text-muted-foreground">Area Employment (Post)</p>
                <p className="text-2xl font-bold text-amber-600">
                  {analysis.postInjuryAreaEmployment.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-muted-foreground">jobs in metro area</p>
              </CardContent>
            </Card>
          )}
          {analysis?.stateJoltsPreInjury != null && (
            <Card className="bg-slate-50 dark:bg-slate-950/30">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-xs text-muted-foreground">State JOLTS at Injury</p>
                <p className="text-2xl font-bold text-slate-600">
                  {Math.round(analysis.stateJoltsPreInjury * 1000).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">{analysis.stateName ?? "State"} openings</p>
              </CardContent>
            </Card>
          )}
          {analysis?.stateJoltsCurrent != null && (
            <Card className="bg-slate-50 dark:bg-slate-950/30">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-xs text-muted-foreground">State JOLTS Current</p>
                <p className="text-2xl font-bold text-slate-600">
                  {Math.round(analysis.stateJoltsCurrent * 1000).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">{analysis.stateName ?? "State"} openings</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Profile Comparison */}
      {preProfile && postProfile ? (
        <Card>
          <CardHeader>
            <CardTitle>24-Trait Profile Comparison</CardTitle>
            <p className="text-sm text-muted-foreground">
              Pre-injury capacity vs. post-injury capacity. Lower values indicate greater restriction (0-4 scale: 0=unlimited, 4=most restricted).
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Trait</TableHead>
                    <TableHead className="text-center">Pre-Injury</TableHead>
                    <TableHead className="text-center">Post-Injury</TableHead>
                    <TableHead className="text-center">Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {TRAIT_DEFS.map(({ key, label, category }) => {
                    const pre = preProfile[key] as number | null;
                    const post = postProfile[key] as number | null;
                    const delta =
                      pre !== null && post !== null ? post - pre : null;
                    // Higher value = more restricted, so a positive delta = worse
                    const hasChange = delta !== null && delta !== 0;
                    const isWorse = delta !== null && delta > 0;

                    return (
                      <TableRow
                        key={key}
                        className={hasChange && isWorse ? "bg-red-50 dark:bg-red-950/20" : ""}
                      >
                        <TableCell className="text-xs text-muted-foreground">
                          {category}
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {label}
                        </TableCell>
                        <TableCell className="text-center font-mono">
                          {traitLabel(pre)}
                        </TableCell>
                        <TableCell className="text-center font-mono">
                          {traitLabel(post)}
                        </TableCell>
                        <TableCell className="text-center">
                          {delta === null ? (
                            <span className="text-muted-foreground">{"\u2014"}</span>
                          ) : delta === 0 ? (
                            <Minus className="h-4 w-4 mx-auto text-muted-foreground" />
                          ) : (
                            <span
                              className={`font-bold ${
                                isWorse ? "text-red-600" : "text-green-600"
                              }`}
                            >
                              {delta > 0 ? `+${delta}` : delta}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>
              {!preProfile
                ? "No Pre-Injury profile found. Create a PRE profile on the Profiles page to enable comparison."
                : "No Post-Injury profile found. Create a POST profile on the Profiles page to enable comparison."}
            </p>
            <Link href={`/cases/${caseId}/profiles`}>
              <Button variant="outline" className="mt-3">
                Go to Profiles
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Section 3: Trait Delta Narrative */}
      {preProfile && postProfile && (criticalChanges.length > 0 || moderateChanges.length > 0) && (
        <Card className="border-orange-200 bg-orange-50/20 dark:border-orange-800 dark:bg-orange-950/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-orange-600" />
              Trait Change Impact Analysis
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Summary of trait changes between pre-injury and post-injury profiles, grouped by severity of impact.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Critical Changes */}
            {criticalChanges.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  Critical Changes (Reduced by 2+)
                </h3>
                <div className="space-y-2">
                  {criticalChanges.map((d) => (
                    <div key={d.key} className="rounded-lg border border-red-200 bg-red-50/50 dark:bg-red-950/20 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{d.label}</span>
                        <Badge className="bg-red-100 text-red-800 text-xs" variant="outline">
                          +{d.delta} (more restricted)
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {d.key === "strength" ? (
                          <>
                            Strength reduced from {strengthLabel(d.pre)} ({d.pre}) to {strengthLabel(d.post)} ({d.post}),
                            {d.occsLost > 0
                              ? ` contributing to loss of access to ${d.occsLost} occupation${d.occsLost !== 1 ? "s" : ""} requiring higher physical demands.`
                              : " potentially eliminating access to occupations requiring medium or heavier physical demands."}
                          </>
                        ) : (
                          <>
                            {d.label} changed from {d.pre} to {d.post} (increased restriction of {d.delta} level{(d.delta ?? 0) > 1 ? "s" : ""}).
                            {d.occsLost > 0
                              ? ` This change contributed to the loss of ${d.occsLost} occupation${d.occsLost !== 1 ? "s" : ""}.`
                              : " This significant change may limit access to occupations with higher demands in this trait."}
                          </>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Moderate Changes */}
            {moderateChanges.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-amber-700 mb-2">
                  Moderate Changes (Reduced by 1)
                </h3>
                <div className="space-y-2">
                  {moderateChanges.map((d) => (
                    <div key={d.key} className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{d.label}</span>
                        <Badge className="bg-amber-100 text-amber-800 text-xs" variant="outline">
                          +1 (more restricted)
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {d.label} changed from {d.pre} to {d.post}.
                        {d.occsLost > 0
                          ? ` This change contributed to the loss of ${d.occsLost} occupation${d.occsLost !== 1 ? "s" : ""}.`
                          : " This change may marginally reduce access to occupations at the threshold."}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unchanged Summary */}
            {unchangedTraits.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-green-700 mb-1">
                  Unchanged / Improved ({unchangedTraits.length} trait{unchangedTraits.length !== 1 ? "s" : ""})
                </h3>
                <p className="text-sm text-muted-foreground">
                  {unchangedTraits.map((d) => d.label).join(", ")} remained at the same level or improved post-injury.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Occupation Access Matrix */}
      {targets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Occupation Access Matrix</CardTitle>
            <p className="text-sm text-muted-foreground">
              All target occupations showing pre-injury and post-injury TFQ pass/fail status.
              <span className="ml-1 text-green-600 font-medium">Green</span> = still accessible,{" "}
              <span className="text-red-600 font-medium">Red</span> = lost access,{" "}
              <span className="text-muted-foreground font-medium">Gray</span> = already excluded pre-injury.
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="md:min-w-[200px]">Occupation</TableHead>
                    <TableHead>SOC</TableHead>
                    <TableHead className="text-center">SVP</TableHead>
                    <TableHead className="text-center">Pre TFQ</TableHead>
                    <TableHead className="text-center">Post TFQ</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead className="text-right">JOLTS (Current)</TableHead>
                    <TableHead className="text-right">JOLTS (At DOI)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Lost Access (red) -- sorted first */}
                  {lostAccess.map((t) => (
                    <TableRow key={t.id} className="bg-red-50/50 dark:bg-red-950/10">
                      <TableCell className="font-medium">{t.title}</TableCell>
                      <TableCell className="font-mono text-xs">{t.onetSocCode}</TableCell>
                      <TableCell className="text-center">{t.svp ?? "\u2014"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-green-100 text-green-800 text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />Pass
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-red-100 text-red-800 text-xs">
                          <XCircle className="h-3 w-3 mr-1" />Fail
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-red-500 text-white text-xs">
                          <TrendingDown className="h-3 w-3 mr-1" />Lost Access
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{t.joltsIndustryName ?? "\u2014"}</TableCell>
                      <TableCell className="text-right text-xs">
                        {t.joltsCurrentOpenings !== null ? Math.round(t.joltsCurrentOpenings * 1000).toLocaleString() : "\u2014"}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {t.joltsPreInjuryOpenings !== null ? Math.round(t.joltsPreInjuryOpenings * 1000).toLocaleString() : "\u2014"}
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Still Accessible (green) */}
                  {stillAccessible.map((t) => (
                    <TableRow key={t.id} className="bg-green-50/30 dark:bg-green-950/10">
                      <TableCell className="font-medium">{t.title}</TableCell>
                      <TableCell className="font-mono text-xs">{t.onetSocCode}</TableCell>
                      <TableCell className="text-center">{t.svp ?? "\u2014"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-green-100 text-green-800 text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />Pass
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-green-100 text-green-800 text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />Pass
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-green-100 text-green-800 text-xs">
                          Still Accessible
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{t.joltsIndustryName ?? "\u2014"}</TableCell>
                      <TableCell className="text-right text-xs">
                        {t.joltsCurrentOpenings !== null ? Math.round(t.joltsCurrentOpenings * 1000).toLocaleString() : "\u2014"}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {t.joltsPreInjuryOpenings !== null ? Math.round(t.joltsPreInjuryOpenings * 1000).toLocaleString() : "\u2014"}
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Already Excluded (gray) */}
                  {alreadyExcluded.map((t) => (
                    <TableRow key={t.id} className="opacity-50">
                      <TableCell className="font-medium">{t.title}</TableCell>
                      <TableCell className="font-mono text-xs">{t.onetSocCode}</TableCell>
                      <TableCell className="text-center">{t.svp ?? "\u2014"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-xs">
                          {t.preTfqPasses === false ? (
                            <><XCircle className="h-3 w-3 mr-1" />Fail</>
                          ) : (
                            "\u2014"
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-xs">
                          {t.excluded ? (
                            <><XCircle className="h-3 w-3 mr-1" />Fail</>
                          ) : (
                            <><CheckCircle className="h-3 w-3 mr-1" />Pass</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-muted-foreground text-xs">
                          N/A Pre-Injury
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{t.joltsIndustryName ?? "\u2014"}</TableCell>
                      <TableCell className="text-right text-xs">
                        {t.joltsCurrentOpenings !== null ? Math.round(t.joltsCurrentOpenings * 1000).toLocaleString() : "\u2014"}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {t.joltsPreInjuryOpenings !== null ? Math.round(t.joltsPreInjuryOpenings * 1000).toLocaleString() : "\u2014"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 4: Near-Miss Occupations */}
      {(nearMissOccs.length > 0 || nearMissData) && (
        <Card className="border-amber-200 bg-amber-50/20 dark:border-amber-800 dark:bg-amber-950/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-amber-600" />
              Near-Miss Occupations
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Occupations that narrowly failed post-injury TFQ. These represent potential retraining or accommodation targets.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary counts */}
            <div className="flex gap-4 flex-wrap">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center min-w-[120px]">
                <p className="text-xs text-muted-foreground">Marginal Near-Misses</p>
                <p className="text-2xl font-bold text-amber-600">
                  {nearMissOccs.filter((t) => t.nearMissSeverity === "marginal").length}
                </p>
              </div>
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-center min-w-[120px]">
                <p className="text-xs text-muted-foreground">Moderate Near-Misses</p>
                <p className="text-2xl font-bold text-orange-600">
                  {nearMissOccs.filter((t) => t.nearMissSeverity === "moderate").length}
                </p>
              </div>
            </div>

            {/* Limiting traits from nearMissAnalysis JSON */}
            {nearMissData && Array.isArray((nearMissData as Record<string, unknown>).limitingTraits) && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Most Limiting Traits</h3>
                <div className="flex gap-2 flex-wrap">
                  {((nearMissData as Record<string, unknown>).limitingTraits as Array<{ trait?: string; count?: number }>).map(
                    (lt: { trait?: string; count?: number }, i: number) => (
                      <Badge key={i} variant="outline" className="bg-amber-100 text-amber-800">
                        {lt.trait ?? "Unknown"}: {lt.count ?? 0} exclusion{(lt.count ?? 0) !== 1 ? "s" : ""}
                      </Badge>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Near-miss occupation list */}
            {nearMissOccs.length > 0 && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="md:min-w-[180px]">Occupation</TableHead>
                      <TableHead>SOC</TableHead>
                      <TableHead className="text-center">Severity</TableHead>
                      <TableHead>Failed Traits</TableHead>
                      <TableHead>Retrainability Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nearMissOccs.map((t) => {
                      const details = safeJson(t.nearMissDetails);
                      const failedTraits = details
                        ? (Array.isArray((details as Record<string, unknown>).failedTraits)
                          ? ((details as Record<string, unknown>).failedTraits as string[])
                          : [])
                        : [];
                      const retrainNotes = details
                        ? (typeof (details as Record<string, unknown>).retrainability === "string"
                          ? (details as Record<string, unknown>).retrainability as string
                          : typeof (details as Record<string, unknown>).notes === "string"
                            ? (details as Record<string, unknown>).notes as string
                            : null)
                        : null;
                      return (
                        <TableRow
                          key={t.id}
                          className={
                            t.nearMissSeverity === "marginal"
                              ? "bg-amber-50/50 dark:bg-amber-950/10"
                              : "bg-orange-50/50 dark:bg-orange-950/10"
                          }
                        >
                          <TableCell className="font-medium text-sm">{t.title}</TableCell>
                          <TableCell className="font-mono text-xs">{t.onetSocCode}</TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={
                                t.nearMissSeverity === "marginal"
                                  ? "bg-amber-100 text-amber-800 text-xs"
                                  : "bg-orange-100 text-orange-800 text-xs"
                              }
                            >
                              {t.nearMissSeverity === "marginal" ? "Marginal" : "Moderate"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {failedTraits.length > 0
                              ? failedTraits.join(", ")
                              : t.exclusionReason ?? "\u2014"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {retrainNotes ?? "\u2014"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* JOLTS Industry Summary */}
      {industrySummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              JOLTS Industry Summary
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Industry-level job openings data from the BLS Job Openings and Labor Turnover Survey.
              Values in thousands.
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Industry</TableHead>
                    <TableHead className="text-center">Pre-Injury Occupations</TableHead>
                    <TableHead className="text-center">Post-Injury Occupations</TableHead>
                    <TableHead className="text-center">Lost</TableHead>
                    <TableHead className="text-right">JOLTS at DOI</TableHead>
                    <TableHead className="text-right">JOLTS Current</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {industrySummary.map(([code, data]) => {
                    const lost = data.preAccess - data.postAccess;
                    const joltsChange = data.currentOpenings - data.preOpenings;
                    return (
                      <TableRow key={code}>
                        <TableCell className="font-medium">{data.name}</TableCell>
                        <TableCell className="text-center text-blue-600 font-bold">
                          {data.preAccess}
                        </TableCell>
                        <TableCell className="text-center text-amber-600 font-bold">
                          {data.postAccess}
                        </TableCell>
                        <TableCell className="text-center">
                          {lost > 0 ? (
                            <span className="text-red-600 font-bold">-{lost}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {data.preOpenings > 0 ? Math.round(data.preOpenings * 1000).toLocaleString() : "\u2014"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {data.currentOpenings > 0 ? Math.round(data.currentOpenings * 1000).toLocaleString() : "\u2014"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {data.preOpenings > 0 && data.currentOpenings > 0 ? (
                            <span
                              className={
                                joltsChange >= 0 ? "text-green-600" : "text-red-600"
                              }
                            >
                              {joltsChange >= 0 ? "+" : ""}
                              {Math.round(joltsChange * 1000).toLocaleString()}
                            </span>
                          ) : (
                            "\u2014"
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 1: Regional Labor Market */}
      {regionalData && (
        <Card className="border-indigo-200 bg-indigo-50/20 dark:border-indigo-800 dark:bg-indigo-950/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-indigo-600" />
              Regional Labor Market
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Local labor market context for the evaluee&apos;s geographic area.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Location summary */}
            {typeof (regionalData as Record<string, unknown>).locationSummary === "string" && (
              <p className="text-sm">{(regionalData as Record<string, unknown>).locationSummary as string}</p>
            )}

            {/* Wage premium badge */}
            {(regionalData as Record<string, unknown>).wagePremiumPct != null && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Wage Premium:</span>
                {(() => {
                  const pct = Number((regionalData as Record<string, unknown>).wagePremiumPct);
                  const isAbove = pct >= 0;
                  return (
                    <Badge
                      variant="outline"
                      className={isAbove ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}
                    >
                      {isAbove ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                      {isAbove ? "Above" : "Below"} average by {Math.abs(pct).toFixed(1)}%
                    </Badge>
                  );
                })()}
              </div>
            )}

            {/* Employment concentration */}
            {typeof (regionalData as Record<string, unknown>).employmentConcentration === "string" && (
              <div>
                <h3 className="text-sm font-semibold mb-1">Employment Concentration</h3>
                <p className="text-sm text-muted-foreground">
                  {(regionalData as Record<string, unknown>).employmentConcentration as string}
                </p>
              </div>
            )}

            {/* State JOLTS narrative */}
            {typeof (regionalData as Record<string, unknown>).stateJoltsNarrative === "string" && (
              <div>
                <h3 className="text-sm font-semibold mb-1">State JOLTS Trends</h3>
                <p className="text-sm text-muted-foreground">
                  {(regionalData as Record<string, unknown>).stateJoltsNarrative as string}
                  {(regionalData as Record<string, unknown>).stateJoltsChangePct != null && (
                    <span className="ml-1 font-medium">
                      ({Number((regionalData as Record<string, unknown>).stateJoltsChangePct) >= 0 ? "+" : ""}
                      {Number((regionalData as Record<string, unknown>).stateJoltsChangePct).toFixed(1)}% change)
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Risks and Opportunities */}
            {(Array.isArray((regionalData as Record<string, unknown>).risks) ||
              Array.isArray((regionalData as Record<string, unknown>).opportunities)) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.isArray((regionalData as Record<string, unknown>).risks) &&
                  ((regionalData as Record<string, unknown>).risks as string[]).length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-red-700 mb-2">Risks</h3>
                    <ul className="space-y-1">
                      {((regionalData as Record<string, unknown>).risks as string[]).map((r: string, i: number) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-red-500 mt-1 shrink-0">&#x2022;</span>
                          <span className="text-muted-foreground">{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {Array.isArray((regionalData as Record<string, unknown>).opportunities) &&
                  ((regionalData as Record<string, unknown>).opportunities as string[]).length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-green-700 mb-2">Opportunities</h3>
                    <ul className="space-y-1">
                      {((regionalData as Record<string, unknown>).opportunities as string[]).map((o: string, i: number) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-green-500 mt-1 shrink-0">&#x2022;</span>
                          <span className="text-muted-foreground">{o}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Growing vs Declining Occupations */}
            {(Array.isArray((regionalData as Record<string, unknown>).growingOccupations) ||
              Array.isArray((regionalData as Record<string, unknown>).decliningOccupations)) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.isArray((regionalData as Record<string, unknown>).growingOccupations) &&
                  ((regionalData as Record<string, unknown>).growingOccupations as string[]).length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-1">
                      <TrendingUp className="h-4 w-4" />
                      Growing Occupations
                    </h3>
                    <ul className="space-y-1">
                      {((regionalData as Record<string, unknown>).growingOccupations as string[]).map((o: string, i: number) => (
                        <li key={i} className="text-sm text-muted-foreground">{o}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {Array.isArray((regionalData as Record<string, unknown>).decliningOccupations) &&
                  ((regionalData as Record<string, unknown>).decliningOccupations as string[]).length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1">
                      <TrendingDown className="h-4 w-4" />
                      Declining Occupations
                    </h3>
                    <ul className="space-y-1">
                      {((regionalData as Record<string, unknown>).decliningOccupations as string[]).map((o: string, i: number) => (
                        <li key={i} className="text-sm text-muted-foreground">{o}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Earning Capacity Impact (Enhanced - Section 2) */}
      {(analysis?.vqsPostEcMedian !== null || analysis?.vqsPreEcMedian !== null) && (
        <Card className="border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Earning Capacity Impact
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              VQS-based earning capacity estimates per target occupation. Shows VQ band, TSP tier, full percentile distribution, and EC with 95% confidence intervals.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* EC Summary Cards */}
            {analysis?.vqsPreEcMedian !== null && analysis?.vqsPostEcMedian !== null && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Pre-Injury EC</p>
                  <p className="text-xl font-bold text-blue-600">{formatHourly(analysis?.vqsPreEcMedian ?? null)}/hr</p>
                  <p className="text-xs text-muted-foreground">{formatAnnual(analysis?.vqsPreEcMedian ?? null)}/yr</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Post-Injury EC</p>
                  <p className="text-xl font-bold text-amber-600">{formatHourly(analysis?.vqsPostEcMedian ?? null)}/hr</p>
                  <p className="text-xs text-muted-foreground">{formatAnnual(analysis?.vqsPostEcMedian ?? null)}/yr</p>
                </div>
                {analysis?.vqsEcLoss !== null && (
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-xs text-muted-foreground">EC Loss</p>
                    <p className={`text-xl font-bold ${(analysis?.vqsEcLoss ?? 0) > 0 ? "text-red-600" : "text-green-600"}`}>
                      {(analysis?.vqsEcLoss ?? 0) > 0 ? "-" : "+"}{formatHourly(Math.abs(analysis?.vqsEcLoss ?? 0))}/hr
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatAnnual(Math.abs(analysis?.vqsEcLoss ?? 0))}/yr
                    </p>
                  </div>
                )}
                {analysis?.vqsEcLossPct !== null && (
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-xs text-muted-foreground">Loss %</p>
                    <p className={`text-xl font-bold ${(analysis?.vqsEcLossPct ?? 0) > 0 ? "text-red-600" : "text-green-600"}`}>
                      {analysis?.vqsEcLossPct?.toFixed(1)}%
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Enhanced Per-occupation EC table with percentile distribution */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="md:min-w-[160px]">Occupation</TableHead>
                    <TableHead className="text-center">VQ</TableHead>
                    <TableHead className="text-center">Band</TableHead>
                    <TableHead className="text-center">TSP</TableHead>
                    <TableHead className="text-right">EC Median</TableHead>
                    <TableHead className="text-right">Annual EC</TableHead>
                    <TableHead className="text-center min-w-[200px]">Percentile Distribution</TableHead>
                    <TableHead className="text-right">95% CI</TableHead>
                    <TableHead className="text-center">Pre</TableHead>
                    <TableHead className="text-center">Post</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {targets
                    .filter(t => t.vqScore !== null)
                    .sort((a, b) => (b.ecMedian ?? 0) - (a.ecMedian ?? 0))
                    .map((t) => {
                      const lost = t.preTfqPasses === true && t.excluded;
                      const p10 = t.ec10;
                      const p25 = t.ec25;
                      const med = t.ecMedian;
                      const p75 = t.ec75;
                      const p90 = t.ec90;
                      // Calculate range bar percentages
                      const rangeMin = p10 ?? p25 ?? med ?? 0;
                      const rangeMax = p90 ?? p75 ?? med ?? 0;
                      const range = rangeMax - rangeMin;
                      const medPos = range > 0 && med !== null ? ((med - rangeMin) / range) * 100 : 50;

                      return (
                        <TableRow key={t.id} className={lost ? "bg-red-50/50 dark:bg-red-950/10" : ""}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{t.title}</p>
                              <p className="text-xs text-muted-foreground font-mono">{t.onetSocCode}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-0.5">
                              <span className="font-mono text-sm">{t.vqScore?.toFixed(0) ?? "\u2014"}</span>
                              <ScoreTooltip breakdown={buildVQBreakdown(t.vqScore, t.vqBand, t.vqDetails)} />
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={`${getVQBandColor(t.vqBand)} text-xs`} variant="outline">
                              B{t.vqBand} {getVQBandLabel(t.vqBand)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {t.tspScore !== null ? (
                              <Badge className={`${getTSPTierColor(t.tspTier)} text-xs`} variant="outline">
                                {t.tspScore.toFixed(0)}% T{t.tspTier}
                              </Badge>
                            ) : "\u2014"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-0.5">
                              <span className="font-mono text-sm font-semibold text-green-700">{formatHourly(t.ecMedian)}</span>
                              <ScoreTooltip breakdown={buildECBreakdown(t)} />
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {formatAnnual(t.ecMedian)}
                          </TableCell>
                          <TableCell className="text-center">
                            {(p10 !== null || p25 !== null) && (p90 !== null || p75 !== null) ? (
                              <div className="space-y-1">
                                {/* Horizontal range bar */}
                                <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden mx-auto max-w-[180px]">
                                  <div
                                    className="absolute h-full bg-green-200 rounded-full"
                                    style={{ left: "0%", width: "100%" }}
                                  />
                                  {/* P25-P75 range */}
                                  {p25 !== null && p75 !== null && range > 0 && (
                                    <div
                                      className="absolute h-full bg-green-400 rounded-full"
                                      style={{
                                        left: `${((p25 - rangeMin) / range) * 100}%`,
                                        width: `${((p75 - p25) / range) * 100}%`,
                                      }}
                                    />
                                  )}
                                  {/* Median marker */}
                                  <div
                                    className="absolute top-0 h-full w-0.5 bg-green-800"
                                    style={{ left: `${medPos}%` }}
                                  />
                                </div>
                                {/* Labels */}
                                <div className="flex justify-between text-[10px] text-muted-foreground font-mono max-w-[180px] mx-auto">
                                  <span>{formatHourly(p10 ?? p25)}</span>
                                  <span className="font-semibold">{formatHourly(med)}</span>
                                  <span>{formatHourly(p90 ?? p75)}</span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">{"\u2014"}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            [{formatHourly(t.ecConfLow)}, {formatHourly(t.ecConfHigh)}]
                          </TableCell>
                          <TableCell className="text-center">
                            {t.preTfqPasses === true ? (
                              <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                            ) : t.preTfqPasses === false ? (
                              <XCircle className="h-4 w-4 text-red-600 mx-auto" />
                            ) : (
                              <Minus className="h-4 w-4 text-muted-foreground mx-auto" />
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {!t.excluded ? (
                              <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600 mx-auto" />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 5: Viable Set Quality */}
      {viableSetData && (
        <Card className="border-purple-200 bg-purple-50/20 dark:border-purple-800 dark:bg-purple-950/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-purple-600" />
              Viable Set Quality
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Analysis of the coherence and quality of the post-injury viable occupation set.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Coherence score */}
            {(viableSetData as Record<string, unknown>).coherenceScore != null && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Coherence Score:</span>
                <span className="text-2xl font-bold text-purple-600">
                  {Number((viableSetData as Record<string, unknown>).coherenceScore).toFixed(1)}
                </span>
                {typeof (viableSetData as Record<string, unknown>).coherenceLabel === "string" && (
                  <Badge variant="outline" className="bg-purple-100 text-purple-800">
                    {(viableSetData as Record<string, unknown>).coherenceLabel as string}
                  </Badge>
                )}
              </div>
            )}

            {/* Core vs Peripheral occupations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Core occupations (high STQ) */}
              {(() => {
                const coreOccs = targets
                  .filter((t) => !t.excluded && t.stq != null && t.stq >= 70)
                  .sort((a, b) => (b.stq ?? 0) - (a.stq ?? 0));
                if (coreOccs.length === 0) return null;
                return (
                  <div>
                    <h3 className="text-sm font-semibold text-purple-700 mb-2">
                      Core Occupations (High STQ)
                    </h3>
                    <div className="space-y-1">
                      {coreOccs.map((t) => (
                        <div key={t.id} className="flex items-center justify-between rounded border p-2 bg-purple-50/50">
                          <span className="text-sm">{t.title}</span>
                          <div className="flex items-center gap-0.5">
                            <Badge variant="outline" className="bg-purple-100 text-purple-800 text-xs">
                              STQ {t.stq?.toFixed(0)}
                            </Badge>
                            <ScoreTooltip breakdown={buildSTQBreakdown(t.stq, t.stqDetails)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Peripheral occupations (low STQ) */}
              {(() => {
                const peripheralOccs = targets
                  .filter((t) => !t.excluded && t.stq != null && t.stq < 70)
                  .sort((a, b) => (a.stq ?? 0) - (b.stq ?? 0));
                if (peripheralOccs.length === 0) return null;
                return (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-600 mb-2">
                      Peripheral Occupations (Low STQ)
                    </h3>
                    <div className="space-y-1">
                      {peripheralOccs.map((t) => (
                        <div key={t.id} className="flex items-center justify-between rounded border p-2 bg-slate-50/50">
                          <span className="text-sm">{t.title}</span>
                          <div className="flex items-center gap-0.5">
                            <Badge variant="outline" className="text-xs">
                              STQ {t.stq?.toFixed(0)}
                            </Badge>
                            <ScoreTooltip breakdown={buildSTQBreakdown(t.stq, t.stqDetails)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Narrative summary */}
            {typeof (viableSetData as Record<string, unknown>).narrative === "string" && (
              <div className="rounded-lg border p-3 bg-purple-50/30">
                <p className="text-sm text-muted-foreground">
                  {(viableSetData as Record<string, unknown>).narrative as string}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Most Frequently Hired Occupations - Access Comparison */}
      {(() => {
        const hjcRaw = safeJson(analysis?.hiredJobsComparison);
        if (!hjcRaw) return null;
        const hjc = hjcRaw as {
          totalJobs: number;
          preInjuryAccessible: number;
          postInjuryAccessible: number;
          accessLost: number;
          accessRetained: number;
          neverAccessible: number;
          reductionPercent: number;
          comparisons: Array<{
            job: { socCode: string; title: string; estimatedHires: number };
            preInjury: { canPerform: boolean; failingTraits: string[]; marginAvg: number };
            postInjury: { canPerform: boolean; failingTraits: string[]; marginAvg: number };
            accessLost: boolean;
          }>;
        };
        const top15 = (hjc.comparisons ?? []).slice(0, 15);
        if (top15.length === 0) return null;

        const traitLabelMap: Record<string, string> = {};
        for (const td of TRAIT_DEFS) {
          traitLabelMap[td.key] = td.label;
        }

        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Most Frequently Hired Occupations &mdash; Access Comparison
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-2xl font-bold text-green-700">
                    {hjc.preInjuryAccessible}
                    <span className="text-sm font-normal text-muted-foreground"> of {top15.length}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">Pre-Injury Accessible</div>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-2xl font-bold text-blue-700">
                    {hjc.postInjuryAccessible}
                    <span className="text-sm font-normal text-muted-foreground"> of {top15.length}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">Post-Injury Accessible</div>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <div className={`text-2xl font-bold ${hjc.reductionPercent > 0 ? "text-red-700" : "text-green-700"}`}>
                    {hjc.reductionPercent}%
                  </div>
                  <div className="text-xs text-muted-foreground">Access Reduction</div>
                </div>
              </div>

              {/* Job comparison table */}
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">Occupation Group</TableHead>
                      <TableHead className="text-center w-[100px]">Est. Hires/Mo</TableHead>
                      <TableHead className="text-center w-[100px]">Pre-Injury</TableHead>
                      <TableHead className="text-center w-[100px]">Post-Injury</TableHead>
                      <TableHead>Failing Traits (Post-Injury)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {top15.map((c, idx) => (
                      <TableRow
                        key={idx}
                        className={c.accessLost ? "bg-red-50/50" : ""}
                      >
                        <TableCell className="font-medium text-sm">
                          <span className="text-muted-foreground mr-1">
                            SOC {c.job.socCode}
                          </span>
                          {c.job.title}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {c.job.estimatedHires?.toLocaleString() ?? "\u2014"}
                        </TableCell>
                        <TableCell className="text-center">
                          {c.preInjury.canPerform ? (
                            <CheckCircle className="h-4 w-4 text-green-600 inline" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 inline" />
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {c.postInjury.canPerform ? (
                            <CheckCircle className="h-4 w-4 text-green-600 inline" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 inline" />
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.accessLost && c.postInjury.failingTraits.length > 0
                            ? c.postInjury.failingTraits
                                .map((t) => traitLabelMap[t] ?? t)
                                .join(", ")
                            : c.postInjury.canPerform
                              ? ""
                              : c.postInjury.failingTraits.length > 0
                                ? c.postInjury.failingTraits
                                    .map((t) => traitLabelMap[t] ?? t)
                                    .join(", ")
                                : ""}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Legend */}
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-600" /> Accessible
                </span>
                <span className="flex items-center gap-1">
                  <XCircle className="h-3 w-3 text-red-500" /> Not accessible
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 bg-red-50 border border-red-200 rounded-sm" /> Access lost due to injury
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Comprehensive Labor Market Access — Lost Occupations */}
      {analysis?.laborMarketAccess && (() => {
        const lma = analysis.laborMarketAccess;
        if (!lma.lostOccupations || lma.lostOccupations.length === 0) return null;
        return (
          <Card className="border-indigo-200 bg-indigo-50/30 dark:border-indigo-800 dark:bg-indigo-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-indigo-600" />
                Comprehensive Labor Market Access — Lost Occupations
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Occupations the worker could access pre-injury but can no longer perform post-injury,
                across all {lma.totalOccupationsAnalyzed?.toLocaleString() ?? ""} OEWS occupations analyzed.
                Lost {lma.occupationsLost?.toLocaleString() ?? 0} occupations ({lma.occupationsLostPct?.toFixed(1) ?? 0}%) representing{" "}
                {lma.employmentLost?.toLocaleString() ?? 0} jobs nationally ({lma.employmentLostPct?.toFixed(1) ?? 0}%).
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SOC</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead className="text-right">National Empl.</TableHead>
                      {lma.preInjuryAreaEmployment > 0 && (
                        <TableHead className="text-right">Area Empl.</TableHead>
                      )}
                      <TableHead>Strength</TableHead>
                      <TableHead>Failed Traits</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(lma.lostOccupations as { code: string; title: string; employment: number; areaEmployment: number; strength: string; failedTraits?: string[] }[])
                      .slice(0, 30)
                      .map((occ: { code: string; title: string; employment: number; areaEmployment: number; strength: string; failedTraits?: string[] }) => (
                      <TableRow key={occ.code}>
                        <TableCell className="font-mono text-xs">{occ.code}</TableCell>
                        <TableCell className="text-sm">{occ.title}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{occ.employment?.toLocaleString()}</TableCell>
                        {lma.preInjuryAreaEmployment > 0 && (
                          <TableCell className="text-right font-mono text-sm">{occ.areaEmployment > 0 ? occ.areaEmployment.toLocaleString() : "\u2014"}</TableCell>
                        )}
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{occ.strength}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-red-600 max-w-[200px] truncate">
                          {occ.failedTraits?.join(", ") ?? ""}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {lma.lostOccupations.length > 30 && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Showing top 30 of {lma.lostOccupations.length} lost occupations (sorted by employment)
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Methodology Note */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Methodology</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>Pre-Injury TFQ:</strong> Computed using the same 24-trait feasibility model as
            the standard post-injury TFQ, but applied against the Pre-Injury worker profile.
            Occupations that pass the pre-injury TFQ but fail post-injury TFQ represent
            labor market access lost due to the injury.
          </p>
          <p>
            <strong>JOLTS Data:</strong> Job openings and hires data from the Bureau of Labor
            Statistics Job Openings and Labor Turnover Survey (JOLTS). Industry-level data is
            mapped to occupations via SOC major group to NAICS industry crosswalk. Values
            represent monthly averages in thousands for the calendar year.
          </p>
          <p>
            <strong>VQS Earning Capacity:</strong> Based on VQ band-level regression with OEWS
            wage data, geographic ECLR adjustments, and published Standard Errors of Estimate
            from VQS validity research (McCroskey et al., 2011).
          </p>
          <p>
            <strong>Near-Miss Analysis:</strong> Occupations that narrowly fail one or more
            TFQ traits are classified by severity (marginal = 1 trait off by 1 level,
            moderate = 2 traits or 1 trait off by 2 levels). These may represent retraining
            or accommodation opportunities.
          </p>
          <p>
            <strong>Viable Set Quality:</strong> Coherence measures how related the remaining
            viable occupations are by skill profile similarity. Higher coherence indicates a
            focused set; lower coherence indicates a fragmented labor market.
          </p>
          <p>
            <strong>Hired Jobs Access:</strong> The most frequently hired occupation groups are
            derived from JOLTS industry-level hires distributed via BLS staffing patterns to
            SOC major groups. Each group is assigned a simplified trait demand profile based on
            DOT conventions. A worker can perform a job if all 24 trait capacities meet or exceed
            the demand level (default demand: 1 for unspecified traits; null worker capacity
            treated as 0).
          </p>
          <Separator />
          <p className="text-xs">
            Pre-injury date of injury openings use the closest available JOLTS year to the
            date of injury. Current openings use the most recent available year.
          </p>
        </CardContent>
      </Card>

      <WizardNavButtons caseId={caseId} currentStep={7} />
      </div>
    </div>
  );
}
