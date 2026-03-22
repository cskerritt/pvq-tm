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
import { FileText, Download, ChevronDown, ChevronUp, ExternalLink, DollarSign, TrendingUp, ArrowUpDown, Sparkles, Loader2, RefreshCw, AlertTriangle, BarChart3, ShieldCheck, Target, Layers, Info, Globe, BookOpen } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Fragment } from "react";
import { CaseBreadcrumb } from "@/components/case-breadcrumb";
import {
  ScoreTooltip,
  buildTFQBreakdown,
  buildPVQBreakdown,
  buildLMQBreakdown,
  buildVQBreakdown,
  buildECBreakdown,
  buildSTQBreakdown,
  buildVAQBreakdown,
} from "@/components/score-tooltip";
import { WizardNav, WizardNavButtons } from "@/components/wizard-nav";

// ─── Types ──────────────────────────────────────────────────────

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
  // VQS aggregates
  vqsPostEcMedian: number | null;
  vqsPreEcMedian: number | null;
  vqsEcLoss: number | null;
  vqsEcLossPct: number | null;
  // Analysis-level JSON fields
  rfcNarrative: RfcNarrative | null;
  nearMissAnalysis: NearMissAnalysis | null;
  viableSetAnalysis: ViableSetAnalysis | null;
  confidenceExplanation: ConfidenceExplanation | null;
  regionalLaborMarket: RegionalLaborMarket | null;
  laborMarketAccess: LaborMarketAccess | null;
  zeroViableExplanation: ZeroViableExplanation | null;
  updatedAt?: string;
  case: { clientName: string; id: string; dateOfInjury: string | null };
  targetOccupations: TargetOcc[];
}

interface RfcNarrative {
  functionalLevel?: string;
  functionalLevelLabel?: string;
  physicalSummary?: string;
  cognitiveSummary?: string;
  environmentalSummary?: string;
  suitableWorkTypes?: string[];
  unsuitableWorkTypes?: string[];
  strengths?: { trait: string; label: string; level: number; description: string }[];
  limitations?: { trait: string; label: string; level: number; description: string; impactOnWork: string }[] | string[];
  moderateCapabilities?: string[];
  fullNarrative?: string;
}

interface NearMissTraitDetail {
  trait: string;
  label: string;
  workerCapacity: number;
  occupationDemand: number;
  deficit: number;
  traitGroup: string;
  isLearnable: boolean;
}

interface NearMissOccupation {
  occupationTitle: string;
  dotCode?: string;
  onetCode?: string;
  failedTraitCount: number;
  totalDeficit: number;
  maxSingleDeficit: number;
  failedTraits: NearMissTraitDetail[];
  severity: string;
  retrainable: boolean;
  retrainingNotes: string[];
  svpGap: number | null;
  svpRetrainingMonths: number | null;
}

interface NearMissAnalysis {
  totalExcluded?: number;
  marginalCount?: number;
  moderateCount?: number;
  significantCount?: number;
  commonFailingTraits?: { trait: string; label: string; count: number; group: string }[];
  // Legacy field name
  mostCommonFailingTraits?: { trait: string; count: number }[];
  limitingTraits?: string[];
  nearMisses?: NearMissOccupation[];
  // Legacy field name
  nearMissOccupations?: {
    title: string;
    onetSocCode: string;
    severity: string;
    failedTraits?: string[];
    retrainabilityNotes?: string;
  }[];
}

interface OccupationCluster {
  name: string;
  occupations: string[];
  avgStq?: number;
  avgPvq?: number;
  commonTraitStrengths?: string[];
}

interface TraitRange {
  trait: string;
  label: string;
  minDemand: number;
  maxDemand: number;
  avgDemand: number;
  isNarrow: boolean;
  isWide: boolean;
}

interface ViableSetAnalysis {
  totalViable?: number;
  coherenceScore?: number | string;
  coherenceLabel?: string;
  clusters?: OccupationCluster[];
  coreOccupations?: string[];
  peripheralOccupations?: string[];
  traitDemandRange?: TraitRange[];
  narrativeSummary?: string;
}

interface ConfidenceContribution {
  component: string;
  label: string;
  points: number;
  maxPoints: number;
  // Legacy field name
  max?: number;
  reason: string;
}

interface ConfidenceExplanation {
  grade?: string;
  totalScore?: number;
  maxPossible?: number;
  summary?: string;
  contributions?: ConfidenceContribution[];
  penalties?: { component?: string; label?: string; reason: string; points: number; maxPoints?: number }[];
  recommendations?: string[];
}

interface RegionalLaborMarket {
  locationSummary?: string;
  wagePremiumPct?: number | null;
  wagePremiumLabel?: string;
  employmentConcentration?: string;
  areaToNationalRatio?: number | null;
  stateJoltsNarrative?: string | null;
  stateJoltsChangePct?: number | null;
  growingOccupations?: string[];
  decliningOccupations?: string[];
  stableOccupations?: string[];
  fullNarrative?: string;
  risks?: string[];
  opportunities?: string[];
}

interface LaborMarketAccessStrength {
  sedentary: number;
  light: number;
  medium: number;
  heavy: number;
  veryHeavy: number;
}

interface LaborMarketAccessOcc {
  code: string;
  title: string;
  employment: number;
  areaEmployment: number;
  strength: string;
  failedTraits?: string[];
}

interface LaborMarketAccess {
  totalOccupationsAnalyzed: number;
  preInjuryAccessible: number;
  preInjuryEmployment: number;
  preInjuryAreaEmployment: number;
  postInjuryAccessible: number;
  postInjuryEmployment: number;
  postInjuryAreaEmployment: number;
  occupationsLost: number;
  occupationsLostPct: number;
  employmentLost: number;
  employmentLostPct: number;
  areaEmploymentLost: number;
  areaEmploymentLostPct: number;
  preByStrength: LaborMarketAccessStrength;
  postByStrength: LaborMarketAccessStrength;
  mostCommonFailingTraits: { trait: string; count: number }[];
  lostOccupations: LaborMarketAccessOcc[];
  retainedOccupations: LaborMarketAccessOcc[];
  gainedOccupations: LaborMarketAccessOcc[];
}

interface ZeroViableExplanation {
  totalCandidatesEvaluated: number;
  viableCount: number;
  summary: string;
  primaryExclusionFactors: { trait: string; count: number; pctOfExcluded: number }[];
  strengthAnalysis: {
    workerLevel: string;
    workerValue: number;
    exclusionsDueToStrength: number;
    details: string[];
  };
  workerLimitations: string[];
  exclusionReasonBreakdown: { reason: string; count: number }[];
  vocationalImplication: string | null;
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
  joltsTrend: number | null;
  joltsTrendLabel: string | null;
  // VQS fields
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
  // Near-miss fields
  nearMissSeverity: string | null;
  nearMissDetails: Record<string, unknown> | null;
  // Trait margin fields
  traitMarginMin: number | null;
  traitMarginAvg: number | null;
  closestFailTrait: string | null;
}

// ─── Helper Functions ──────────────────────────────────────────

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
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}

