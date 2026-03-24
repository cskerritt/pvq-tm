"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

/* ────────────────────────────────────────────────────────────────── */
/*  Color system — high contrast for light backgrounds               */
/* ────────────────────────────────────────────────────────────────── */

const phaseStyles: Record<string, { border: string; badge: string; bg: string }> = {
  input:     { border: "border-l-blue-600",    badge: "bg-blue-600 text-white",    bg: "bg-blue-50" },
  data:      { border: "border-l-violet-600",  badge: "bg-violet-600 text-white",  bg: "bg-violet-50" },
  gate:      { border: "border-l-red-600",     badge: "bg-red-600 text-white",     bg: "bg-red-50" },
  score:     { border: "border-l-amber-500",   badge: "bg-amber-500 text-white",   bg: "bg-amber-50" },
  composite: { border: "border-l-emerald-600", badge: "bg-emerald-600 text-white", bg: "bg-emerald-50" },
  analysis:  { border: "border-l-cyan-600",    badge: "bg-cyan-600 text-white",    bg: "bg-cyan-50" },
};

const tagStyles: Record<string, string> = {
  blue:   "bg-blue-100 text-blue-800 border-blue-200",
  purple: "bg-violet-100 text-violet-800 border-violet-200",
  red:    "bg-red-100 text-red-800 border-red-200",
  yellow: "bg-amber-100 text-amber-800 border-amber-200",
  green:  "bg-emerald-100 text-emerald-800 border-emerald-200",
  cyan:   "bg-cyan-100 text-cyan-800 border-cyan-200",
};

/* ────────────────────────────────────────────────────────────────── */
/*  Components                                                        */
/* ────────────────────────────────────────────────────────────────── */

function PhaseHeader({ num, title, desc, color }: { num: number; title: string; desc: string; color: string }) {
  const s = phaseStyles[color];
  return (
    <div className={cn("flex items-center gap-3 mb-4 p-3 rounded-lg border-l-4", s.bg, s.border)}>
      <span className={cn("text-xs font-bold px-2.5 py-1 rounded", s.badge)}>{num}</span>
      <div>
        <div className="font-semibold text-base text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </div>
  );
}

