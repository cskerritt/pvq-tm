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
  BarChart3,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { CaseBreadcrumb } from "@/components/case-breadcrumb";

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
  excluded: boolean;
  exclusionReason: string | null;
  preTfq: number | null;
  preTfqPasses: boolean | null;
  joltsIndustryCode: string | null;
  joltsIndustryName: string | null;
  joltsCurrentOpenings: number | null;
  joltsPreInjuryOpenings: number | null;
  // MVQS fields
  vqScore: number | null;
  vqBand: number | null;
  tspScore: number | null;
  tspTier: number | null;
  tspLabel: string | null;
  ecMedian: number | null;
  ecConfLow: number | null;
  ecConfHigh: number | null;
  ecSee: number | null;
  ecGeoAdjusted: boolean | null;
  preVqScore: number | null;
  preEcMedian: number | null;
}

interface AnalysisData {
  id: string;
  name: string | null;
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

function getVQBandColor(band: number | null): string {
  switch (band) {
    case 1: return "bg-blue-100 text-blue-800";
    case 2: return "bg-green-100 text-green-800";
    case 3: return "bg-amber-100 text-amber-800";
    case 4: return "bg-red-100 text-red-800";
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

  return (
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
                  {/* Lost Access (red) — sorted first */}
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
                        {t.joltsCurrentOpenings !== null ? `${t.joltsCurrentOpenings.toFixed(1)}K` : "\u2014"}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {t.joltsPreInjuryOpenings !== null ? `${t.joltsPreInjuryOpenings.toFixed(1)}K` : "\u2014"}
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
                        {t.joltsCurrentOpenings !== null ? `${t.joltsCurrentOpenings.toFixed(1)}K` : "\u2014"}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {t.joltsPreInjuryOpenings !== null ? `${t.joltsPreInjuryOpenings.toFixed(1)}K` : "\u2014"}
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
                        {t.joltsCurrentOpenings !== null ? `${t.joltsCurrentOpenings.toFixed(1)}K` : "\u2014"}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {t.joltsPreInjuryOpenings !== null ? `${t.joltsPreInjuryOpenings.toFixed(1)}K` : "\u2014"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
                    <TableHead className="text-right">JOLTS at DOI (K)</TableHead>
                    <TableHead className="text-right">JOLTS Current (K)</TableHead>
                    <TableHead className="text-right">Change (K)</TableHead>
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
                          {data.preOpenings > 0 ? data.preOpenings.toFixed(1) : "\u2014"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {data.currentOpenings > 0 ? data.currentOpenings.toFixed(1) : "\u2014"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {data.preOpenings > 0 && data.currentOpenings > 0 ? (
                            <span
                              className={
                                joltsChange >= 0 ? "text-green-600" : "text-red-600"
                              }
                            >
                              {joltsChange >= 0 ? "+" : ""}
                              {joltsChange.toFixed(1)}
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

      {/* Earning Capacity Impact */}
      {(analysis?.mvqsPostEcMedian !== null || analysis?.mvqsPreEcMedian !== null) && (
        <Card className="border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Earning Capacity Impact
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              MVQS-based earning capacity estimates per target occupation. Shows VQ band, TSP tier, and EC with 95% confidence intervals.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* EC Summary Cards */}
            {analysis?.mvqsPreEcMedian !== null && analysis?.mvqsPostEcMedian !== null && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Pre-Injury EC</p>
                  <p className="text-xl font-bold text-blue-600">{formatHourly(analysis?.mvqsPreEcMedian ?? null)}/hr</p>
                  <p className="text-xs text-muted-foreground">${((analysis?.mvqsPreEcMedian ?? 0) * 2080).toLocaleString("en-US", { maximumFractionDigits: 0 })}/yr</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Post-Injury EC</p>
                  <p className="text-xl font-bold text-amber-600">{formatHourly(analysis?.mvqsPostEcMedian ?? null)}/hr</p>
                  <p className="text-xs text-muted-foreground">${((analysis?.mvqsPostEcMedian ?? 0) * 2080).toLocaleString("en-US", { maximumFractionDigits: 0 })}/yr</p>
                </div>
                {analysis?.mvqsEcLoss !== null && (
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-xs text-muted-foreground">EC Loss</p>
                    <p className={`text-xl font-bold ${(analysis?.mvqsEcLoss ?? 0) > 0 ? "text-red-600" : "text-green-600"}`}>
                      {(analysis?.mvqsEcLoss ?? 0) > 0 ? "-" : "+"}{formatHourly(Math.abs(analysis?.mvqsEcLoss ?? 0))}/hr
                    </p>
                  </div>
                )}
                {analysis?.mvqsEcLossPct !== null && (
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-xs text-muted-foreground">Loss %</p>
                    <p className={`text-xl font-bold ${(analysis?.mvqsEcLossPct ?? 0) > 0 ? "text-red-600" : "text-green-600"}`}>
                      {analysis?.mvqsEcLossPct?.toFixed(1)}%
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Per-occupation EC table */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="md:min-w-[180px]">Occupation</TableHead>
                    <TableHead className="text-center">VQ</TableHead>
                    <TableHead className="text-center">Band</TableHead>
                    <TableHead className="text-center">TSP</TableHead>
                    <TableHead className="text-right">EC Median</TableHead>
                    <TableHead className="text-right">95% CI</TableHead>
                    <TableHead className="text-center">Pre Access</TableHead>
                    <TableHead className="text-center">Post Access</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {targets
                    .filter(t => t.vqScore !== null)
                    .sort((a, b) => (b.ecMedian ?? 0) - (a.ecMedian ?? 0))
                    .map((t) => {
                      const lost = t.preTfqPasses === true && t.excluded;
                      return (
                        <TableRow key={t.id} className={lost ? "bg-red-50/50 dark:bg-red-950/10" : ""}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{t.title}</p>
                              <p className="text-xs text-muted-foreground font-mono">{t.onetSocCode}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-mono text-sm">{t.vqScore?.toFixed(0) ?? "\u2014"}</TableCell>
                          <TableCell className="text-center">
                            <Badge className={`${getVQBandColor(t.vqBand)} text-xs`} variant="outline">
                              B{t.vqBand}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {t.tspScore !== null ? (
                              <Badge className={`${getTSPTierColor(t.tspTier)} text-xs`} variant="outline">
                                {t.tspScore.toFixed(0)}% T{t.tspTier}
                              </Badge>
                            ) : "\u2014"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold text-green-700">
                            {formatHourly(t.ecMedian)}
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
            <strong>MVQS Earning Capacity:</strong> Based on VQ band-level regression with OEWS
            wage data, geographic ECLR adjustments, and published Standard Errors of Estimate
            from MVQS validity research (McCroskey et al., 2011).
          </p>
          <Separator />
          <p className="text-xs">
            Pre-injury date of injury openings use the closest available JOLTS year to the
            date of injury. Current openings use the most recent available year.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