function formatHourly(val: number | null, suppressLabel = false): string {
  if (val === null) return suppressLabel ? "N/A (BLS suppressed)" : "\u2014";
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

function getFunctionalLevelColor(level: string): string {
  switch (level?.toLowerCase()) {
    case "sedentary": return "bg-green-100 text-green-800";
    case "light": return "bg-blue-100 text-blue-800";
    case "medium": return "bg-yellow-100 text-yellow-800";
    case "heavy": return "bg-orange-100 text-orange-800";
    case "very_heavy": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

function getCoherenceColor(label: string): string {
  switch (label?.toLowerCase()) {
    case "highly_coherent": return "bg-green-100 text-green-800";
    case "moderately_coherent": return "bg-blue-100 text-blue-800";
    case "diverse": return "bg-yellow-100 text-yellow-800";
    case "scattered": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

function formatCoherenceLabel(label: string): string {
  return (label ?? "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function getCoherenceLabelFromScore(score: number | string | undefined): string {
  if (typeof score === "string") return score;
  if (typeof score !== "number") return "unknown";
  if (score > 70) return "highly_coherent";
  if (score > 50) return "moderately_coherent";
  if (score > 30) return "diverse";
  return "scattered";
}

function getTraitMarginColor(margin: number): string {
  if (margin < 0) return "bg-red-500";
  if (margin === 0) return "bg-orange-400";
  if (margin === 1) return "bg-yellow-400";
  return "bg-green-500";
}

function getTraitMarginTextColor(margin: number): string {
  if (margin < 0) return "text-red-600";
  if (margin === 0) return "text-orange-600";
  if (margin === 1) return "text-yellow-600";
  return "text-green-600";
}

function getVaqLabel(value: number | undefined | null): string {
  if (value == null) return "\u2014";
  if (value >= 75) return "Substantial";
  if (value >= 50) return "Moderate";
  if (value >= 25) return "Slight";
  return "Very little";
}

function getNearMissBadgeColor(severity: string | null): string {
  switch (severity) {
    case "marginal": return "bg-amber-100 text-amber-800 border-amber-300";
    case "moderate": return "bg-orange-100 text-orange-800 border-orange-300";
    case "significant": return "bg-red-100 text-red-800 border-red-300";
    default: return "";
  }
}

function getNearMissBadgeLabel(severity: string | null): string {
  switch (severity) {
    case "marginal": return "Near Miss - Marginal";
    case "moderate": return "Near Miss - Moderate";
    case "significant": return "Near Miss - Significant";
    default: return "";
  }
}

// Trait grouping for the 24 traits
const TRAIT_GROUPS: Record<string, string[]> = {
  "Aptitude": [
    "reasoning", "math", "language", "spatialPerception",
    "formPerception", "clericalPerception", "motorCoordination",
    "fingerDexterity", "manualDexterity", "eyeHandFoot", "colorDiscrimination",
  ],
  "Physical": [
    "strength", "climbBalance", "stoopKneel", "reachHandle",
    "talkHear", "see",
  ],
  "Environmental": [
    "workLocation", "extremeCold", "extremeHeat", "wetnessHumidity",
    "noiseVibration", "hazards", "dustsFumes",
  ],
};

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

// ─── Sub-Components ────────────────────────────────────────────

function STQBreakdown({ details }: { details: Record<string, unknown> | null }) {
  if (!details) return <p className="text-xs text-muted-foreground italic">No STQ detail available</p>;

  const components = (details.components ?? {}) as Record<string, number>;
  const matchedTasks = (details.matchedTasks ?? getNestedVal(details, "matched", "tasks")) as string[] | undefined;
  const matchedDwas = (details.matchedDwas ?? getNestedVal(details, "matched", "dwas")) as string[] | undefined;
  const matchedTools = (details.matchedTools ?? getNestedVal(details, "matched", "tools")) as string[] | undefined;
  const matchedKnowledge = (details.matchedKnowledge ?? getNestedVal(details, "matched", "knowledge")) as string[] | undefined;

  const bars = [
    { label: "Task/DWA", value: components.taskDwaOverlap, key: "taskDwa" },
    { label: "WF/MPSMS", value: components.wfMpsmsOverlap, key: "wfMpsms" },
    { label: "Tools", value: components.toolsOverlap, key: "tools" },
    { label: "Materials", value: components.materialsOverlap, key: "materials" },
    { label: "Credentials", value: components.credentialOverlap, key: "credentials" },
  ];

  return (
    <div className="space-y-3">
      <p className="font-medium text-sm">STQ Component Scores</p>
      <div className="space-y-1.5">
        {bars.map((b) => (
          <div key={b.key} className="flex items-center gap-2">
            <span className="text-xs w-20 text-right text-muted-foreground">{b.label}</span>
            <div className="flex-1 h-4 bg-muted/50 rounded overflow-hidden relative">
              <div
                className="absolute inset-y-0 left-0 bg-blue-500/70 rounded"
                style={{ width: `${Math.min(b.value ?? 0, 100)}%` }}
              />
            </div>
            <span className="text-xs font-mono w-10 text-right">{b.value?.toFixed(1) ?? "\u2014"}</span>
          </div>
        ))}
      </div>

      {(matchedTasks?.length || matchedDwas?.length || matchedTools?.length || matchedKnowledge?.length) && (
        <div className="grid grid-cols-2 gap-3 mt-2">
          {matchedTasks && matchedTasks.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Matched Tasks ({matchedTasks.length})</p>
              <ul className="text-xs text-muted-foreground space-y-0.5 max-h-24 overflow-y-auto">
                {matchedTasks.slice(0, 8).map((t, i) => <li key={i} className="truncate">{t}</li>)}
                {matchedTasks.length > 8 && <li className="italic">+{matchedTasks.length - 8} more</li>}
              </ul>
            </div>
          )}
          {matchedDwas && matchedDwas.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Matched DWAs ({matchedDwas.length})</p>
              <ul className="text-xs text-muted-foreground space-y-0.5 max-h-24 overflow-y-auto">
                {matchedDwas.slice(0, 8).map((d, i) => <li key={i} className="truncate">{d}</li>)}
                {matchedDwas.length > 8 && <li className="italic">+{matchedDwas.length - 8} more</li>}
              </ul>
            </div>
          )}
          {matchedTools && matchedTools.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Matched Tools ({matchedTools.length})</p>
              <ul className="text-xs text-muted-foreground space-y-0.5 max-h-24 overflow-y-auto">
                {matchedTools.slice(0, 6).map((t, i) => <li key={i} className="truncate">{t}</li>)}
                {matchedTools.length > 6 && <li className="italic">+{matchedTools.length - 6} more</li>}
              </ul>
            </div>
          )}
          {matchedKnowledge && matchedKnowledge.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Matched Knowledge ({matchedKnowledge.length})</p>
              <ul className="text-xs text-muted-foreground space-y-0.5 max-h-24 overflow-y-auto">
                {matchedKnowledge.slice(0, 6).map((k, i) => <li key={i} className="truncate">{k}</li>)}
                {matchedKnowledge.length > 6 && <li className="italic">+{matchedKnowledge.length - 6} more</li>}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TFQTraitDetail({ details }: { details: Record<string, unknown> | null }) {
  if (!details) return <p className="text-xs text-muted-foreground italic">No TFQ detail available</p>;

  const traitComparisons = (details.traitComparisons ?? details.traits) as Record<string, { worker: number; demand: number; margin: number; pass: boolean }> | undefined;
  const reserveMargin = details.reserveMargin as number | undefined;
  const traitsPassing = details.traitsPassing as number | undefined;
  const failedTraits = details.failedTraits as string[] | undefined;

  return (
    <div className="space-y-3">
      <p className="font-medium text-sm">TFQ Trait Analysis</p>
      <div className="flex gap-4 text-xs text-muted-foreground mb-2">
        <span>Reserve Margin: <span className="font-semibold text-foreground">{reserveMargin?.toFixed(1) ?? "\u2014"}%</span></span>
        <span>Traits Passing: <span className="font-semibold text-foreground">{traitsPassing ?? "\u2014"}/24</span></span>
        {failedTraits && failedTraits.length > 0 && (
          <span className="text-red-600">Failed: {failedTraits.join(", ")}</span>
        )}
      </div>

      {traitComparisons && (
        <div className="space-y-4">
          {Object.entries(TRAIT_GROUPS).map(([group, traits]) => (
            <div key={group}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{group}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1">
                {traits.map((traitKey) => {
                  const trait = traitComparisons[traitKey];
                  if (!trait) return null;
                  const margin = trait.margin ?? (trait.worker - trait.demand);
                  const pass = trait.pass ?? margin >= 0;
                  return (
                    <div key={traitKey} className="flex items-center gap-1.5 text-xs">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getTraitMarginColor(margin)}`} />
                      <span className="w-24 truncate text-muted-foreground" title={TRAIT_LABELS[traitKey] ?? traitKey}>
                        {TRAIT_LABELS[traitKey] ?? traitKey}
                      </span>
                      <span className="font-mono w-6 text-right">{trait.worker}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="font-mono w-6 text-right">{trait.demand}</span>
                      <span className={`font-mono w-8 text-right font-semibold ${getTraitMarginTextColor(margin)}`}>
                        {margin >= 0 ? `+${margin}` : margin}
                      </span>
                      <span className={`text-[10px] font-semibold ${pass ? "text-green-600" : "text-red-600"}`}>
                        {pass ? "PASS" : "FAIL"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LMQDetail({ details }: { details: Record<string, unknown> | null }) {
  if (!details) return <p className="text-xs text-muted-foreground italic">No LMQ detail available</p>;

  const d = (details.details ?? details) as Record<string, unknown>;
  const scores = (details.scores ?? {}) as Record<string, number>;
  const weights = (details.weights ?? {}) as Record<string, number>;

  return (
    <div className="space-y-2">
      <p className="font-medium text-sm">LMQ Breakdown</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
        <div className="rounded border p-2">
          <p className="text-muted-foreground">Employment Score</p>
          <p className="font-semibold">{(scores.employment as number)?.toFixed(1) ?? "\u2014"}</p>
          <p className="text-[10px] text-muted-foreground">National: {formatNum(d.employment)}</p>
        </div>
        <div className="rounded border p-2">
          <p className="text-muted-foreground">Area Employment Score</p>
          <p className="font-semibold">{(scores.areaEmployment as number)?.toFixed(1) ?? "\u2014"}</p>
          <p className="text-[10px] text-muted-foreground">Area: {formatNum(d.areaEmployment)}</p>
        </div>
        <div className="rounded border p-2">
          <p className="text-muted-foreground">Wage Score</p>
          <p className="font-semibold">{(scores.wage as number)?.toFixed(1) ?? "\u2014"}</p>
          <p className="text-[10px] text-muted-foreground">
            Median: {formatUSD(d.medianWage)}
            {d.wageRatio ? ` (ratio: ${(d.wageRatio as number).toFixed(2)})` : ""}
          </p>
        </div>
        <div className="rounded border p-2">
          <p className="text-muted-foreground">Projections Score</p>
          <p className="font-semibold">{(scores.projections as number)?.toFixed(1) ?? "\u2014"}</p>
          <p className="text-[10px] text-muted-foreground">
            Growth: {(d.changePct as number)?.toFixed(1) ?? "\u2014"}% | Openings: {formatNum(d.openingsAnnual)}
          </p>
        </div>
        <div className="rounded border p-2">
          <p className="text-muted-foreground">JOLTS Trend Score</p>
          <p className="font-semibold">{(scores.joltsTrend as number)?.toFixed(1) ?? "\u2014"}</p>
          <p className="text-[10px] text-muted-foreground">
            {(d.joltsTrendLabel as string) ?? "\u2014"}
          </p>
        </div>
        {Object.keys(weights).length > 0 && (
          <div className="rounded border p-2">
            <p className="text-muted-foreground">Weights Used</p>
            <div className="text-[10px] text-muted-foreground space-y-0.5 mt-1">
              {Object.entries(weights).map(([k, v]) => (
                <p key={k}>{k}: {typeof v === "number" ? v.toFixed(2) : String(v)}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function VAQDetail({ details }: { details: Record<string, unknown> | null }) {
  if (!details) return <p className="text-xs text-muted-foreground italic">No VAQ detail available</p>;

  const adj = (details.adjustment ?? details) as Record<string, number>;
  const items = [
    { label: "Tools", value: adj.tools },
    { label: "Work Processes", value: adj.workProcesses },
    { label: "Work Setting", value: adj.workSetting },
    { label: "Industry", value: adj.industry },
  ];

  return (
    <div className="space-y-2">
      <p className="font-medium text-sm">VAQ Adjustment Detail</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map((item) => (
          <div key={item.label} className="rounded border p-2 text-center">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="text-lg font-bold">{item.value ?? "\u2014"}</p>
            <p className="text-[10px] text-muted-foreground">{getVaqLabel(item.value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function EarningCapacityDetail({ occ }: { occ: TargetOcc }) {
  return (
    <div className="space-y-2">
      <p className="font-medium text-sm">Earning Capacity (VQS)</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="rounded border p-2 text-center">
          <p className="text-muted-foreground">EC Median</p>
          <p className="text-lg font-bold text-green-700">{formatHourly(occ.ecMedian)}/hr</p>
          {occ.ecConfLow !== null && occ.ecConfHigh !== null && (
            <p className="text-[10px] text-muted-foreground">95% CI: [{formatHourly(occ.ecConfLow)}, {formatHourly(occ.ecConfHigh)}]</p>
          )}
        </div>
        <div className="rounded border p-2 text-center">
          <p className="text-muted-foreground">Wage Percentiles</p>
          <div className="text-[10px] text-muted-foreground space-y-0.5 mt-1">
            <p>p10: {formatHourly(occ.ec10)}</p>
            <p>p25: {formatHourly(occ.ec25)}</p>
            <p>p75: {formatHourly(occ.ec75, true)}</p>
            <p>p90: {formatHourly(occ.ec90, true)}</p>
          </div>
        </div>
        <div className="rounded border p-2 text-center">
          <p className="text-muted-foreground">VQ Score & Band</p>
          <p className="text-lg font-bold">{occ.vqScore?.toFixed(0) ?? "\u2014"}</p>
          {occ.vqBand !== null && (
            <Badge className={`${getVQBandColor(occ.vqBand)} text-[10px] mt-1`} variant="outline">
              Band {occ.vqBand} - {getVQBandLabel(occ.vqBand)}
            </Badge>
          )}
        </div>
        <div className="rounded border p-2 text-center">
          <p className="text-muted-foreground">TSP Score & Tier</p>
          <p className="text-lg font-bold">{occ.tspScore?.toFixed(0) ?? "\u2014"}%</p>
          {occ.tspTier !== null && (
            <Badge className={`${getTSPTierColor(occ.tspTier)} text-[10px] mt-1`} variant="outline">
              Tier {occ.tspTier}
            </Badge>
          )}
          {occ.tspLabel && <p className="text-[10px] text-muted-foreground mt-1">{occ.tspLabel}</p>}
        </div>
      </div>
    </div>
  );
}

function TraitMarginSummary({ occ }: { occ: TargetOcc }) {
  if (occ.traitMarginMin === null && occ.traitMarginAvg === null && !occ.closestFailTrait) {
    return null;
  }
  return (
    <div className="space-y-2">
      <p className="font-medium text-sm">Trait Margin Summary</p>
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="rounded border p-2 text-center">
          <p className="text-muted-foreground">Min Margin</p>
          <p className={`text-lg font-bold ${occ.traitMarginMin !== null && occ.traitMarginMin <= 0 ? "text-red-600" : "text-green-600"}`}>
            {occ.traitMarginMin !== null ? (occ.traitMarginMin >= 0 ? `+${occ.traitMarginMin}` : occ.traitMarginMin) : "\u2014"}
          </p>
        </div>
        <div className="rounded border p-2 text-center">
          <p className="text-muted-foreground">Avg Margin</p>
          <p className="text-lg font-bold text-foreground">
            {occ.traitMarginAvg !== null ? occ.traitMarginAvg.toFixed(1) : "\u2014"}
          </p>
        </div>
        <div className="rounded border p-2 text-center">
          <p className="text-muted-foreground">Closest to Fail</p>
          <p className="text-sm font-semibold text-amber-600">
            {occ.closestFailTrait ? (TRAIT_LABELS[occ.closestFailTrait] ?? occ.closestFailTrait) : "\u2014"}
          </p>
        </div>
      </div>
    </div>
  );
}

// Cognitive traits (learnable) vs physical/environmental (non-learnable)
const COGNITIVE_TRAITS = new Set([
  "reasoning", "math", "language", "spatialPerception",
  "formPerception", "clericalPerception",
]);

interface TfqTraitComparison {
  trait: string;
  label: string;
  workerCapacity: number | null;
  occupationDemand: number | null;
  margin: number | null;
  passes: boolean;
  source: string;
}

interface TfqDetailsData {
  tfq?: number;
  passes?: boolean;
  failedTraits?: TfqTraitComparison[];
  traitComparisons?: TfqTraitComparison[];
  reserveMargin?: number;
}

function ExcludedOccDetail({ occ }: { occ: TargetOcc }) {
  const nmd = occ.nearMissDetails as Record<string, unknown> | null;
  const failedTraits = (nmd?.failedTraits ?? []) as { trait: string; deficit: number; group?: string; learnable?: boolean }[];
  const retrainingNotes = nmd?.retrainingNotes as string | undefined;
  const svpGap = nmd?.svpGap as number | undefined;
  const estimatedRetrainingTime = nmd?.estimatedRetrainingTime as string | undefined;

  // Parse tfqDetails for raw trait comparison data
  const tfqData = occ.tfqDetails as TfqDetailsData | null;
  const tfqFailedTraits = tfqData?.failedTraits ?? [];

  return (
    <div className="p-4 bg-muted/30 rounded-md space-y-4">
      {/* Exclusion Reason */}
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-red-100 p-2 flex-shrink-0">
          <AlertTriangle className="h-4 w-4 text-red-600" />
        </div>
        <div>
          <p className="font-medium text-sm">Exclusion Reason</p>
          <p className="text-sm text-red-600">{occ.exclusionReason ?? "Excluded"}</p>
        </div>
      </div>

      {/* Near-Miss Badge */}
      {occ.nearMissSeverity && (occ.nearMissSeverity === "marginal" || occ.nearMissSeverity === "moderate") && (
        <Badge className={`${getNearMissBadgeColor(occ.nearMissSeverity)} text-sm px-3 py-1`} variant="outline">
          {getNearMissBadgeLabel(occ.nearMissSeverity)}
        </Badge>
      )}

      {/* TFQ Trait Failure Drill-Down (raw trait comparison data) */}
      {tfqFailedTraits.length > 0 && (
        <div>
          <p className="font-medium text-sm mb-2">Trait Failure Details (Worker Capacity vs Occupation Demand)</p>
          <div className="rounded border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-red-50 dark:bg-red-950/30">
                  <th className="text-left px-3 py-1.5 font-medium">Trait</th>
                  <th className="text-right px-3 py-1.5 font-medium">Worker</th>
                  <th className="text-right px-3 py-1.5 font-medium">Demand</th>
                  <th className="text-right px-3 py-1.5 font-medium">Margin</th>
                  <th className="text-center px-3 py-1.5 font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {tfqFailedTraits.map((ft, i) => {
                  const margin = ft.margin != null ? ft.margin : (ft.workerCapacity != null && ft.occupationDemand != null ? ft.workerCapacity - ft.occupationDemand : null);
                  const isLearnable = COGNITIVE_TRAITS.has(ft.trait);
                  return (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-1.5 font-medium">{ft.label || TRAIT_LABELS[ft.trait] || ft.trait}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{ft.workerCapacity ?? "\u2014"}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{ft.occupationDemand ?? "\u2014"}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-semibold text-red-600">
                        {margin != null ? (margin >= 0 ? `+${margin}` : String(margin)) : "\u2014"}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1 ${isLearnable ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-orange-50 text-orange-700 border-orange-200"}`}
                        >
                          {isLearnable ? "Cognitive (Learnable)" : "Physical/Env"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legacy failed traits from near-miss data (fallback when tfqDetails unavailable) */}
      {failedTraits.length > 0 && tfqFailedTraits.length === 0 && (
        <div>
          <p className="font-medium text-sm mb-2">Failed Traits</p>
          <div className="space-y-1.5">
            {failedTraits.map((ft, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                <span className="font-medium w-28">{TRAIT_LABELS[ft.trait] ?? ft.trait}</span>
                <span className="font-mono text-red-600">deficit: {ft.deficit}</span>
                {ft.group && <Badge variant="outline" className="text-[10px] px-1">{ft.group}</Badge>}
                {ft.learnable && <Badge className="bg-blue-100 text-blue-700 text-[10px] px-1" variant="outline">Learnable</Badge>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Retrainability Notes */}
      {retrainingNotes && (
        <div>
          <p className="font-medium text-sm mb-1">Retrainability Notes</p>
          <p className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 rounded p-2">{retrainingNotes}</p>
        </div>
      )}

      {/* SVP Gap */}
      {svpGap !== undefined && svpGap > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium">SVP Gap:</span>
          <span className="font-mono">{svpGap} levels</span>
          {estimatedRetrainingTime && (
            <span className="text-muted-foreground">| Est. retraining: {estimatedRetrainingTime}</span>
          )}
        </div>
      )}

      {/* Scores if available */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
        <div className="rounded border p-2 text-center">
          <p className="text-muted-foreground">STQ</p>
          <p className="font-mono font-semibold">{occ.stq?.toFixed(1) ?? "\u2014"}</p>
        </div>
        <div className="rounded border p-2 text-center">
          <p className="text-muted-foreground">TFQ</p>
          <p className="font-mono font-semibold text-red-600">{occ.tfq?.toFixed(1) ?? "\u2014"}</p>
        </div>
        <div className="rounded border p-2 text-center">
          <p className="text-muted-foreground">VAQ</p>
          <p className="font-mono font-semibold">{occ.vaq?.toFixed(1) ?? "\u2014"}</p>
        </div>
        <div className="rounded border p-2 text-center">
          <p className="text-muted-foreground">LMQ</p>
          <p className="font-mono font-semibold">{occ.lmq?.toFixed(1) ?? "\u2014"}</p>
        </div>
        <div className="rounded border p-2 text-center">
          <p className="text-muted-foreground">PVQ</p>
          <p className="font-mono font-semibold">{occ.pvq?.toFixed(1) ?? "\u2014"}</p>
        </div>
      </div>

      <Separator />
      <div className="flex gap-2">
        <Link href={`/occupations/${occ.onetSocCode}`}>
          <Button variant="outline" size="sm">
            <ExternalLink className="mr-1 h-3 w-3" />
            View Occupation Details
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ─── Main Page Component ───────────────────────────────────────

export default function ResultsPage() {
  const params = useParams();
  const caseId = params.id as string;
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [selected, setSelected] = useState<AnalysisResult | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [expandedExcRow, setExpandedExcRow] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [narrative, setNarrative] = useState("");
  const [generatingNarrative, setGeneratingNarrative] = useState(false);
  const [profileUpdatedAfterAnalysis, setProfileUpdatedAfterAnalysis] = useState(false);

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

  useEffect(() => {
    async function checkStaleness() {
      if (!selected) return;
      try {
        const profileRes = await fetch(`/api/cases/${caseId}/profiles`);
        const profiles = await profileRes.json();
        const postProfile = Array.isArray(profiles)
          ? profiles.find((p: { profileType: string; updatedAt?: string }) => p.profileType === "POST")
          : null;
        if (postProfile?.updatedAt && selected) {
          const profileTime = new Date(postProfile.updatedAt).getTime();
          const analysisTime = selected.updatedAt ? new Date(selected.updatedAt).getTime() : 0;
          setProfileUpdatedAfterAnalysis(profileTime > analysisTime);
        }
      } catch {
        // Non-critical check
      }
    }
    checkStaleness();
  }, [caseId, selected]);

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
      const viableOccs = (selected.targetOccupations ?? [])
        .filter((t) => !t.excluded)
        .sort((a, b) => (b.pvq ?? 0) - (a.pvq ?? 0));
      const excludedOccs = (selected.targetOccupations ?? []).filter((t) => t.excluded);

      const topOccupations = viableOccs.slice(0, 5).map((t) => {
        const d = (t.lmqDetails as Record<string, unknown>)?.details as Record<string, unknown> | undefined;
        return {
          title: t.title,
          pvq: t.pvq ?? 0,
          medianWage: (d?.medianWage as number) ?? null,
          grade: t.confidenceGrade ?? "\u2014",
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
        toast.error("AI not available \u2014 OpenAI key not configured");
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

  const viable = (selected.targetOccupations ?? [])
    .filter((t) => !t.excluded)
    .sort((a, b) => (b.pvq ?? 0) - (a.pvq ?? 0));
  const excluded = (selected.targetOccupations ?? []).filter((t) => t.excluded);

  // Parse analysis-level JSON fields
  const rfcNarrative = selected.rfcNarrative as RfcNarrative | null;
  const nearMissAnalysis = selected.nearMissAnalysis as NearMissAnalysis | null;
  const viableSetAnalysis = selected.viableSetAnalysis as ViableSetAnalysis | null;
  const confidenceExplanation = selected.confidenceExplanation as ConfidenceExplanation | null;
  const regionalLaborMarket = selected.regionalLaborMarket as RegionalLaborMarket | null;

  return (
    <div>
      <WizardNav caseId={caseId} currentStep={6} />
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <CaseBreadcrumb caseId={caseId} currentPage="Results" />

      {profileUpdatedAfterAnalysis && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800 dark:text-amber-200">
              Profile Updated Since Last Analysis
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              The worker profile has been modified since this analysis was last run. Results may not reflect current values. Go to the Analysis page and re-run to update.
            </p>
          </div>
        </div>
      )}

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
              onClick={() => { setSelected(a); setExpandedRow(null); setExpandedExcRow(null); }}
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
            <div className="text-2xl font-bold">{(selected.targetOccupations ?? []).length}</div>
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
            {(() => {
              if (viable.length === 0) return <div className="text-2xl font-bold">{"\u2014"}</div>;
              const topOcc = viable.reduce((best, t) => (t.pvq ?? 0) > (best.pvq ?? 0) ? t : best, viable[0]);
              return (
                <div className="flex items-center gap-1">
                  <span className="text-2xl font-bold">{(topOcc.pvq ?? 0).toFixed(1)}</span>
                  <ScoreTooltip breakdown={buildPVQBreakdown(topOcc.pvq, topOcc.stq, topOcc.tfq, topOcc.vaq, topOcc.lmq, topOcc.confidenceGrade)} />
                </div>
              );
            })()}
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

      {/* ═══════════════════════════════════════════════════════════
          SECTION 0: Zero Viable Explanation (when all occupations excluded)
          ═══════════════════════════════════════════════════════════ */}
      {selected.zeroViableExplanation && viable.length === 0 && (() => {
        const zve = selected.zeroViableExplanation;
        return (
          <Card className="border-red-300 bg-red-50/30 dark:border-red-800 dark:bg-red-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                No Viable Occupations Identified
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {zve.totalCandidatesEvaluated} candidate occupations were evaluated — all were excluded.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary */}
              <div className="rounded-md border border-red-200 dark:border-red-800 bg-white dark:bg-background p-4">
                <p className="text-sm">{zve.summary}</p>
              </div>

              {/* Vocational Implication */}
              {zve.vocationalImplication && (
                <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">Vocational Implication</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">{zve.vocationalImplication}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Primary Exclusion Factors */}
                {zve.primaryExclusionFactors.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Primary Exclusion Factors</p>
                    <div className="space-y-1">
                      {zve.primaryExclusionFactors.map((f, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span>{f.trait}</span>
                          <span className="text-muted-foreground">
                            {f.count} occupation{f.count !== 1 ? "s" : ""} ({f.pctOfExcluded}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Worker Limitations */}
                {zve.workerLimitations.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Post-Injury Limitations</p>
                    <div className="space-y-1">
                      {zve.workerLimitations.map((l, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                          <span>{l}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Strength Analysis */}
              {zve.strengthAnalysis.exclusionsDueToStrength > 0 && (
                <div>
                  <p className="text-sm font-medium mb-1">
                    Strength: Worker restricted to {zve.strengthAnalysis.workerLevel} — {zve.strengthAnalysis.exclusionsDueToStrength} occupation{zve.strengthAnalysis.exclusionsDueToStrength !== 1 ? "s" : ""} exceeded this level
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════════
          SECTION 1: RFC Narrative Card (NEW)
          ═══════════════════════════════════════════════════════════ */}
      {rfcNarrative && (
        <Card className="border-purple-200 bg-purple-50/30 dark:border-purple-800 dark:bg-purple-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-purple-600" />
              Residual Functional Capacity (RFC)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Functional Level Badge */}
            {rfcNarrative.functionalLevel && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-muted-foreground">Functional Level:</span>
                <Badge className={`${getFunctionalLevelColor(rfcNarrative.functionalLevel)} text-sm px-3 py-1`} variant="outline">
                  {rfcNarrative.functionalLevel.replace(/_/g, " ").toUpperCase()}
                </Badge>
                {rfcNarrative.functionalLevelLabel && (
                  <span className="text-sm text-muted-foreground">{rfcNarrative.functionalLevelLabel}</span>
                )}
              </div>
            )}

            {/* Summaries */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {rfcNarrative.physicalSummary && (
                <div className="rounded-lg border p-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Physical Summary</p>
                  <p className="text-sm">{rfcNarrative.physicalSummary}</p>
                </div>
              )}
              {rfcNarrative.cognitiveSummary && (
                <div className="rounded-lg border p-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cognitive Summary</p>
                  <p className="text-sm">{rfcNarrative.cognitiveSummary}</p>
                </div>
              )}
              {rfcNarrative.environmentalSummary && (
                <div className="rounded-lg border p-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Environmental Summary</p>
                  <p className="text-sm">{rfcNarrative.environmentalSummary}</p>
                </div>
              )}
            </div>

            {/* Work Types */}
            {(rfcNarrative.suitableWorkTypes?.length || rfcNarrative.unsuitableWorkTypes?.length) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rfcNarrative.suitableWorkTypes && rfcNarrative.suitableWorkTypes.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Suitable Work Types</p>
                    <div className="flex flex-wrap gap-1.5">
                      {rfcNarrative.suitableWorkTypes.map((wt, i) => (
                        <Badge key={i} className="bg-green-100 text-green-800 border-green-300" variant="outline">{wt}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {rfcNarrative.unsuitableWorkTypes && rfcNarrative.unsuitableWorkTypes.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Unsuitable Work Types</p>
                    <div className="flex flex-wrap gap-1.5">
                      {rfcNarrative.unsuitableWorkTypes.map((wt, i) => (
                        <Badge key={i} className="bg-red-100 text-red-800 border-red-300" variant="outline">{wt}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Strengths */}
            {rfcNarrative.strengths && rfcNarrative.strengths.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Strengths</p>
                <div className="flex flex-wrap gap-1.5">
                  {rfcNarrative.strengths.map((s, i) => (
                    <Badge key={i} className="bg-green-50 text-green-700 border-green-200" variant="outline" title={s.description}>
                      {s.label} (L{s.level})
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Limitations */}
            {rfcNarrative.limitations && rfcNarrative.limitations.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Limitations</p>
                {typeof rfcNarrative.limitations[0] === "string" ? (
                  <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                    {(rfcNarrative.limitations as string[]).map((lim, i) => (
                      <li key={i}>{lim}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="space-y-1.5">
                    {(rfcNarrative.limitations as { trait: string; label: string; level: number; description: string; impactOnWork: string }[]).map((lim, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <Badge className="bg-red-50 text-red-700 border-red-200 flex-shrink-0" variant="outline">
                          {lim.label} (L{lim.level})
                        </Badge>
                        <span className="text-muted-foreground text-xs">{lim.impactOnWork}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Moderate Capabilities */}
            {rfcNarrative.moderateCapabilities && rfcNarrative.moderateCapabilities.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Moderate Capabilities</p>
                <div className="flex flex-wrap gap-1.5">
                  {rfcNarrative.moderateCapabilities.map((mc, i) => (
                    <Badge key={i} className="bg-yellow-50 text-yellow-700 border-yellow-200" variant="outline">{mc}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Full Narrative */}
            {rfcNarrative.fullNarrative && (
              <div className="rounded-lg border bg-white dark:bg-muted/20 p-4 space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen className="h-4 w-4 text-purple-500" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Full RFC Narrative</p>
                </div>
                <div className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                  {rfcNarrative.fullNarrative}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
                        ? selected.preInjuryTotalEmployment.toLocaleString()
                        : "\u2014"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Post-Injury</p>
                    <p className="text-lg font-bold text-amber-600">
                      {selected.postInjuryTotalEmployment !== null
                        ? (selected.postInjuryTotalEmployment ?? 0).toLocaleString()
                        : "\u2014"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Lost</p>
                    <p className="text-lg font-bold text-red-600">
                      {selected.preInjuryTotalEmployment !== null && selected.postInjuryTotalEmployment !== null
                        ? (selected.preInjuryTotalEmployment - (selected.postInjuryTotalEmployment ?? 0)).toLocaleString()
                        : "\u2014"}
                    </p>
                  </div>
                </div>
              </div>

              {/* JOLTS Openings */}
              <div className="rounded-lg border p-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">JOLTS Openings</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Pre-Injury</p>
                    <p className="text-lg font-bold text-blue-600">
                      {selected.preInjuryJoltsOpenings !== null
                        ? Math.round(selected.preInjuryJoltsOpenings * 1000).toLocaleString()
                        : "\u2014"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Current</p>
                    <p className="text-lg font-bold text-amber-600">
                      {selected.postInjuryJoltsOpenings !== null
                        ? Math.round((selected.postInjuryJoltsOpenings ?? 0) * 1000).toLocaleString()
                        : "\u2014"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Change</p>
                    <p className="text-lg font-bold text-red-600">
                      {selected.preInjuryJoltsOpenings !== null && selected.postInjuryJoltsOpenings !== null
                        ? Math.round(((selected.postInjuryJoltsOpenings ?? 0) - selected.preInjuryJoltsOpenings) * 1000).toLocaleString()
                        : "\u2014"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comprehensive Labor Market Access (All 831 OEWS Occupations) */}
      {selected.laborMarketAccess && (() => {
        const lma = selected.laborMarketAccess;
        const strengthLabels = ["sedentary", "light", "medium", "heavy", "veryHeavy"] as const;
        const strengthDisplayLabels: Record<string, string> = {
          sedentary: "Sedentary", light: "Light", medium: "Medium", heavy: "Heavy", veryHeavy: "Very Heavy",
        };
        return (
          <Card className="border-indigo-200 bg-indigo-50/30 dark:border-indigo-800 dark:bg-indigo-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-indigo-600" />
                Comprehensive Labor Market Access
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Analysis of ALL {lma.totalOccupationsAnalyzed.toLocaleString()} OEWS occupations with employment data (SVP-gated).
                This compares the worker&apos;s pre- and post-injury access to the entire labor market.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-lg border p-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Accessible Occupations</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Pre-Injury</p>
                      <p className="text-2xl font-bold text-blue-600">{lma.preInjuryAccessible.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Post-Injury</p>
                      <p className="text-2xl font-bold text-amber-600">{lma.postInjuryAccessible.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Lost</p>
                      <p className="text-2xl font-bold text-red-600">{lma.occupationsLost.toLocaleString()}</p>
                      {lma.occupationsLostPct > 0 && (
                        <p className="text-xs text-red-500">({lma.occupationsLostPct.toFixed(1)}%)</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border p-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">National Employment</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Pre-Injury</p>
                      <p className="text-lg font-bold text-blue-600">{lma.preInjuryEmployment.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Post-Injury</p>
                      <p className="text-lg font-bold text-amber-600">{lma.postInjuryEmployment.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Lost</p>
                      <p className="text-lg font-bold text-red-600">{lma.employmentLost.toLocaleString()}</p>
                      {lma.employmentLostPct > 0 && (
                        <p className="text-xs text-red-500">({lma.employmentLostPct.toFixed(1)}%)</p>
                      )}
                    </div>
                  </div>
                </div>

                {lma.preInjuryAreaEmployment > 0 && (
                  <div className="rounded-lg border p-4 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Area Employment</p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground">Pre-Injury</p>
                        <p className="text-lg font-bold text-blue-600">{lma.preInjuryAreaEmployment.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Post-Injury</p>
                        <p className="text-lg font-bold text-amber-600">{lma.postInjuryAreaEmployment.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Lost</p>
                        <p className="text-lg font-bold text-red-600">{lma.areaEmploymentLost.toLocaleString()}</p>
                        {lma.areaEmploymentLostPct > 0 && (
                          <p className="text-xs text-red-500">({lma.areaEmploymentLostPct.toFixed(1)}%)</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Strength Level Breakdown */}
              <div>
                <p className="text-sm font-semibold mb-3">Access by Strength Level</p>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Strength</TableHead>
                        <TableHead className="text-center">Pre-Injury</TableHead>
                        <TableHead className="text-center">Post-Injury</TableHead>
                        <TableHead className="text-center">Lost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {strengthLabels.map((sl) => {
                        const pre = lma.preByStrength[sl];
                        const post = lma.postByStrength[sl];
                        const lost = pre - post;
                        return (
                          <TableRow key={sl}>
                            <TableCell className="font-medium">{strengthDisplayLabels[sl]}</TableCell>
                            <TableCell className="text-center text-blue-600 font-mono">{pre}</TableCell>
                            <TableCell className="text-center text-amber-600 font-mono">{post}</TableCell>
                            <TableCell className={`text-center font-mono ${lost > 0 ? "text-red-600" : "text-green-600"}`}>
                              {lost > 0 ? `-${lost}` : lost === 0 ? "0" : `+${Math.abs(lost)}`}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Most Common Failing Traits */}
              {lma.mostCommonFailingTraits.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-3">Traits Most Commonly Blocking Access</p>
                  <div className="flex flex-wrap gap-2">
                    {lma.mostCommonFailingTraits.map((ft) => (
                      <Badge key={ft.trait} variant="outline" className="text-xs">
                        {ft.trait}: {ft.count} occupations
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Visual bar showing reduction */}
              <div>
                <p className="text-sm font-semibold mb-2">Labor Market Reduction</p>
                <div className="relative h-8 w-full rounded-full bg-blue-100 dark:bg-blue-900/30 overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-blue-500 rounded-full transition-all"
                    style={{ width: "100%" }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 bg-amber-500 rounded-full transition-all"
                    style={{
                      width: lma.preInjuryAccessible > 0
                        ? `${(lma.postInjuryAccessible / lma.preInjuryAccessible) * 100}%`
                        : "0%",
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white drop-shadow">
                    {lma.postInjuryAccessible} / {lma.preInjuryAccessible} occupations retained
                    ({lma.preInjuryAccessible > 0
                      ? ((lma.postInjuryAccessible / lma.preInjuryAccessible) * 100).toFixed(1)
                      : "0"}%)
                  </div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-full bg-blue-500" /> Pre-injury access
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-full bg-amber-500" /> Post-injury access
                  </span>
                </div>
              </div>

              {/* Top Lost Occupations */}
              {lma.lostOccupations.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-3">Top Lost Occupations (by employment)</p>
                  <div className="overflow-x-auto max-h-64 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SOC</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead className="text-right">Employment</TableHead>
                          <TableHead>Strength</TableHead>
                          <TableHead>Failed Traits</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lma.lostOccupations.slice(0, 20).map((occ) => (
                          <TableRow key={occ.code}>
                            <TableCell className="font-mono text-xs">{occ.code}</TableCell>
                            <TableCell className="text-sm">{occ.title}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{occ.employment.toLocaleString()}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{occ.strength}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-red-600">
                              {occ.failedTraits?.join(", ") ?? ""}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {lma.lostOccupations.length > 20 && (
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        Showing top 20 of {lma.lostOccupations.length} lost occupations
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* VQS Earning Capacity Summary */}
      {(selected.vqsPostEcMedian !== null || selected.vqsPreEcMedian !== null) && (
        <Card className="border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              VQS Earning Capacity Analysis
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Vocational Quotient-based earning capacity estimates with OEWS wage data and ECLR geographic adjustments.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {selected.vqsPreEcMedian !== null && (
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pre-Injury EC</p>
                  <p className="text-2xl font-bold text-blue-600">{formatHourly(selected.vqsPreEcMedian)}/hr</p>
                  <p className="text-xs text-muted-foreground">${((selected.vqsPreEcMedian ?? 0) * 2080).toLocaleString("en-US", { maximumFractionDigits: 0 })}/yr</p>
                </div>
              )}
              <div className="rounded-lg border p-4 text-center">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Post-Injury EC</p>
                <p className="text-2xl font-bold text-amber-600">{formatHourly(selected.vqsPostEcMedian)}/hr</p>
                <p className="text-xs text-muted-foreground">${((selected.vqsPostEcMedian ?? 0) * 2080).toLocaleString("en-US", { maximumFractionDigits: 0 })}/yr</p>
              </div>
              {selected.vqsEcLoss !== null && (
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">EC Loss</p>
                  <p className={`text-2xl font-bold ${(selected.vqsEcLoss ?? 0) > 0 ? "text-red-600" : "text-green-600"}`}>
                    {(selected.vqsEcLoss ?? 0) > 0 ? "-" : "+"}{formatHourly(Math.abs(selected.vqsEcLoss ?? 0))}/hr
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ${(Math.abs((selected.vqsEcLoss ?? 0)) * 2080).toLocaleString("en-US", { maximumFractionDigits: 0 })}/yr
                  </p>
                </div>
              )}
              {selected.vqsEcLossPct !== null && (
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Loss %</p>
                  <p className={`text-2xl font-bold ${(selected.vqsEcLossPct ?? 0) > 0 ? "text-red-600" : "text-green-600"}`}>
                    {selected.vqsEcLossPct.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Earning capacity reduction</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════
          Viable Occupations Table (with ENHANCED expandable rows)
          ═══════════════════════════════════════════════════════════ */}
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
                    <TableCell className="hidden md:table-cell text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <ScoreCell value={t.stq} />
                        <ScoreTooltip breakdown={buildSTQBreakdown(t.stq, t.stqDetails)} />
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <ScoreCell value={t.tfq} />
                        <ScoreTooltip breakdown={buildTFQBreakdown(t.tfq, t.tfqDetails)} />
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <ScoreCell value={t.vaq} />
                        <ScoreTooltip breakdown={buildVAQBreakdown(t.vaq, t.vaqDetails)} />
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <ScoreCell value={t.lmq} />
                        <ScoreTooltip breakdown={buildLMQBreakdown(t.lmq, t.lmqDetails)} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <ScoreCell value={t.pvq} />
                        <ScoreTooltip breakdown={buildPVQBreakdown(t.pvq, t.stq, t.tfq, t.vaq, t.lmq, t.confidenceGrade)} />
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right">
                      {t.vqScore !== null ? (
                        <div className="flex items-center justify-end gap-0.5">
                          <span className="font-mono text-sm">{t.vqScore.toFixed(0)}</span>
                          <Badge className={`${getVQBandColor(t.vqBand)} text-[10px] px-1`} variant="outline">
                            B{t.vqBand}
                          </Badge>
                          <ScoreTooltip breakdown={buildVQBreakdown(t.vqScore, t.vqBand, t.vqDetails)} />
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
                        <div className="flex items-center justify-end gap-0.5">
                          <span className="font-mono text-sm font-semibold text-green-700">{formatHourly(t.ecMedian)}</span>
                          <ScoreTooltip breakdown={buildECBreakdown(t)} />
                        </div>
                      ) : "\u2014"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={getGradeColor(t.confidenceGrade)} variant="outline">
                        {t.confidenceGrade ?? "\u2014"}
                      </Badge>
                    </TableCell>
                  </TableRow>

                  {/* ──── Enhanced Expandable Row Detail ──── */}
                  {expandedRow === t.id && (
                    <TableRow>
                      <TableCell colSpan={14}>
                        <div className="p-4 bg-muted/30 rounded-md space-y-6">

                          {/* STQ Breakdown */}
                          <STQBreakdown details={t.stqDetails} />

                          <Separator />

                          {/* TFQ Trait Detail */}
                          <TFQTraitDetail details={t.tfqDetails} />

                          <Separator />

                          {/* Trait Margin Summary */}
                          <TraitMarginSummary occ={t} />

                          {(t.traitMarginMin !== null || t.traitMarginAvg !== null) && <Separator />}

                          {/* VAQ Detail */}
                          <VAQDetail details={t.vaqDetails} />

                          <Separator />

                          {/* LMQ Detail */}
                          <LMQDetail details={t.lmqDetails} />

                          <Separator />

                          {/* Earning Capacity (VQS) */}
                          {t.ecMedian !== null && (
                            <>
                              <EarningCapacityDetail occ={t} />
                              <Separator />
                            </>
                          )}

                          {/* Industry & Pre-Injury */}
                          <div>
                            <p className="font-medium text-sm mb-2">Industry & Pre-Injury</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                              {t.joltsIndustryName && (
                                <div className="rounded border p-2">
                                  <p className="text-muted-foreground">Industry</p>
                                  <p className="font-semibold">{t.joltsIndustryName}</p>
                                </div>
                              )}
                              {t.joltsCurrentOpenings !== null && (
                                <div className="rounded border p-2">
                                  <p className="text-muted-foreground">JOLTS Current</p>
                                  <p className="font-semibold">{Math.round(t.joltsCurrentOpenings * 1000).toLocaleString()}</p>
                                </div>
                              )}
                              {t.joltsPreInjuryOpenings !== null && (
                                <div className="rounded border p-2">
                                  <p className="text-muted-foreground">JOLTS At DOI</p>
                                  <p className="font-semibold">{Math.round(t.joltsPreInjuryOpenings * 1000).toLocaleString()}</p>
                                </div>
                              )}
                              {t.joltsTrendLabel && (
                                <div className="rounded border p-2">
                                  <p className="text-muted-foreground">JOLTS Trend</p>
                                  <p className="font-semibold">{t.joltsTrendLabel.replace(/_/g, " ")}</p>
                                  {t.joltsTrend !== null && <p className="text-[10px] text-muted-foreground">Score: {t.joltsTrend.toFixed(2)}</p>}
                                </div>
                              )}
                              <div className="rounded border p-2">
                                <p className="text-muted-foreground">Pre-Injury TFQ</p>
                                {t.preTfqPasses !== null ? (
                                  <p className={`font-semibold ${t.preTfqPasses ? "text-green-600" : "text-red-600"}`}>
                                    {t.preTfqPasses ? "PASS" : "FAIL"}
                                    {t.preTfq !== null && ` (${t.preTfq.toFixed(1)})`}
                                  </p>
                                ) : (
                                  <p className="italic text-muted-foreground">No pre-injury profile</p>
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
                        {pct75 !== null ? formatUSD(pct75) : "N/A (BLS suppressed)"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-right text-sm text-muted-foreground">
                        {pct90 !== null ? formatUSD(pct90) : "N/A (BLS suppressed)"}
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

      {/* ═══════════════════════════════════════════════════════════
          Excluded Occupations (ENHANCED with expandable rows)
          ═══════════════════════════════════════════════════════════ */}
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
                  <TableHead className="w-8" />
                  <TableHead>O*NET</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>SVP</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-center">Near-Miss</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {excluded.map((t) => (
                  <Fragment key={t.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50 opacity-80 hover:opacity-100"
                      onClick={() => setExpandedExcRow(expandedExcRow === t.id ? null : t.id)}
                    >
                      <TableCell>
                        {expandedExcRow === t.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{t.onetSocCode}</TableCell>
                      <TableCell>{t.title}</TableCell>
                      <TableCell>{t.svp ?? "\u2014"}</TableCell>
                      <TableCell className="text-sm text-red-600">
                        {t.exclusionReason ?? "Excluded"}
                      </TableCell>
                      <TableCell className="text-center">
                        {t.nearMissSeverity && (t.nearMissSeverity === "marginal" || t.nearMissSeverity === "moderate") ? (
                          <Badge className={`${getNearMissBadgeColor(t.nearMissSeverity)} text-[10px]`} variant="outline">
                            {t.nearMissSeverity === "marginal" ? "Marginal" : "Moderate"}
                          </Badge>
                        ) : t.nearMissSeverity === "significant" ? (
                          <Badge className="bg-red-100 text-red-800 text-[10px]" variant="outline">Significant</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">{"\u2014"}</span>
                        )}
                      </TableCell>
                    </TableRow>
                    {expandedExcRow === t.id && (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <ExcludedOccDetail occ={t} />
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
      )}

      {/* ═══════════════════════════════════════════════════════════
          SECTION 3: Near-Miss & Retrainability Analysis (NEW)
          ═══════════════════════════════════════════════════════════ */}
      {nearMissAnalysis && (
        <Card className="border-amber-200 bg-amber-50/30 dark:border-amber-800 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-amber-600" />
              Near-Miss & Retrainability Analysis
            </CardTitle>
            {nearMissAnalysis.totalExcluded !== undefined && (
              <p className="text-sm text-muted-foreground">
                {nearMissAnalysis.totalExcluded} excluded occupation{nearMissAnalysis.totalExcluded !== 1 ? "s" : ""} analyzed
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Counts */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Marginal</p>
                <p className="text-2xl font-bold text-amber-600">{nearMissAnalysis.marginalCount ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">1 trait, small gap</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Moderate</p>
                <p className="text-2xl font-bold text-orange-600">{nearMissAnalysis.moderateCount ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">1-2 traits, moderate gap</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Significant</p>
                <p className="text-2xl font-bold text-red-600">{nearMissAnalysis.significantCount ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">3+ traits or large gap</p>
              </div>
            </div>

            {/* Common Failing Traits (new engine shape) */}
            {nearMissAnalysis.commonFailingTraits && nearMissAnalysis.commonFailingTraits.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Most Common Failing Traits</p>
                <div className="flex flex-wrap gap-2">
                  {nearMissAnalysis.commonFailingTraits.map((ft, i) => (
                    <Badge key={i} variant="outline" className="bg-red-50 text-red-700 border-red-200">
                      {ft.label ?? TRAIT_LABELS[ft.trait] ?? ft.trait} ({ft.count})
                      {ft.group && <span className="ml-1 text-[10px] opacity-70">[{ft.group}]</span>}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Legacy: Most Common Failing Traits */}
            {!nearMissAnalysis.commonFailingTraits && nearMissAnalysis.mostCommonFailingTraits && nearMissAnalysis.mostCommonFailingTraits.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Most Common Failing Traits</p>
                <div className="flex flex-wrap gap-2">
                  {nearMissAnalysis.mostCommonFailingTraits.map((ft, i) => (
                    <Badge key={i} variant="outline" className="bg-red-50 text-red-700 border-red-200">
                      {TRAIT_LABELS[ft.trait] ?? ft.trait} ({ft.count})
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Limiting Traits */}
            {nearMissAnalysis.limitingTraits && nearMissAnalysis.limitingTraits.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Top Limiting Traits</p>
                <div className="flex flex-wrap gap-2">
                  {nearMissAnalysis.limitingTraits.map((lt, i) => (
                    <Badge key={i} variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                      {TRAIT_LABELS[lt] ?? lt}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Near-Miss Occupations List (new engine shape) */}
            {nearMissAnalysis.nearMisses && nearMissAnalysis.nearMisses.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Near-Miss Occupations ({nearMissAnalysis.nearMisses.length})</p>
                <div className="space-y-2">
                  {nearMissAnalysis.nearMisses.map((nmo, i) => (
                    <div key={i} className="rounded border p-3 text-sm space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{nmo.occupationTitle}</span>
                        {nmo.onetCode && <span className="text-xs font-mono text-muted-foreground">{nmo.onetCode}</span>}
                        {nmo.dotCode && <span className="text-xs font-mono text-muted-foreground">DOT: {nmo.dotCode}</span>}
                        <Badge className={`${getNearMissBadgeColor(nmo.severity)} text-[10px]`} variant="outline">
                          {nmo.severity}
                        </Badge>
                        {nmo.retrainable && (
                          <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]" variant="outline">
                            Retrainable
                          </Badge>
                        )}
                      </div>

                      {/* Deficit metrics */}
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>Failed traits: <span className="font-semibold text-red-600">{nmo.failedTraitCount}</span></span>
                        <span>Total deficit: <span className="font-semibold text-red-600">{nmo.totalDeficit}</span></span>
                        <span>Max single: <span className="font-semibold text-red-600">{nmo.maxSingleDeficit}</span></span>
                      </div>

                      {/* Failed trait details */}
                      {nmo.failedTraits && nmo.failedTraits.length > 0 && (
                        <div className="space-y-1">
                          {nmo.failedTraits.map((ft, j) => (
                            <div key={j} className="flex items-center gap-2 text-xs">
                              <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                              <span className="font-medium w-28">{ft.label ?? TRAIT_LABELS[ft.trait] ?? ft.trait}</span>
                              <span className="font-mono">W:{ft.workerCapacity} / D:{ft.occupationDemand}</span>
                              <span className="font-mono text-red-600">deficit: {ft.deficit}</span>
                              <Badge variant="outline" className="text-[10px] px-1">{ft.traitGroup}</Badge>
                              {ft.isLearnable && <Badge className="bg-blue-100 text-blue-700 text-[10px] px-1" variant="outline">Learnable</Badge>}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Retraining notes */}
                      {nmo.retrainingNotes && nmo.retrainingNotes.length > 0 && (
                        <div className="bg-blue-50 dark:bg-blue-950/30 rounded p-2 text-xs text-muted-foreground space-y-0.5">
                          {nmo.retrainingNotes.map((note, j) => (
                            <p key={j}>{note}</p>
                          ))}
                        </div>
                      )}

                      {/* SVP gap */}
                      {nmo.svpGap !== null && nmo.svpGap > 0 && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-medium">SVP Gap:</span>
                          <span className="font-mono">{nmo.svpGap} levels</span>
                          {nmo.svpRetrainingMonths !== null && (
                            <span className="text-muted-foreground">| Est. retraining: {nmo.svpRetrainingMonths} months</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Legacy: Near-Miss Occupations List */}
            {!nearMissAnalysis.nearMisses && nearMissAnalysis.nearMissOccupations && nearMissAnalysis.nearMissOccupations.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Near-Miss Occupations with Retrainability</p>
                <div className="space-y-2">
                  {nearMissAnalysis.nearMissOccupations.map((nmo, i) => (
                    <div key={i} className="rounded border p-3 text-sm space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{nmo.title}</span>
                        <span className="text-xs font-mono text-muted-foreground">{nmo.onetSocCode}</span>
                        <Badge className={`${getNearMissBadgeColor(nmo.severity)} text-[10px]`} variant="outline">
                          {nmo.severity}
                        </Badge>
                      </div>
                      {nmo.failedTraits && nmo.failedTraits.length > 0 && (
                        <p className="text-xs text-red-600">
                          Failed: {nmo.failedTraits.map(ft => TRAIT_LABELS[ft] ?? ft).join(", ")}
                        </p>
                      )}
                      {nmo.retrainabilityNotes && (
                        <p className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 rounded p-1.5">
                          {nmo.retrainabilityNotes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════
          SECTION 4: Viable Set Coherence (NEW)
          ═══════════════════════════════════════════════════════════ */}
      {viableSetAnalysis && (
        <Card className="border-blue-200 bg-blue-50/30 dark:border-blue-800 dark:bg-blue-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-blue-600" />
              Viable Set Coherence Analysis
            </CardTitle>
            {viableSetAnalysis.totalViable !== undefined && (
              <p className="text-sm text-muted-foreground">{viableSetAnalysis.totalViable} viable occupation{viableSetAnalysis.totalViable !== 1 ? "s" : ""} analyzed</p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Coherence Score & Label */}
            {(viableSetAnalysis.coherenceScore !== undefined || viableSetAnalysis.coherenceLabel) && (() => {
              const label = viableSetAnalysis.coherenceLabel ?? getCoherenceLabelFromScore(viableSetAnalysis.coherenceScore);
              const numericScore = typeof viableSetAnalysis.coherenceScore === "number" ? viableSetAnalysis.coherenceScore : null;
              return (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-medium text-muted-foreground">Coherence:</span>
                  <Badge className={`${getCoherenceColor(label)} text-sm px-3 py-1`} variant="outline">
                    {formatCoherenceLabel(label)}
                  </Badge>
                  {numericScore !== null && (
                    <span className="text-sm font-mono text-muted-foreground">Score: {numericScore.toFixed(1)}/100</span>
                  )}
                </div>
              );
            })()}

            {/* Core vs Peripheral counts */}
            {(viableSetAnalysis.coreOccupations?.length || viableSetAnalysis.peripheralOccupations?.length) && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Core (STQ &gt; 60)</p>
                  <p className="text-2xl font-bold text-blue-600">{viableSetAnalysis.coreOccupations?.length ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">Strong skill transfer</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Peripheral (STQ &lt; 40)</p>
                  <p className="text-2xl font-bold text-gray-500">{viableSetAnalysis.peripheralOccupations?.length ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">Stretch placements</p>
                </div>
              </div>
            )}

            {/* Narrative Summary */}
            {viableSetAnalysis.narrativeSummary && (
              <p className="text-sm text-muted-foreground bg-white dark:bg-muted/20 rounded-lg border p-3">{viableSetAnalysis.narrativeSummary}</p>
            )}

            {/* Clusters */}
            {viableSetAnalysis.clusters && viableSetAnalysis.clusters.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Occupation Clusters by SOC Group</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {viableSetAnalysis.clusters.map((cluster, i) => (
                    <div key={i} className="rounded border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">{cluster.name}</p>
                        <span className="text-xs text-muted-foreground">{cluster.occupations.length} occ{cluster.occupations.length !== 1 ? "s" : ""}</span>
                      </div>
                      {(cluster.avgStq !== undefined || cluster.avgPvq !== undefined) && (
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          {cluster.avgStq !== undefined && <span>Avg STQ: <span className="font-mono font-semibold">{cluster.avgStq.toFixed(1)}</span></span>}
                          {cluster.avgPvq !== undefined && <span>Avg PVQ: <span className="font-mono font-semibold">{cluster.avgPvq.toFixed(1)}</span></span>}
                        </div>
                      )}
                      {cluster.commonTraitStrengths && cluster.commonTraitStrengths.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {cluster.commonTraitStrengths.slice(0, 5).map((ts, j) => (
                            <Badge key={j} variant="outline" className="text-[10px] px-1 bg-blue-50 text-blue-700 border-blue-200">{ts}</Badge>
                          ))}
                        </div>
                      )}
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        {cluster.occupations.map((occ, j) => (
                          <li key={j}>{occ}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trait Consistency / Demand Ranges */}
            {viableSetAnalysis.traitDemandRange && viableSetAnalysis.traitDemandRange.length > 0 && (() => {
              const narrowTraits = viableSetAnalysis.traitDemandRange!.filter(t => t.isNarrow && t.avgDemand >= 2);
              const wideTraits = viableSetAnalysis.traitDemandRange!.filter(t => t.isWide);
              if (narrowTraits.length === 0 && wideTraits.length === 0) return null;
              return (
                <div>
                  <p className="text-sm font-medium mb-2">Trait Consistency Across Viable Set</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {narrowTraits.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Consistent Demands (narrow range)</p>
                        <div className="flex flex-wrap gap-1.5">
                          {narrowTraits.map((t, i) => (
                            <Badge key={i} variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">
                              {t.label} (avg {t.avgDemand.toFixed(1)})
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {wideTraits.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Variable Demands (wide range)</p>
                        <div className="flex flex-wrap gap-1.5">
                          {wideTraits.map((t, i) => (
                            <Badge key={i} variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-[10px]">
                              {t.label} ({t.minDemand}-{t.maxDemand})
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Core & Peripheral Occupation Lists */}
            {(viableSetAnalysis.coreOccupations?.length || viableSetAnalysis.peripheralOccupations?.length) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {viableSetAnalysis.coreOccupations && viableSetAnalysis.coreOccupations.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Core Occupations</p>
                    <ul className="text-sm space-y-1">
                      {viableSetAnalysis.coreOccupations.map((occ, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                          {occ}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {viableSetAnalysis.peripheralOccupations && viableSetAnalysis.peripheralOccupations.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Peripheral Occupations</p>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      {viableSetAnalysis.peripheralOccupations.map((occ, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />
                          {occ}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════
          SECTION 5: Confidence Grade Detail (NEW)
          ═══════════════════════════════════════════════════════════ */}
      {confidenceExplanation && (
        <Card className="border-indigo-200 bg-indigo-50/30 dark:border-indigo-800 dark:bg-indigo-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-indigo-600" />
              Confidence Grade Detail
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Grade Badge, Score, and Summary */}
            <div className="flex items-start gap-4">
              {confidenceExplanation.grade && (
                <div className={`rounded-lg px-4 py-3 text-center ${getGradeColor(confidenceExplanation.grade)}`}>
                  <p className="text-3xl font-bold">{confidenceExplanation.grade}</p>
                  <p className="text-xs">Grade</p>
                  {confidenceExplanation.totalScore !== undefined && confidenceExplanation.maxPossible !== undefined && (
                    <p className="text-xs font-mono mt-1">{confidenceExplanation.totalScore}/{confidenceExplanation.maxPossible} pts</p>
                  )}
                </div>
              )}
              {confidenceExplanation.summary && (
                <p className="text-sm text-muted-foreground flex-1 pt-2">{confidenceExplanation.summary}</p>
              )}
            </div>

            {/* Contributions Table */}
            {confidenceExplanation.contributions && confidenceExplanation.contributions.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Score Contributions</p>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Component</TableHead>
                        <TableHead className="text-right">Points</TableHead>
                        <TableHead className="text-right">Max</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {confidenceExplanation.contributions.map((c, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium text-sm">{c.label ?? c.component}</TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            <span className={c.points > 0 ? "text-green-600" : c.points === 0 ? "text-muted-foreground" : "text-red-600"}>
                              {c.points}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-muted-foreground">{c.maxPoints ?? c.max}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{c.reason}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Penalties */}
            {confidenceExplanation.penalties && confidenceExplanation.penalties.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2 text-red-600">Penalties</p>
                <div className="space-y-1">
                  {confidenceExplanation.penalties.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="font-mono text-red-600">{p.points}</span>
                      <span className="font-medium">{p.label ?? p.component ?? ""}</span>
                      <span className="text-muted-foreground">{p.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {confidenceExplanation.recommendations && confidenceExplanation.recommendations.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Recommendations to Improve Grade</p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  {confidenceExplanation.recommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════
          SECTION 6: Regional Labor Market Analysis
          ═══════════════════════════════════════════════════════════ */}
      {regionalLaborMarket && (
        <Card className="border-teal-200 bg-teal-50/30 dark:border-teal-800 dark:bg-teal-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-teal-600" />
              Regional Labor Market Analysis
            </CardTitle>
            {regionalLaborMarket.locationSummary && (
              <p className="text-sm text-muted-foreground">{regionalLaborMarket.locationSummary}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Wage Premium & Employment Concentration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {regionalLaborMarket.wagePremiumLabel && (
                <div className="rounded-lg border p-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Area Wages vs National</p>
                  <p className="text-sm font-medium">
                    {regionalLaborMarket.wagePremiumLabel}
                  </p>
                  {regionalLaborMarket.wagePremiumPct !== null && regionalLaborMarket.wagePremiumPct !== undefined && (
                    <p className={`text-lg font-bold font-mono ${regionalLaborMarket.wagePremiumPct >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {regionalLaborMarket.wagePremiumPct >= 0 ? "+" : ""}{regionalLaborMarket.wagePremiumPct.toFixed(1)}%
                    </p>
                  )}
                </div>
              )}
              {regionalLaborMarket.employmentConcentration && (
                <div className="rounded-lg border p-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Employment Concentration</p>
                  <p className="text-sm">{regionalLaborMarket.employmentConcentration}</p>
                </div>
              )}
            </div>

            {/* State JOLTS */}
            {regionalLaborMarket.stateJoltsNarrative && (
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">State JOLTS Overview</p>
                <p className="text-sm">{regionalLaborMarket.stateJoltsNarrative}</p>
                {regionalLaborMarket.stateJoltsChangePct !== null && regionalLaborMarket.stateJoltsChangePct !== undefined && (
                  <p className={`text-sm font-mono ${regionalLaborMarket.stateJoltsChangePct >= 0 ? "text-green-600" : "text-red-600"}`}>
                    Change since DOI: {regionalLaborMarket.stateJoltsChangePct >= 0 ? "+" : ""}{regionalLaborMarket.stateJoltsChangePct.toFixed(1)}%
                  </p>
                )}
              </div>
            )}

            {/* Industry Trends */}
            {((regionalLaborMarket.growingOccupations?.length ?? 0) > 0 || (regionalLaborMarket.decliningOccupations?.length ?? 0) > 0 || (regionalLaborMarket.stableOccupations?.length ?? 0) > 0) && (
              <div>
                <p className="text-sm font-medium mb-2">Industry Trends</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {regionalLaborMarket.growingOccupations && regionalLaborMarket.growingOccupations.length > 0 && (
                    <div className="rounded border p-3">
                      <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-1">Growing ({regionalLaborMarket.growingOccupations.length})</p>
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        {regionalLaborMarket.growingOccupations.slice(0, 8).map((occ, i) => (
                          <li key={i} className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3 text-green-500 flex-shrink-0" />
                            {occ}
                          </li>
                        ))}
                        {regionalLaborMarket.growingOccupations.length > 8 && (
                          <li className="italic text-muted-foreground">+{regionalLaborMarket.growingOccupations.length - 8} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                  {regionalLaborMarket.stableOccupations && regionalLaborMarket.stableOccupations.length > 0 && (
                    <div className="rounded border p-3">
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Stable ({regionalLaborMarket.stableOccupations.length})</p>
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        {regionalLaborMarket.stableOccupations.slice(0, 8).map((occ, i) => (
                          <li key={i}>{occ}</li>
                        ))}
                        {regionalLaborMarket.stableOccupations.length > 8 && (
                          <li className="italic text-muted-foreground">+{regionalLaborMarket.stableOccupations.length - 8} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                  {regionalLaborMarket.decliningOccupations && regionalLaborMarket.decliningOccupations.length > 0 && (
                    <div className="rounded border p-3">
                      <p className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-1">Declining ({regionalLaborMarket.decliningOccupations.length})</p>
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        {regionalLaborMarket.decliningOccupations.slice(0, 8).map((occ, i) => (
                          <li key={i} className="flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />
                            {occ}
                          </li>
                        ))}
                        {regionalLaborMarket.decliningOccupations.length > 8 && (
                          <li className="italic text-muted-foreground">+{regionalLaborMarket.decliningOccupations.length - 8} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Risks & Opportunities */}
            {((regionalLaborMarket.risks?.length ?? 0) > 0 || (regionalLaborMarket.opportunities?.length ?? 0) > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {regionalLaborMarket.opportunities && regionalLaborMarket.opportunities.length > 0 && (
                  <div className="rounded-lg border border-green-200 bg-green-50/50 dark:bg-green-950/20 p-3">
                    <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-2">Opportunities</p>
                    <ul className="text-sm text-green-800 dark:text-green-300 space-y-1 list-disc list-inside">
                      {regionalLaborMarket.opportunities.map((o, i) => (
                        <li key={i}>{o}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {regionalLaborMarket.risks && regionalLaborMarket.risks.length > 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50/50 dark:bg-red-950/20 p-3">
                    <p className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-2">Risks</p>
                    <ul className="text-sm text-red-800 dark:text-red-300 space-y-1 list-disc list-inside">
                      {regionalLaborMarket.risks.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Full Narrative */}
            {regionalLaborMarket.fullNarrative && (
              <div className="rounded-lg border bg-white dark:bg-muted/20 p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Regional Market Narrative</p>
                <div className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                  {regionalLaborMarket.fullNarrative}
                </div>
              </div>
            )}
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

      <WizardNavButtons caseId={caseId} currentStep={6} />
      </div>
    </div>
  );
}
