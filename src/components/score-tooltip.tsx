"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Info } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────

interface BreakdownLine {
  label: string;
  value: string | number;
  detail?: string;
  highlight?: boolean;
}

interface ScoreBreakdown {
  title: string;
  formula?: string;
  lines: BreakdownLine[];
  footer?: string;
}

// ─── Component ──────────────────────────────────────────────────

export function ScoreTooltip({
  breakdown,
  className,
}: {
  breakdown: ScoreBreakdown | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!breakdown) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={`inline-flex items-center justify-center rounded-full p-0.5 hover:bg-muted/80 transition-colors cursor-pointer ${className ?? ""}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
      >
        <Info className="h-3.5 w-3.5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="w-80 max-h-96 overflow-y-auto text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <p className="font-semibold text-sm">{breakdown.title}</p>
          {breakdown.formula && (
            <p className="font-mono text-[10px] text-muted-foreground bg-muted/50 rounded px-2 py-1 break-all">
              {breakdown.formula}
            </p>
          )}
          <div className="space-y-1">
            {breakdown.lines.map((line, i) => (
              <div
                key={i}
                className={`flex justify-between items-start gap-2 ${
                  line.highlight ? "font-semibold" : ""
                }`}
              >
                <span className="text-muted-foreground shrink-0">
                  {line.label}
                </span>
                <div className="text-right">
                  <span className="font-mono">
                    {typeof line.value === "number"
                      ? line.value.toFixed(2)
                      : line.value}
                  </span>
                  {line.detail && (
                    <span className="block text-[10px] text-muted-foreground">
                      {line.detail}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {breakdown.footer && (
            <p className="text-[10px] text-muted-foreground pt-1 border-t">
              {breakdown.footer}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Breakdown Builders ─────────────────────────────────────────

function fmt(v: unknown, decimals = 2): string {
  if (typeof v === "number") return v.toFixed(decimals);
  if (v == null) return "\u2014";
  return String(v);
}

function fmtUsd(v: unknown): string {
  if (typeof v !== "number") return "\u2014";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Details = Record<string, any> | null;

/**
 * Build TFQ score breakdown from tfqDetails JSON.
 */
export function buildTFQBreakdown(
  tfq: number | null,
  details: Details
): ScoreBreakdown | null {
  if (tfq == null || !details) return null;

  const reserveMargin = details.reserveMargin as number | undefined;
  const traitComparisons = details.traitComparisons as
    | Record<string, { worker: number; demand: number; margin: number }>
    | undefined;
  const traitsPassing = details.traitsPassing as number | undefined;

  // Find the 3 tightest margins
  const tightestMargins: BreakdownLine[] = [];
  if (traitComparisons) {
    const entries = Object.entries(traitComparisons)
      .filter(([, v]) => v && typeof v.margin === "number")
      .sort(([, a], [, b]) => a.margin - b.margin)
      .slice(0, 3);
    for (const [trait, data] of entries) {
      tightestMargins.push({
        label: `Tightest: ${trait}`,
        value: `${data.margin >= 0 ? "+" : ""}${fmt(data.margin)}`,
        detail: `worker ${fmt(data.worker, 1)} vs demand ${fmt(data.demand, 1)}`,
      });
    }
  }

  // Count rated traits
  let ratedCount = 0;
  let totalMarginSum = 0;
  if (traitComparisons) {
    for (const v of Object.values(traitComparisons)) {
      if (v && typeof v.margin === "number") {
        ratedCount++;
        totalMarginSum += v.margin;
      }
    }
  }

  return {
    title: "TFQ (Trait Feasibility Quotient)",
    formula: `(totalMargin / 96) x 100 = TFQ`,
    lines: [
      {
        label: "Reserve Margin",
        value: `${fmt(reserveMargin)}%`,
        highlight: true,
      },
      {
        label: "Rated traits",
        value: `${traitsPassing ?? ratedCount} of 24`,
      },
      {
        label: "Total margin sum",
        value: fmt(totalMarginSum),
      },
      {
        label: "TFQ Score",
        value: fmt(tfq),
        highlight: true,
      },
      ...tightestMargins,
    ],
  };
}

/**
 * Build PVQ score breakdown from component scores.
 */
export function buildPVQBreakdown(
  pvq: number | null,
  stq: number | null,
  tfq: number | null,
  vaq: number | null,
  lmq: number | null,
  confidenceGrade: string | null
): ScoreBreakdown | null {
  if (pvq == null) return null;

  const stqW = 0.45;
  const tfqW = 0.25;
  const vaqW = 0.15;
  const lmqW = 0.15;

  return {
    title: "PVQ (Placement Viability Quotient)",
    formula: `PVQ = 0.45*STQ + 0.25*TFQ + 0.15*VAQ + 0.15*LMQ`,
    lines: [
      {
        label: `STQ (x${stqW})`,
        value: fmt(stq),
        detail: `weighted: ${fmt((stq ?? 0) * stqW)}`,
      },
      {
        label: `TFQ (x${tfqW})`,
        value: fmt(tfq),
        detail: `weighted: ${fmt((tfq ?? 0) * tfqW)}`,
      },
      {
        label: `VAQ (x${vaqW})`,
        value: fmt(vaq),
        detail: `weighted: ${fmt((vaq ?? 0) * vaqW)}`,
      },
      {
        label: `LMQ (x${lmqW})`,
        value: fmt(lmq),
        detail: `weighted: ${fmt((lmq ?? 0) * lmqW)}`,
      },
      {
        label: "PVQ Score",
        value: fmt(pvq),
        highlight: true,
      },
      ...(confidenceGrade
        ? [
            {
              label: "Confidence Grade",
              value: confidenceGrade,
            },
          ]
        : []),
    ],
  };
}

/**
 * Build LMQ score breakdown from lmqDetails JSON.
 */
export function buildLMQBreakdown(
  lmq: number | null,
  details: Details
): ScoreBreakdown | null {
  if (lmq == null || !details) return null;

  const scores = (details.scores ?? {}) as Record<string, number>;
  const weights = (details.weights ?? {}) as Record<string, number>;

  const components = [
    { key: "employment", label: "Employment", defaultWeight: 0.25 },
    { key: "wage", label: "Wage", defaultWeight: 0.25 },
    { key: "projections", label: "Projections", defaultWeight: 0.20 },
    { key: "areaEmployment", label: "Local Demand", defaultWeight: 0.15 },
    { key: "joltsTrend", label: "JOLTS", defaultWeight: 0.15 },
  ];

  const lines: BreakdownLine[] = components.map((c) => {
    const score = scores[c.key] as number | undefined;
    const weight = (weights[c.key] as number | undefined) ?? c.defaultWeight;
    return {
      label: `${c.label} (x${weight.toFixed(2)})`,
      value: fmt(score),
      detail: `weighted: ${fmt((score ?? 0) * weight)}`,
    };
  });

  lines.push({
    label: "LMQ Score",
    value: fmt(lmq),
    highlight: true,
  });

  return {
    title: "LMQ (Labor Market Quotient)",
    formula: `LMQ = 0.25*Emp + 0.25*Wage + 0.20*Proj + 0.15*Local + 0.15*JOLTS`,
    lines,
  };
}

/**
 * Build VQ score breakdown from vqDetails JSON.
 */
export function buildVQBreakdown(
  vqScore: number | null,
  vqBand: number | null,
  details: Details
): ScoreBreakdown | null {
  if (vqScore == null) return null;

  const lines: BreakdownLine[] = [];

  lines.push({
    label: "VQ Score",
    value: fmt(vqScore, 1),
    highlight: true,
  });

  const bandLabel =
    vqBand === 1
      ? "Below/Mid-Avg"
      : vqBand === 2
        ? "Mid/High-Avg"
        : vqBand === 3
          ? "High/Very-High"
          : vqBand === 4
            ? "Extremely High"
            : "\u2014";
  lines.push({
    label: "VQ Band",
    value: `Band ${vqBand ?? "\u2014"} - ${bandLabel}`,
  });

  // Show top contributing traits if available
  if (details?.traitContributions) {
    const contributions = details.traitContributions as {
      trait: string;
      weight: number;
      value: number;
      contribution: number;
    }[];
    const top5 = contributions
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
      .slice(0, 5);
    for (const c of top5) {
      lines.push({
        label: c.trait,
        value: fmt(c.contribution),
        detail: `w=${fmt(c.weight, 3)} x v=${fmt(c.value, 1)}`,
      });
    }
  }

  return {
    title: "VQ (Vocational Quotient)",
    formula: `VQ = 34.567 + sum(weight x traitValue)`,
    lines,
  };
}

/**
 * Build EC (Earning Capacity) breakdown from occupation data.
 */
export function buildECBreakdown(occ: {
  ecMedian: number | null;
  ecMean?: number | null;
  ec10: number | null;
  ec25: number | null;
  ec75: number | null;
  ec90: number | null;
  ecConfLow: number | null;
  ecConfHigh: number | null;
  ecGeoAdjusted: boolean | null;
  vqBand: number | null;
  ecDetails?: Details;
}): ScoreBreakdown | null {
  if (occ.ecMedian == null) return null;

  const bandLabel =
    occ.vqBand === 1
      ? "Below/Mid-Avg"
      : occ.vqBand === 2
        ? "Mid/High-Avg"
        : occ.vqBand === 3
          ? "High/Very-High"
          : occ.vqBand === 4
            ? "Extremely High"
            : "\u2014";

  const lines: BreakdownLine[] = [
    {
      label: "Based on",
      value: `VQ Band ${occ.vqBand ?? "\u2014"}`,
      detail: bandLabel + ", OEWS percentile mapping",
    },
    { label: "p10", value: fmtUsd(occ.ec10) },
    { label: "p25", value: fmtUsd(occ.ec25) },
    {
      label: "Median (EC)",
      value: `${fmtUsd(occ.ecMedian)}/hr`,
      highlight: true,
    },
    { label: "p75", value: fmtUsd(occ.ec75) },
    { label: "p90", value: fmtUsd(occ.ec90) },
  ];

  if (occ.ecConfLow != null && occ.ecConfHigh != null) {
    lines.push({
      label: "95% CI",
      value: `[${fmtUsd(occ.ecConfLow)}, ${fmtUsd(occ.ecConfHigh)}]`,
    });
  }

  if (occ.ecGeoAdjusted) {
    lines.push({
      label: "Geo Adjusted",
      value: "Yes (ECLR applied)",
    });
  }

  return {
    title: "EC (Earning Capacity)",
    formula: `EC based on VQ Band, OEWS percentile mapping`,
    lines,
  };
}

/**
 * Build STQ score breakdown from stqDetails JSON.
 */
export function buildSTQBreakdown(
  stq: number | null,
  details: Details
): ScoreBreakdown | null {
  if (stq == null || !details) return null;

  const components = (details.components ?? {}) as Record<string, number>;

  const lines: BreakdownLine[] = [
    {
      label: "Task/DWA Overlap",
      value: fmt(components.taskDwaOverlap),
    },
    {
      label: "WF/MPSMS Overlap",
      value: fmt(components.wfMpsmsOverlap),
    },
    {
      label: "Tools Overlap",
      value: fmt(components.toolsOverlap),
    },
    {
      label: "Materials Overlap",
      value: fmt(components.materialsOverlap),
    },
    {
      label: "Credential Overlap",
      value: fmt(components.credentialOverlap),
    },
    {
      label: "STQ Score",
      value: fmt(stq),
      highlight: true,
    },
  ];

  return {
    title: "STQ (Skill Transfer Quotient)",
    lines,
  };
}

/**
 * Build VAQ score breakdown from vaqDetails JSON.
 */
export function buildVAQBreakdown(
  vaq: number | null,
  details: Details
): ScoreBreakdown | null {
  if (vaq == null || !details) return null;

  const adj = (details.adjustment ?? details) as Record<string, number>;

  const lines: BreakdownLine[] = [
    { label: "Tools", value: fmt(adj.tools) },
    { label: "Work Processes", value: fmt(adj.workProcesses) },
    { label: "Work Setting", value: fmt(adj.workSetting) },
    { label: "Industry", value: fmt(adj.industry) },
    {
      label: "VAQ Score",
      value: fmt(vaq),
      highlight: true,
    },
  ];

  return {
    title: "VAQ (Vocational Adjustment Quotient)",
    lines,
  };
}
