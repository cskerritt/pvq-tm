"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  Briefcase,
  BookOpen,
  Wrench,
  Brain,
  Activity,
  DollarSign,
  ClipboardList,
  Thermometer,
  GraduationCap,
  Link2,
  Loader2,
  AlertCircle,
  ChevronRight,
  Zap,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ScoreItem {
  name?: string;
  title?: string;
  score?: { value: number } | number;
  value?: number;
  level?: number;
  category?: string;
  id?: string;
  statement?: string;
  importance?: number;
  relevance?: number;
  [key: string]: unknown;
}

interface OccupationData {
  id: string;
  title: string;
  description: string | null;
  tasks: ScoreItem[] | null;
  dwas: ScoreItem[] | null;
  toolsTech: ScoreItem[] | null;
  knowledge: ScoreItem[] | null;
  skills: ScoreItem[] | null;
  abilities: ScoreItem[] | null;
  workActivities: ScoreItem[] | null;
  workContext: ScoreItem[] | null;
  jobZone: number | null;
  svpRange: string | null;
  relatedOccs:
    | { id?: string; code?: string; title?: string; name?: string }[]
    | null;
  ors: {
    physicalDemands: Record<string, unknown> | null;
    envConditions: Record<string, unknown> | null;
    cogMental: Record<string, unknown> | null;
    eduTrainExp: Record<string, unknown> | null;
  } | null;
  wages: {
    year: number;
    employment: number | null;
    meanWage: number | null;
    medianWage: number | null;
    pct10: number | null;
    pct25: number | null;
    pct75: number | null;
    pct90: number | null;
    areaName: string;
  }[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatUSD(value: number | null | undefined): string {
  if (value == null) return "\u2014";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatNumber(value: number | null | undefined): string {
  if (value == null) return "\u2014";
  return value.toLocaleString("en-US");
}

function extractScore(item: ScoreItem): number | null {
  if (typeof item.score === "number") return item.score;
  if (item.score && typeof item.score === "object" && "value" in item.score)
    return item.score.value;
  if (typeof item.value === "number") return item.value;
  if (typeof item.level === "number") return item.level;
  return null;
}

function extractLabel(item: ScoreItem): string {
  return item.name ?? item.title ?? item.statement ?? String(item.id ?? "");
}

/** Pretty-print a camelCase or snake_case key into human-readable form */
function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const JOB_ZONE_LABELS: Record<number, string> = {
  1: "Little or No Preparation",
  2: "Some Preparation",
  3: "Medium Preparation",
  4: "Considerable Preparation",
  5: "Extensive Preparation",
};

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
  const pct = Math.min(100, Math.max(0, (score / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">
        {score.toFixed(0)}
      </span>
    </div>
  );
}

function ScoredItemList({
  items,
  icon: Icon,
  title,
}: {
  items: ScoreItem[] | null;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  if (!items || items.length === 0) return null;

  const sorted = [...items].sort((a, b) => {
    const sa = extractScore(a);
    const sb = extractScore(b);
    if (sa == null && sb == null) return 0;
    if (sa == null) return 1;
    if (sb == null) return -1;
    return sb - sa;
  });

  const hasScores = sorted.some((i) => extractScore(i) != null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 pb-3">
        <Icon className="h-5 w-5 text-primary" />
        <CardTitle className="text-base">{title}</CardTitle>
        <Badge variant="secondary" className="ml-auto text-xs">
          {items.length}
        </Badge>
      </CardHeader>
      <CardContent>
        {hasScores ? (
          <div className="space-y-2">
            {sorted.map((item, i) => {
              const label = extractLabel(item);
              const score = extractScore(item);
              return (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="truncate flex-1">{label}</span>
                  {score != null && <ScoreBar score={score} />}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {sorted.map((item, i) => (
              <Badge key={i} variant="outline">
                {extractLabel(item)}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OrsSection({
  data,
  title,
  icon: Icon,
}: {
  data: Record<string, unknown> | null;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  if (!data) return null;

  const entries = Object.entries(data).filter(
    ([key]) =>
      !["id", "onetSocCode", "createdAt", "updatedAt", "title", "standardErrors"].includes(key)
  );

  if (entries.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 pb-3">
        <Icon className="h-5 w-5 text-primary" />
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {entries.map(([key, value]) => {
            if (value == null) return null;

            // New ORS format: { "Category Name": [{ t: "description", v: "value" }, ...] }
            if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object" && "t" in value[0] && "v" in value[0]) {
              const estimates = value as { t: string; v: string }[];
              // Filter to only show meaningful estimates (skip <0.5 and similar)
              const meaningful = estimates.filter(
                (e) => e.v !== "<0.5" && e.v !== "—" && e.v !== "-"
              );
              if (meaningful.length === 0) return null;

              return (
                <div key={key} className="space-y-1">
                  <p className="text-sm font-medium">{key}</p>
                  <div className="ml-2 space-y-0.5">
                    {meaningful.map((est, i) => {
                      const numVal = parseFloat(est.v);
                      const isPercent = !isNaN(numVal);
                      return (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-3 text-sm text-muted-foreground"
                        >
                          <span className="truncate flex-1 capitalize">
                            {est.t}
                          </span>
                          <span className="font-mono text-foreground whitespace-nowrap">
                            {isPercent ? `${est.v}%` : est.v}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }

            // Legacy flat format: { key: "value" }
            if (typeof value === "object" && !Array.isArray(value)) {
              const obj = value as Record<string, unknown>;
              return (
                <div key={key} className="space-y-1">
                  <p className="text-sm font-medium">{humanizeKey(key)}</p>
                  <div className="ml-2 space-y-0.5">
                    {Object.entries(obj).map(([subKey, subVal]) => (
                      <div
                        key={subKey}
                        className="flex justify-between text-sm text-muted-foreground"
                      >
                        <span>{humanizeKey(subKey)}</span>
                        <span className="font-mono text-foreground">
                          {String(subVal ?? "\u2014")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            if (Array.isArray(value)) {
              return (
                <div key={key} className="space-y-1">
                  <p className="text-sm font-medium">{humanizeKey(key)}</p>
                  <div className="ml-2 flex flex-wrap gap-1.5">
                    {value.map((v, i) => (
                      <Badge key={i} variant="outline">
                        {typeof v === "object" ? JSON.stringify(v) : String(v)}
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            }

            return (
              <div key={key} className="flex justify-between text-sm">
                <span>{humanizeKey(key)}</span>
                <span className="font-mono text-muted-foreground">
                  {String(value)}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function OccupationDetailPage() {
  const params = useParams();
  const code = params.code as string;
  const [occ, setOcc] = useState<OccupationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/occupations/${code}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setOcc)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [code]);

  /* Loading state */
  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading occupation data...</span>
      </div>
    );
  }

  /* Error state */
  if (error || !occ) {
    return (
      <div className="flex items-center justify-center p-12 gap-3 text-destructive">
        <AlertCircle className="h-5 w-5" />
        <span>{error ?? "Occupation not found"}</span>
      </div>
    );
  }

  /* Sort tasks by importance desc */
  const sortedTasks = [...(occ.tasks ?? [])].sort((a, b) => {
    const ia = a.importance ?? 0;
    const ib = b.importance ?? 0;
    return ib - ia;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* -------- Header -------- */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-mono text-muted-foreground">{occ.id}</p>
            <h1 className="text-2xl font-bold tracking-tight">{occ.title}</h1>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {occ.jobZone != null && (
              <Badge variant="outline" className="gap-1">
                <GraduationCap className="h-3 w-3" />
                Job Zone {occ.jobZone}
                {JOB_ZONE_LABELS[occ.jobZone] && (
                  <span className="text-muted-foreground">
                    &mdash; {JOB_ZONE_LABELS[occ.jobZone]}
                  </span>
                )}
              </Badge>
            )}
            {occ.svpRange && (
              <Badge variant="outline" className="gap-1">
                <Zap className="h-3 w-3" />
                SVP {occ.svpRange}
              </Badge>
            )}
          </div>
        </div>
        {occ.description && (
          <p className="text-muted-foreground mt-3 leading-relaxed max-w-prose">
            {occ.description}
          </p>
        )}
      </div>

      <Separator />

      {/* -------- Tasks -------- */}
      {sortedTasks.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Tasks</h2>
            <Badge variant="secondary" className="text-xs">
              {sortedTasks.length}
            </Badge>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>Statement</TableHead>
                    <TableHead className="w-[100px] text-right">
                      Importance
                    </TableHead>
                    <TableHead className="w-[100px] text-right">
                      Relevance
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTasks.map((task, i) => (
                    <TableRow key={task.id ?? i}>
                      <TableCell className="text-muted-foreground">
                        {i + 1}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        {task.statement ?? task.title ?? task.name}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {task.importance != null
                          ? task.importance.toFixed(1)
                          : "\u2014"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {task.relevance != null
                          ? task.relevance.toFixed(1)
                          : "\u2014"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      )}

      {/* -------- Skills & Abilities -------- */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ScoredItemList
            items={occ.skills}
            icon={Wrench}
            title="Skills"
          />
          <ScoredItemList
            items={occ.abilities}
            icon={Brain}
            title="Abilities"
          />
        </div>
      </section>

      {/* -------- Knowledge -------- */}
      <ScoredItemList
        items={occ.knowledge}
        icon={BookOpen}
        title="Knowledge"
      />

      {/* -------- Work Activities & Context -------- */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ScoredItemList
            items={occ.workActivities}
            icon={Activity}
            title="Work Activities"
          />
          <ScoredItemList
            items={occ.workContext}
            icon={Briefcase}
            title="Work Context"
          />
        </div>
      </section>

      {/* -------- Tools & Technology -------- */}
      {occ.toolsTech && occ.toolsTech.length > 0 && (
        <section>
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <Wrench className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Tools & Technology</CardTitle>
              <Badge variant="secondary" className="ml-auto text-xs">
                {occ.toolsTech.length}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {occ.toolsTech.map((t, i) => {
                  const label = extractLabel(t);
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>{label}</span>
                      {t.category && (
                        <Badge variant="secondary" className="text-xs">
                          {t.category}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* -------- Detailed Work Activities -------- */}
      {occ.dwas && occ.dwas.length > 0 && (
        <section>
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <ClipboardList className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">
                Detailed Work Activities
              </CardTitle>
              <Badge variant="secondary" className="ml-auto text-xs">
                {occ.dwas.length}
              </Badge>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {occ.dwas.map((d, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <span>{extractLabel(d)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}

      <Separator />

      {/* -------- ORS Sections -------- */}
      {occ.ors && (
        <section className="space-y-6">
          <h2 className="text-lg font-semibold">
            Occupational Requirements Survey (ORS)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <OrsSection
              data={occ.ors.physicalDemands}
              title="Physical Demands"
              icon={Activity}
            />
            <OrsSection
              data={occ.ors.envConditions}
              title="Environmental Conditions"
              icon={Thermometer}
            />
            <OrsSection
              data={occ.ors.cogMental}
              title="Cognitive & Mental Demands"
              icon={Brain}
            />
            <OrsSection
              data={occ.ors.eduTrainExp}
              title="Education, Training & Experience"
              icon={GraduationCap}
            />
          </div>
        </section>
      )}

      {/* -------- Wages -------- */}
      {occ.wages && occ.wages.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Wage Data</h2>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Area</TableHead>
                    <TableHead className="text-right">Year</TableHead>
                    <TableHead className="text-right">Employment</TableHead>
                    <TableHead className="text-right">Median</TableHead>
                    <TableHead className="text-right">Mean</TableHead>
                    <TableHead className="text-right">10th %</TableHead>
                    <TableHead className="text-right">25th %</TableHead>
                    <TableHead className="text-right">75th %</TableHead>
                    <TableHead className="text-right">90th %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {occ.wages.map((w, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">
                        {w.areaName}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {w.year}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(w.employment)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatUSD(w.medianWage)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatUSD(w.meanWage)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatUSD(w.pct10)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatUSD(w.pct25)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatUSD(w.pct75)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatUSD(w.pct90)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      )}

      {/* -------- Related Occupations -------- */}
      {occ.relatedOccs && occ.relatedOccs.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Link2 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Related Occupations</h2>
            <Badge variant="secondary" className="text-xs">
              {occ.relatedOccs.length}
            </Badge>
          </div>
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {occ.relatedOccs.map((rel, i) => {
                  const relCode = rel.code ?? rel.id ?? "";
                  const relTitle = rel.title ?? rel.name ?? relCode;
                  return (
                    <Link
                      key={i}
                      href={`/occupations/${relCode}`}
                      className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                    >
                      <span className="font-mono text-xs text-muted-foreground shrink-0">
                        {relCode}
                      </span>
                      <span className="truncate">{relTitle}</span>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