function FlowBox({ title, tag, tagColor, children, className, formula, weight }: {
  title: string; tag?: string; tagColor?: string; children: React.ReactNode;
  className?: string; formula?: React.ReactNode; weight?: string;
}) {
  return (
    <Card className={cn("shadow-sm", className)}>
      <CardContent className="p-4">
        <div className="font-semibold text-sm mb-2 flex items-center gap-2">
          {tag && (
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold border", tagStyles[tagColor ?? "blue"])}>
              {tag}
            </span>
          )}
          <span className="text-foreground">{title}</span>
          {weight && <span className="ml-auto text-xs font-bold text-amber-600">{weight}</span>}
        </div>
        <div className="text-xs text-muted-foreground leading-relaxed">{children}</div>
        {formula && (
          <div className="font-mono text-[11px] bg-slate-900 text-emerald-300 p-3 rounded-md mt-3 leading-relaxed">
            {formula}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Arrow({ label }: { label: string }) {
  return (
    <div className="text-center my-6">
      <div className="text-muted-foreground text-2xl">&darr;</div>
      <div className="text-[11px] text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function Sources({ items }: { items: string[] }) {
  return (
    <div className="flex gap-1.5 flex-wrap mt-2">
      {items.map((s) => (
        <Badge key={s} variant="secondary" className="text-[9px] px-1.5 py-0 h-4 font-normal">{s}</Badge>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/*  Page                                                              */
/* ────────────────────────────────────────────────────────────────── */

export default function CalculationFlowPage() {
  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-center mb-1 text-foreground">PVQ-TM Calculation Flow</h1>
      <p className="text-center text-sm text-muted-foreground mb-8">
        Complete pipeline from case input to scored occupations &mdash; 363 automated tests verify every step
      </p>

      {/* Legend */}
      <div className="flex gap-5 justify-center flex-wrap mb-8 p-3 bg-muted/50 rounded-lg text-xs border">
        {[
          { color: "bg-blue-600",    label: "Input" },
          { color: "bg-violet-600",  label: "Data Retrieval" },
          { color: "bg-red-600",     label: "Exclusion Gate" },
          { color: "bg-amber-500",   label: "Scoring" },
          { color: "bg-emerald-600", label: "Composite" },
          { color: "bg-cyan-600",    label: "Analysis" },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5 text-foreground">
            <div className={cn("w-3 h-3 rounded-sm", l.color)} />
            {l.label}
          </div>
        ))}
      </div>

      {/* ── PHASE 1: INPUTS ──────────────────────────────── */}
      <PhaseHeader num={1} title="Case Inputs" desc="Evaluator enters all required data" color="input" />
      <div className="grid md:grid-cols-4 gap-3 mb-2">
        <FlowBox title="Demographics" tag="CASE" tagColor="blue">
          Client DOB, Date of Injury<br />
          ZIP Code &rarr; Metro Area<br />
          Injury Description<br />
          Body Parts Affected
        </FlowBox>
        <FlowBox title="Past Relevant Work" tag="PRW" tagColor="blue">
          Job Title, Employer<br />
          O*NET Code, DOT Code<br />
          SVP Level (1-9)<br />
          Strength Level (S/L/M/H/V)<br />
          Duration, Wages
        </FlowBox>
        <FlowBox title="Acquired Skills" tag="SKILLS" tagColor="blue">
          Action Verb + Object<br />
          Tools/Software Used<br />
          Materials/Services<br />
          SVP Level, Frequency<br />
          Transferability Flag
        </FlowBox>
        <FlowBox title="Worker Traits" tag="PROFILES" tagColor="blue">
          <strong>PRE-injury:</strong> 24 traits (0-4)<br />
          <strong>POST-injury:</strong> 24 traits (0-4)<br />
          6 Cognitive + 11 Physical + 7 Environmental
        </FlowBox>
      </div>

      <Arrow label="All inputs validated & stored in database" />

      {/* ── PHASE 2: DATA RETRIEVAL ──────────────────────── */}
      <PhaseHeader num={2} title="Data Retrieval & Candidate Generation" desc="Pull government occupational data and identify candidate occupations" color="data" />
      <div className="grid md:grid-cols-3 gap-3 mb-2">
        <FlowBox title="DOT/O*NET Candidates" tag="TRADITIONAL" tagColor="purple">
          Match via DOT Work Fields & MPSMS<br />
          Match via O*NET Related Occupations<br />
          Match via O*NET Career Changers<br />
          Filter: target SVP &le; source SVP
          <Sources items={["DOT", "O*NET 30.2"]} />
        </FlowBox>
        <FlowBox title="Component Profile Candidates" tag="CPC" tagColor="purple">
          Build 237-dim worker fingerprint<br />
          Cosine similarity vs all 1,016 O*NET<br />
          SVP gate + Strength gate<br />
          Top 30 most similar occupations
          <Sources items={["O*NET", "ORS", "DOT"]} />
        </FlowBox>
        <FlowBox title="Occupation Demand Vectors" tag="DATA" tagColor="purple">
          For each candidate, build 24-trait demand:<br />
          <strong>Priority:</strong> ORS &rarr; DOT &rarr; O*NET &rarr; Proxy<br />
          <strong>Strength:</strong> ORS &rarr; DOT xwalk &rarr; O*NET est.<br />
          <strong>Cognitive:</strong> DOT GED &rarr; O*NET abilities<br />
          <strong>Physical:</strong> ORS &rarr; DOT DPT &rarr; SVP defaults
          <Sources items={["ORS (277 SOC)", "DOT (12,726)", "O*NET (1,016)", "OEWS"]} />
        </FlowBox>
      </div>

      <Arrow label="Deduplicated candidate list (traditional + CPC merged)" />

      {/* ── PHASE 3: EXCLUSION GATES ─────────────────────── */}
      <PhaseHeader num={3} title="Exclusion Gates" desc="Hard pass/fail checks — any failure = PVQ 0 and excluded from viable set" color="gate" />
      <div className="grid md:grid-cols-3 gap-3 mb-2">
        <FlowBox title="SVP Gate" tag="GATE 1" tagColor="red" className="border-red-200 bg-red-50/50"
          formula={<>IF target_svp &gt; max(prw_svp) &rarr; <span className="text-red-400 font-bold">EXCLUDE</span></>}>
          Target SVP must &le; highest PRW SVP<br />
          Per SSA Ruling 82-41<br />
          SVP 1-3 = unskilled (no transfer)
        </FlowBox>
        <FlowBox title="Physical Demand Gates" tag="GATE 2" tagColor="red" className="border-red-200 bg-red-50/50"
          formula={<>IF worker_capacity &lt; occ_demand &rarr; <span className="text-red-400 font-bold">EXCLUDE</span></>}>
          4 explicit physical checks:<br />
          &bull; Strength (S/L/M/H/V)<br />
          &bull; Climb/Balance<br />
          &bull; Stoop/Kneel<br />
          &bull; Reach/Handle
        </FlowBox>
        <FlowBox title="Full 24-Trait Gate" tag="GATE 3" tagColor="red" className="border-red-200 bg-red-50/50"
          formula={<>IF ANY trait fails &rarr; TFQ = 0, <span className="text-red-400 font-bold">EXCLUDE</span></>}>
          Every assessed trait compared:<br />
          <span className="text-emerald-600 font-semibold">Worker &ge; Demand = PASS</span><br />
          <span className="text-red-600 font-semibold">Worker &lt; Demand = FAIL</span><br />
          <strong>Single failure = excluded</strong><br />
          Null capacity = assumed passing
        </FlowBox>
      </div>

      <Arrow label="Surviving candidates proceed to scoring; excluded tracked for near-miss analysis" />

      {/* ── PHASE 4: SCORING ─────────────────────────────── */}
      <PhaseHeader num={4} title="Four-Dimension Scoring" desc="Each surviving candidate scored independently on four dimensions (0-100 each)" color="score" />
      <div className="grid md:grid-cols-2 gap-3 mb-2">
        <FlowBox title="Skill Transfer Quotient" tag="STQ" tagColor="yellow" weight="Weight: 45%"
          formula={<>
            STQ = 0.35 &times; Task/DWA Overlap<br />
            &nbsp;&nbsp;&nbsp;&nbsp;+ 0.25 &times; Work Field/MPSMS<br />
            &nbsp;&nbsp;&nbsp;&nbsp;+ 0.20 &times; Tools/Software<br />
            &nbsp;&nbsp;&nbsp;&nbsp;+ 0.10 &times; Materials/Services<br />
            &nbsp;&nbsp;&nbsp;&nbsp;+ 0.10 &times; Credentials/Knowledge
          </>}>
          Measures skill transferability from PRW to target occupation.
          Uses Jaccard similarity + token overlap (takes max).
          <Sources items={["Acquired Skills", "O*NET Tasks", "DOT Work Fields", "O*NET Tools"]} />
        </FlowBox>
        <FlowBox title="Trait Feasibility Quotient" tag="TFQ" tagColor="yellow" weight="Weight: 25%"
          formula={<>
            TFQ = (&Sigma; trait_margins) / (24 &times; 4) &times; 100<br />
            margin = worker_capacity - occ_demand<br />
            Range: 0-100 (0 = barely passing)
          </>}>
          Quantifies reserve margin across all 24 traits.
          Higher TFQ = more room between capacity and demands.
          <Sources items={["POST Profile", "ORS", "DOT", "O*NET"]} />
        </FlowBox>
        <FlowBox title="Vocational Adjustment Quotient" tag="VAQ" tagColor="yellow" weight="Weight: 15%"
          formula={<>
            VAQ = avg(Tools, Work Processes,<br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Work Setting, Industry)<br />
            Each: 100=very little | 67=slight<br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;33=moderate | 0=substantial<br />
            <span className="text-red-400 font-bold">Advanced Age: ALL must = 100 or EXCLUDE</span>
          </>}>
          Assesses transition difficulty across four dimensions.
          Auto-estimated from DOT/O*NET or manually rated by evaluator.
          <Sources items={["DOT GOE", "O*NET Tools", "Industry Designation"]} />
        </FlowBox>
        <FlowBox title="Labor Market Quotient" tag="LMQ" tagColor="yellow" weight="Weight: 15%"
          formula={<>
            LMQ = 0.25 &times; Employment Score<br />
            &nbsp;&nbsp;&nbsp;&nbsp;+ 0.25 &times; Wage Score<br />
            &nbsp;&nbsp;&nbsp;&nbsp;+ 0.20 &times; Projections Score<br />
            &nbsp;&nbsp;&nbsp;&nbsp;+ 0.15 &times; Local Demand Score<br />
            &nbsp;&nbsp;&nbsp;&nbsp;+ 0.15 &times; JOLTS Trend Score<br />
            (weights redistribute if data missing)
          </>}>
          Evaluates real-world job availability and wages.
          <Sources items={["OEWS Wages", "BLS Projections", "JOLTS", "CareerOneStop", "Census ZBP"]} />
        </FlowBox>
      </div>

      <Arrow label="Four scores computed for every surviving candidate" />

      {/* ── PHASE 5: COMPOSITE ───────────────────────────── */}
      <PhaseHeader num={5} title="PVQ Composite & Ranking" desc="Weighted composite score determines final occupation ranking" color="composite" />
      <div className="grid md:grid-cols-3 gap-3 mb-2">
        <FlowBox title="Public Vocational Quotient" tag="PVQ" tagColor="green" className="md:col-span-2 border-emerald-300"
          formula={
            <div className="text-center text-sm py-2">
              <span className="text-amber-300 font-bold">PVQ = 0.45&times;STQ + 0.25&times;TFQ + 0.15&times;VAQ + 0.15&times;LMQ</span>
              <br /><br />
              <span className="text-slate-400 text-xs">Range: 0-100 &nbsp;|&nbsp; Excluded occupations: PVQ = 0 &nbsp;|&nbsp; Ranked by PVQ descending</span>
            </div>
          }>
          The final composite score for each occupation. Combines all four dimensions with empirically-derived weights.
        </FlowBox>
        <FlowBox title="Confidence Grade" tag="GRADE" tagColor="green">
          <div className="space-y-1">
            <div><Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 mr-1">A</Badge> 7-8 pts: Comprehensive data</div>
            <div><Badge className="bg-blue-100 text-blue-800 border-blue-200 mr-1">B</Badge> 5-6 pts: Most data available</div>
            <div><Badge className="bg-amber-100 text-amber-800 border-amber-200 mr-1">C</Badge> 3-4 pts: Significant gaps</div>
            <div><Badge className="bg-red-100 text-red-800 border-red-200 mr-1">D</Badge> 0-2 pts: Minimal data</div>
          </div>
          <Separator className="my-2" />
          <span className="text-[10px]">Points: STQ data (2) + TFQ coverage (3) + LMQ data (3) = max 8</span>
        </FlowBox>
      </div>

      <Arrow label="Ranked occupations with scores, grades, and detailed breakdowns" />

      {/* ── PHASE 6: ANALYSIS ────────────────────────────── */}
      <PhaseHeader num={6} title="Comprehensive Analysis" desc="Additional analyses computed from the scored results" color="analysis" />
      <div className="grid md:grid-cols-3 gap-3 mb-2">
        <FlowBox title="Earning Capacity" tag="VQ/TSP" tagColor="cyan">
          VQ regression (24 weights &rarr; score 68-158)<br />
          Band classification (1-4)<br />
          TSP: Transferable Skills % (0-97%)<br />
          ECLR geographic wage adjustment<br />
          95% confidence intervals
        </FlowBox>
        <FlowBox title="Component Profile Analysis" tag="CPC" tagColor="cyan">
          Numeric CPC code assigned<br />
          Worker vs occupation similarity<br />
          Gap analysis (strengths vs market)<br />
          Profile breadth (narrow/moderate/broad)<br />
          Labor market summary for matches
        </FlowBox>
        <FlowBox title="Residual Functional Capacity" tag="RFC" tagColor="cyan">
          Functional exertion level narrative<br />
          Strengths and limitations summary<br />
          Physical demands description<br />
          Cognitive aptitude assessment<br />
          Environmental tolerances
        </FlowBox>
        <FlowBox title="Near-Miss Analysis" tag="NEAR" tagColor="cyan">
          Excluded occupations categorized:<br />
          &bull; Marginal: failed by &lt; 0.5 on 1 trait<br />
          &bull; Moderate: failed 2-3 traits<br />
          &bull; Severe: failed 4+ traits<br />
          Identifies accommodation opportunities
        </FlowBox>
        <FlowBox title="Viable Set Coherence" tag="VIABLE" tagColor="cyan">
          SOC group clustering analysis<br />
          Score distribution (mean, std dev)<br />
          Wage range across viable set<br />
          Coherence score (consistency check)<br />
          Outlier detection
        </FlowBox>
        <FlowBox title="Labor Market Access" tag="LMA" tagColor="cyan">
          Pre vs post injury comparison<br />
          Occupations accessible before injury<br />
          Occupations accessible after injury<br />
          Net access reduction percentage<br />
          Regional labor market conditions
        </FlowBox>
      </div>

      <Arrow label="Complete analysis ready for report generation and expert testimony" />

      {/* ── PHASE 7: OUTPUT ──────────────────────────────── */}
      <PhaseHeader num={7} title="Output & Validation" desc="Final results with accuracy validation" color="composite" />
      <div className="grid md:grid-cols-4 gap-3 mb-2">
        <FlowBox title="Ranked Occupations" className="border-emerald-200">
          Each with PVQ, STQ, TFQ, VAQ, LMQ, CPC code, confidence grade, wages, employment
        </FlowBox>
        <FlowBox title="Excluded Occupations" className="border-emerald-200">
          Each with exclusion reason, near-miss severity, which traits failed and by how much
        </FlowBox>
        <FlowBox title="Narratives & Analysis" className="border-emerald-200">
          RFC narrative, viable set coherence, CPC gap analysis, labor market access, zero-viable explanation
        </FlowBox>
        <FlowBox title="Validation Report" className="border-emerald-200">
          363 automated checks verify every score, gate, formula, and data source. Deterministic: same inputs = same outputs.
        </FlowBox>
      </div>

      <Separator className="mt-10 mb-4" />
      <p className="text-center text-muted-foreground text-xs">
        PVQ-TM v2.0 &mdash; 363 automated tests &mdash; 15 government data sources &mdash; Fully deterministic
      </p>
    </div>
  );
}
