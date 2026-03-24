"use client";

import { cn } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────────── */
/*  Styling helpers                                                   */
/* ────────────────────────────────────────────────────────────────── */

const phaseColors: Record<string, { border: string; badge: string }> = {
  input:     { border: "border-blue-500",   badge: "bg-blue-600" },
  data:      { border: "border-violet-500", badge: "bg-violet-600" },
  gate:      { border: "border-red-500",    badge: "bg-red-600" },
  score:     { border: "border-amber-500",  badge: "bg-amber-600" },
  composite: { border: "border-emerald-500", badge: "bg-emerald-600" },
  analysis:  { border: "border-cyan-500",   badge: "bg-cyan-600" },
};

function PhaseHeader({ num, title, desc, color }: { num: number; title: string; desc: string; color: string }) {
  const c = phaseColors[color];
  return (
    <div className={cn("flex items-center gap-3 mb-4 p-3 bg-slate-800/60 rounded-lg border-l-4", c.border)}>
      <span className={cn("text-xs font-bold px-2.5 py-1 rounded text-white", c.badge)}>{num}</span>
      <div>
        <div className="font-semibold text-base">{title}</div>
        <div className="text-xs text-slate-400">{desc}</div>
      </div>
    </div>
  );
}

function Box({ title, tag, tagColor, children, className, formula }: {
  title: string; tag?: string; tagColor?: string; children: React.ReactNode;
  className?: string; formula?: React.ReactNode;
}) {
  const tagCls: Record<string, string> = {
    blue:   "bg-blue-900/50 text-blue-300",
    purple: "bg-violet-900/50 text-violet-300",
    red:    "bg-red-900/50 text-red-300",
    yellow: "bg-amber-900/50 text-amber-300",
    green:  "bg-emerald-900/50 text-emerald-300",
    cyan:   "bg-cyan-900/50 text-cyan-300",
  };
  return (
    <div className={cn("bg-slate-800/60 border border-slate-700 rounded-lg p-4", className)}>
      <div className="font-bold text-sm mb-2 flex items-center gap-2">
        {tag && <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold", tagCls[tagColor ?? "blue"])}>{tag}</span>}
        {title}
      </div>
      <div className="text-xs text-slate-400 leading-relaxed">{children}</div>
      {formula && (
        <div className="font-mono text-[11px] bg-slate-900 p-2.5 rounded mt-2 text-cyan-300 border border-slate-700 leading-relaxed">
          {formula}
        </div>
      )}
    </div>
  );
}

function Arrow({ label }: { label: string }) {
  return (
    <div className="text-center my-5">
      <div className="text-slate-500 text-2xl">&darr;</div>
      <div className="text-[11px] text-slate-500 mt-1">{label}</div>
    </div>
  );
}

function Sources({ items }: { items: string[] }) {
  return (
    <div className="flex gap-1.5 flex-wrap mt-2">
      {items.map((s) => (
        <span key={s} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">{s}</span>
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
      <h1 className="text-2xl font-bold text-center mb-1">PVQ-TM Calculation Flow</h1>
      <p className="text-center text-sm text-slate-400 mb-8">
        Complete pipeline from case input to scored occupations &mdash; 363 automated tests verify every step
      </p>

      {/* Legend */}
      <div className="flex gap-5 justify-center flex-wrap mb-8 p-3 bg-slate-800/40 rounded-lg text-xs">
        {[
          { color: "bg-blue-500",    label: "Input" },
          { color: "bg-violet-500",  label: "Data Retrieval" },
          { color: "bg-red-500",     label: "Exclusion Gate" },
          { color: "bg-amber-500",   label: "Scoring" },
          { color: "bg-emerald-500", label: "Composite" },
          { color: "bg-cyan-500",    label: "Analysis" },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={cn("w-3 h-3 rounded-sm", l.color)} />
            {l.label}
          </div>
        ))}
      </div>

      {/* ── PHASE 1: INPUTS ─────────────────────────────── */}
      <PhaseHeader num={1} title="Case Inputs" desc="Evaluator enters all required data" color="input" />
      <div className="grid md:grid-cols-4 gap-3 mb-2">
        <Box title="Demographics" tag="CASE" tagColor="blue">
          Client DOB, Date of Injury<br />
          ZIP Code &rarr; Metro Area<br />
          Injury Description<br />
          Body Parts Affected
        </Box>
        <Box title="Past Relevant Work" tag="PRW" tagColor="blue">
          Job Title, Employer<br />
          O*NET Code, DOT Code<br />
          SVP Level (1-9)<br />
          Strength Level (S/L/M/H/V)<br />
          Duration, Wages
        </Box>
        <Box title="Acquired Skills" tag="SKILLS" tagColor="blue">
          Action Verb + Object<br />
          Tools/Software Used<br />
          Materials/Services<br />
          SVP Level, Frequency<br />
          Transferability Flag
        </Box>
        <Box title="Worker Traits" tag="PROFILES" tagColor="blue">
          <strong>PRE-injury:</strong> 24 traits (0-4)<br />
          <strong>POST-injury:</strong> 24 traits (0-4)<br />
          6 Cognitive + 11 Physical + 7 Environmental
        </Box>
      </div>

      <Arrow label="All inputs validated & stored in database" />

      {/* ── PHASE 2: DATA RETRIEVAL ────────────────────── */}
      <PhaseHeader num={2} title="Data Retrieval & Candidate Generation" desc="Pull government occupational data and identify candidate occupations" color="data" />
      <div className="grid md:grid-cols-3 gap-3 mb-2">
        <Box title="DOT/O*NET Candidates" tag="TRADITIONAL" tagColor="purple">
          Match via DOT Work Fields & MPSMS<br />
          Match via O*NET Related Occupations<br />
          Match via O*NET Career Changers<br />
          Filter: target SVP &le; source SVP
          <Sources items={["DOT", "O*NET 30.2"]} />
        </Box>
        <Box title="Component Profile Candidates" tag="CPC" tagColor="purple">
          Build 237-dim worker fingerprint<br />
          Cosine similarity vs all 1,016 O*NET<br />
          SVP gate + Strength gate<br />
          Top 30 most similar occupations
          <Sources items={["O*NET", "ORS", "DOT"]} />
        </Box>
        <Box title="Occupation Demand Vectors" tag="DATA" tagColor="purple">
          For each candidate, build 24-trait demand:<br />
          <strong>Priority:</strong> ORS &rarr; DOT &rarr; O*NET &rarr; Proxy<br />
          <strong>Strength:</strong> ORS &rarr; DOT xwalk &rarr; O*NET est.<br />
          <strong>Cognitive:</strong> DOT GED &rarr; O*NET abilities<br />
          <strong>Physical:</strong> ORS &rarr; DOT DPT &rarr; SVP defaults
          <Sources items={["ORS (277 SOC)", "DOT (12,726)", "O*NET (1,016)", "OEWS"]} />
        </Box>
      </div>

      <Arrow label="Deduplicated candidate list (traditional + CPC merged)" />

      {/* ── PHASE 3: EXCLUSION GATES ───────────────────── */}
      <PhaseHeader num={3} title="Exclusion Gates" desc="Hard pass/fail checks — any failure = PVQ 0 and excluded from viable set" color="gate" />
      <div className="grid md:grid-cols-3 gap-3 mb-2">
        <Box title="SVP Gate" tag="GATE 1" tagColor="red" className="border-red-900/50 bg-red-950/20"
          formula={<>IF target_svp &gt; max(prw_svp) &rarr; <span className="text-red-400">EXCLUDE</span></>}>
          Target SVP must &le; highest PRW SVP<br />
          Per SSA Ruling 82-41<br />
          SVP 1-3 = unskilled (no transfer)
        </Box>
        <Box title="Physical Demand Gates" tag="GATE 2" tagColor="red" className="border-red-900/50 bg-red-950/20"
          formula={<>IF worker_capacity &lt; occ_demand &rarr; <span className="text-red-400">EXCLUDE</span></>}>
          4 explicit physical checks:<br />
          &bull; Strength (S/L/M/H/V)<br />
          &bull; Climb/Balance<br />
          &bull; Stoop/Kneel<br />
          &bull; Reach/Handle
        </Box>
        <Box title="Full 24-Trait Gate" tag="GATE 3" tagColor="red" className="border-red-900/50 bg-red-950/20"
          formula={<>IF ANY trait fails &rarr; TFQ = 0, <span className="text-red-400">EXCLUDE</span></>}>
          Every assessed trait compared:<br />
          <span className="text-green-400">Worker &ge; Demand = PASS</span><br />
          <span className="text-red-400">Worker &lt; Demand = FAIL</span><br />
          <strong>Single failure = excluded</strong><br />
          Null capacity = assumed passing
        </Box>
      </div>

      <Arrow label="Surviving candidates proceed to scoring; excluded tracked for near-miss analysis" />

      {/* ── PHASE 4: SCORING ───────────────────────────── */}
      <PhaseHeader num={4} title="Four-Dimension Scoring" desc="Each surviving candidate scored independently on four dimensions (0-100 each)" color="score" />
      <div className="grid md:grid-cols-2 gap-3 mb-2">
        <Box title="Skill Transfer Quotient" tag="STQ" tagColor="yellow"
          formula={<>
            STQ = 0.35 &times; Task/DWA Overlap<br />
            &nbsp;&nbsp;&nbsp;&nbsp;+ 0.25 &times; Work Field/MPSMS<br />
            &nbsp;&nbsp;&nbsp;&nbsp;+ 0.20 &times; Tools/Software<br />
            &nbsp;&nbsp;&nbsp;&nbsp;+ 0.10 &times; Materials/Services<br />
            &nbsp;&nbsp;&nbsp;&nbsp;+ 0.10 &times; Credentials/Knowledge
          </>}>
          <span className="float-right text-amber-400 font-bold text-xs">Weight: 45%</span>
          Measures skill transferability from PRW to target occupation.
          Uses Jaccard similarity + token overlap (takes max).
          <Sources items={["Acquired Skills", "O*NET Tasks", "DOT Work Fields", "O*NET Tools"]} />
        </Box>
        <Box title="Trait Feasibility Quotient" tag="TFQ" tagColor="yellow"
          formula={<>
            TFQ = (&Sigma; trait_margins) / (24 &times; 4) &times; 100<br />
            margin = worker_capacity - occ_demand<br />
            Range: 0-100 (0 = barely passing)
          </>}>
          <span className="float-right text-amber-400 font-bold text-xs">Weight: 25%</span>
          Quantifies reserve margin across all 24 traits.
          Higher TFQ = more room between capacity and demands.
          <Sources items={["POST Profile", "ORS", "DOT", "O*NET"]} />
        </Box>
        <Box title="Vocational Adjustment Quotient" tag="VAQ" tagColor="yellow"
          formula={<>
            VAQ = avg(Tools, Work Processes,<br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Work Setting, Industry)<br />
            Each: 100=very little | 67=slight<br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;33=moderate | 0=substantial<br />
            <span className="text-red-400">Advanced Age: ALL must = 100 or EXCLUDE</span>
          </>}>
          <span className="float-right text-amber-400 font-bold text-xs">Weight: 15%</span>
          Assesses transition difficulty across four dimensions.
          Auto-estimated from DOT/O*NET or manually rated by evaluator.
          <Sources items={["DOT GOE", "O*NET Tools", "Industry Designation"]} />
        </Box>
        <Box title="Labor Market Quotient" tag="LMQ" tagColor="yellow"
          formula={<>
            LMQ = 0.25 &times; Employment Score<br />
            &nbsp;&nbsp;&nbsp;&nbsp;+ 0.25 &times; Wage Score<br />
            &nbsp;&nbsp;&nbsp;&nbsp;+ 0.20 &times; Projections Score<br />
            &nbsp;&nbsp;&nbsp;&nbsp;+ 0.15 &times; Local Demand Score<br />
            &nbsp;&nbsp;&nbsp;&nbsp;+ 0.15 &times; JOLTS Trend Score<br />
            (weights redistribute if data missing)
          </>}>
          <span className="float-right text-amber-400 font-bold text-xs">Weight: 15%</span>
          Evaluates real-world job availability and wages.
          <Sources items={["OEWS Wages", "BLS Projections", "JOLTS", "CareerOneStop", "Census ZBP"]} />
        </Box>
      </div>

      <Arrow label="Four scores computed for every surviving candidate" />

      {/* ── PHASE 5: COMPOSITE ─────────────────────────── */}
      <PhaseHeader num={5} title="PVQ Composite & Ranking" desc="Weighted composite score determines final occupation ranking" color="composite" />
      <div className="grid md:grid-cols-3 gap-3 mb-2">
        <Box title="Public Vocational Quotient" tag="PVQ" tagColor="green" className="md:col-span-2 border-emerald-800"
          formula={
            <div className="text-center text-sm py-2">
              <span className="text-amber-300 font-bold">PVQ = 0.45&times;STQ + 0.25&times;TFQ + 0.15&times;VAQ + 0.15&times;LMQ</span>
              <br /><br />
              <span className="text-slate-400 text-xs">Range: 0-100 &nbsp;|&nbsp; Excluded occupations: PVQ = 0 &nbsp;|&nbsp; Ranked by PVQ descending</span>
            </div>
          }>
          The final composite score for each occupation. Combines all four dimensions with empirically-derived weights.
        </Box>
        <Box title="Confidence Grade" tag="GRADE" tagColor="green">
          <strong>A</strong> (7-8 pts): Comprehensive data<br />
          <strong>B</strong> (5-6 pts): Most data available<br />
          <strong>C</strong> (3-4 pts): Significant gaps<br />
          <strong>D</strong> (0-2 pts): Minimal data<br /><br />
          Points from: STQ data (2), TFQ trait coverage (3), LMQ employment/wage/projections (3)
        </Box>
      </div>

      <Arrow label="Ranked occupations with scores, grades, and detailed breakdowns" />

      {/* ── PHASE 6: ANALYSIS ──────────────────────────── */}
      <PhaseHeader num={6} title="Comprehensive Analysis" desc="Additional analyses computed from the scored results" color="analysis" />
      <div className="grid md:grid-cols-3 gap-3 mb-2">
        <Box title="Earning Capacity" tag="VQ/TSP" tagColor="cyan">
          VQ regression (24 weights &rarr; score 68-158)<br />
          Band classification (1-4)<br />
          TSP: Transferable Skills % (0-97%)<br />
          ECLR geographic wage adjustment<br />
          95% confidence intervals
        </Box>
        <Box title="Component Profile Analysis" tag="CPC" tagColor="cyan">
          Numeric CPC code assigned<br />
          Worker vs occupation similarity<br />
          Gap analysis (strengths vs market)<br />
          Profile breadth (narrow/moderate/broad)<br />
          Labor market summary for matches
        </Box>
        <Box title="Residual Functional Capacity" tag="RFC" tagColor="cyan">
          Functional exertion level narrative<br />
          Strengths and limitations summary<br />
          Physical demands description<br />
          Cognitive aptitude assessment<br />
          Environmental tolerances
        </Box>
        <Box title="Near-Miss Analysis" tag="NEAR" tagColor="cyan">
          Excluded occupations categorized:<br />
          &bull; Marginal: failed by &lt; 0.5 on 1 trait<br />
          &bull; Moderate: failed 2-3 traits<br />
          &bull; Severe: failed 4+ traits<br />
          Identifies accommodation opportunities
        </Box>
        <Box title="Viable Set Coherence" tag="VIABLE" tagColor="cyan">
          SOC group clustering analysis<br />
          Score distribution (mean, std dev)<br />
          Wage range across viable set<br />
          Coherence score (are results consistent?)<br />
          Outlier detection
        </Box>
        <Box title="Labor Market Access" tag="LMA" tagColor="cyan">
          Pre vs post injury comparison<br />
          Occupations accessible before injury<br />
          Occupations accessible after injury<br />
          Net access reduction percentage<br />
          Regional labor market conditions
        </Box>
      </div>

      <Arrow label="Complete analysis ready for report generation and expert testimony" />

      {/* ── PHASE 7: OUTPUT ────────────────────────────── */}
      <PhaseHeader num={7} title="Output & Validation" desc="Final results with accuracy validation" color="composite" />
      <div className="grid md:grid-cols-4 gap-3 mb-2">
        <Box title="Ranked Occupations" className="border-emerald-800">
          Each with PVQ, STQ, TFQ, VAQ, LMQ, CPC code, confidence grade, wages, employment
        </Box>
        <Box title="Excluded Occupations" className="border-emerald-800">
          Each with exclusion reason, near-miss severity, which traits failed and by how much
        </Box>
        <Box title="Narratives & Analysis" className="border-emerald-800">
          RFC narrative, viable set coherence, CPC gap analysis, labor market access, zero-viable explanation
        </Box>
        <Box title="Validation Report" className="border-emerald-800">
          363 automated checks verify every score, gate, formula, and data source. Deterministic: same inputs = same outputs, always.
        </Box>
      </div>

      <p className="text-center mt-10 text-slate-500 text-xs">
        PVQ-TM v2.0 &mdash; 363 automated tests &mdash; 15 government data sources &mdash; Fully deterministic
      </p>
    </div>
  );
}
