import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const metadata = {
  title: "Methodology | PVQ-TM",
  description:
    "Complete methodology documentation for the Public Vocational Quotient Transferability Method (PVQ-TM).",
};

function FormulaCard({
  title,
  formula,
  children,
}: {
  title: string;
  formula: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="my-4 border-l-4 border-l-blue-500">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <code className="block bg-muted rounded-md px-4 py-3 text-sm font-mono whitespace-pre-wrap">
          {formula}
        </code>
        {children && <div className="mt-3 text-sm text-muted-foreground">{children}</div>}
      </CardContent>
    </Card>
  );
}

function Section({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-2xl font-bold mt-12 mb-4 flex items-center gap-3">
        <Badge variant="outline" className="text-sm font-mono shrink-0">
          {number}
        </Badge>
        {title}
      </h2>
      <div className="space-y-4 text-muted-foreground leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function SubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function TraitTable() {
  const traits = [
    { group: "Aptitude", traits: ["Reasoning (GED R)", "Math (GED M)", "Language (GED L)", "Spatial Perception (S)", "Form Perception (P)", "Clerical Perception (Q)"] },
    { group: "Physical", traits: ["Motor Coordination (K)", "Finger Dexterity (F)", "Manual Dexterity (M)", "Eye-Hand-Foot Coord. (E)", "Color Discrimination (C)", "Strength", "Climb/Balance", "Stoop/Kneel", "Reach/Handle", "Talk/Hear", "See"] },
    { group: "Environmental", traits: ["Work Location", "Extreme Cold", "Extreme Heat", "Wetness/Humidity", "Noise/Vibration", "Hazards", "Dusts/Fumes"] },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-muted">
            <th className="text-left p-2 border font-semibold">Group</th>
            <th className="text-left p-2 border font-semibold">Traits</th>
            <th className="text-left p-2 border font-semibold">Count</th>
          </tr>
        </thead>
        <tbody>
          {traits.map((g) => (
            <tr key={g.group}>
              <td className="p-2 border font-medium text-foreground">{g.group}</td>
              <td className="p-2 border">{g.traits.join(", ")}</td>
              <td className="p-2 border text-center">{g.traits.length}</td>
            </tr>
          ))}
          <tr className="bg-muted font-semibold">
            <td className="p-2 border text-foreground">Total</td>
            <td className="p-2 border"></td>
            <td className="p-2 border text-center">24</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function NormalizationTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-muted">
            <th className="text-left p-2 border font-semibold">Source</th>
            <th className="text-left p-2 border font-semibold">Original Scale</th>
            <th className="text-left p-2 border font-semibold">Normalized (0-4)</th>
            <th className="text-left p-2 border font-semibold">Mapping</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="p-2 border font-medium text-foreground">DOT GED (R/M/L)</td>
            <td className="p-2 border">1-6</td>
            <td className="p-2 border">0-4</td>
            <td className="p-2 border font-mono text-xs">{"1\u21920, 2\u21921, 3\u21922, 4\u21922, 5\u21923, 6\u21924"}</td>
          </tr>
          <tr>
            <td className="p-2 border font-medium text-foreground">DOT Strength</td>
            <td className="p-2 border">S/L/M/H/V</td>
            <td className="p-2 border">0-4</td>
            <td className="p-2 border font-mono text-xs">{"S\u21920, L\u21921, M\u21922, H\u21923, V\u21924"}</td>
          </tr>
          <tr>
            <td className="p-2 border font-medium text-foreground">DOT Aptitude (GATB)</td>
            <td className="p-2 border">1-5 (1=highest)</td>
            <td className="p-2 border">0-4</td>
            <td className="p-2 border font-mono text-xs">{"normalized = 5 - dotValue"}</td>
          </tr>
          <tr>
            <td className="p-2 border font-medium text-foreground">DOT Physical</td>
            <td className="p-2 border">N/S/O/F/C</td>
            <td className="p-2 border">0-4</td>
            <td className="p-2 border font-mono text-xs">{"N\u21920, S\u21921, O\u21922, F\u21923, C\u21924"}</td>
          </tr>
          <tr>
            <td className="p-2 border font-medium text-foreground">O*NET Importance</td>
            <td className="p-2 border">0-100</td>
            <td className="p-2 border">0-4</td>
            <td className="p-2 border font-mono text-xs">{"round((score / 100) \u00d7 4)"}</td>
          </tr>
          <tr>
            <td className="p-2 border font-medium text-foreground">ORS Frequency</td>
            <td className="p-2 border">% by category</td>
            <td className="p-2 border">0-4</td>
            <td className="p-2 border font-mono text-xs">{"Modal frequency category"}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function MethodologyPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">
          PVQ-TM Methodology
        </h1>
        <p className="text-lg text-muted-foreground mt-2">
          Public Vocational Quotient &mdash; Transferability Method
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          A transparent, reproducible framework for transferable skills analysis
        </p>
      </div>

      {/* Table of Contents */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">Table of Contents</CardTitle>
        </CardHeader>
        <CardContent>
          <nav className="grid grid-cols-1 md:grid-cols-2 gap-1 text-sm">
            {[
              { id: "introduction", num: "1", label: "Introduction & Purpose" },
              { id: "legal-framework", num: "2", label: "Legal Framework" },
              { id: "data-sources", num: "3", label: "Data Sources" },
              { id: "trait-system", num: "4", label: "24-Trait Worker Profile System" },
              { id: "workflow", num: "5", label: "Five-Step Analysis Workflow" },
              { id: "stq", num: "6", label: "Skill Transfer Quotient (STQ)" },
              { id: "tfq", num: "7", label: "Trait Feasibility Quotient (TFQ)" },
              { id: "vaq", num: "8", label: "Vocational Adjustment Quotient (VAQ)" },
              { id: "lmq", num: "9", label: "Labor Market Quotient (LMQ)" },
              { id: "pvq", num: "10", label: "PVQ Composite Score" },
              { id: "reproducibility", num: "11", label: "Reproducibility & Audit Trail" },
            ].map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted transition-colors"
              >
                <Badge variant="outline" className="text-xs font-mono shrink-0 w-6 justify-center">
                  {item.num}
                </Badge>
                <span>{item.label}</span>
              </a>
            ))}
          </nav>
        </CardContent>
      </Card>

      <Separator className="my-8" />

      {/* ─── Section 1: Introduction ─────────────────────────────────── */}
      <Section id="introduction" number="1" title="Introduction & Purpose">
        <p>
          The <strong className="text-foreground">Public Vocational Quotient Transferability Method
          (PVQ-TM)</strong> is an open, transparent framework for conducting transferable skills
          analyses (TSA) in forensic vocational rehabilitation settings. It provides a systematic,
          data-driven approach to evaluating whether a worker&apos;s skills from past relevant work
          can transfer to alternative occupations, given the worker&apos;s residual functional
          capacity.
        </p>
        <p>
          PVQ-TM was developed to address the need for a publicly auditable methodology in
          vocational expert testimony. Every formula, data source, threshold, and decision rule is
          documented here so that any qualified professional can independently verify the analysis
          and replicate its results.
        </p>
        <SubSection title="Design Principles">
          <ul className="list-disc pl-6 space-y-1">
            <li><strong className="text-foreground">Transparency:</strong> All formulas and scoring thresholds are published. No proprietary black-box algorithms.</li>
            <li><strong className="text-foreground">Reproducibility:</strong> Given the same inputs and data versions, any implementation must produce identical results.</li>
            <li><strong className="text-foreground">SSA Compatibility:</strong> Aligns with Social Security Administration regulations governing transferability of skills (20 CFR 404.1568, SSR 82-41).</li>
            <li><strong className="text-foreground">Multi-Source Data:</strong> Integrates DOT, O*NET, BLS ORS, OEWS, and Employment Projections data with explicit source tracking.</li>
            <li><strong className="text-foreground">Confidence Grading:</strong> Every result carries a data-quality grade (A-D) reflecting the completeness and provenance of underlying data.</li>
          </ul>
        </SubSection>
      </Section>

      {/* ─── Section 2: Legal Framework ──────────────────────────────── */}
      <Section id="legal-framework" number="2" title="Legal Framework">
        <p>
          Transferable skills analysis is rooted in Social Security Administration (SSA) policy
          governing disability determinations. The PVQ-TM framework implements the regulatory
          requirements established in the following authorities:
        </p>
        <SubSection title="Key Regulations">
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-foreground">20 CFR 404.1568(d) &mdash; Transferability of Skills:</strong>{" "}
              Skills are transferable when they can be used to meet the requirements of other skilled
              or semi-skilled work. The degree of transferability depends on the similarity of
              occupationally significant work activities.
            </li>
            <li>
              <strong className="text-foreground">SSR 82-41 &mdash; Work Skills and Their Transferability:</strong>{" "}
              Defines skills as knowledge that gives a worker the ability to perform functions of a
              job acquired through performance of past relevant work (PRW). Skills must involve more
              than raw ability&mdash;they require learned judgment, techniques, or methods with a
              Specific Vocational Preparation (SVP) of 4 or higher.
            </li>
            <li>
              <strong className="text-foreground">SSR 83-10 through SSR 83-14:</strong>{" "}
              Physical exertion requirements and the interplay between strength levels and skill
              transferability at various age categories.
            </li>
            <li>
              <strong className="text-foreground">Advanced Age Rules:</strong>{" "}
              For workers of advanced age (55+) or closely approaching advanced age (50-54), SSA
              regulations require that transferable skills allow &ldquo;very little, if any,
              vocational adjustment&rdquo; in terms of tools, work processes, work settings, and
              industry.
            </li>
          </ul>
        </SubSection>
        <SubSection title="SVP and Skill Level Classification">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left p-2 border font-semibold">SVP</th>
                  <th className="text-left p-2 border font-semibold">Training Time</th>
                  <th className="text-left p-2 border font-semibold">Skill Level</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="p-2 border">1</td><td className="p-2 border">Short demonstration</td><td className="p-2 border">Unskilled</td></tr>
                <tr><td className="p-2 border">2</td><td className="p-2 border">Up to 30 days</td><td className="p-2 border">Unskilled</td></tr>
                <tr><td className="p-2 border">3</td><td className="p-2 border">30 days to 3 months</td><td className="p-2 border">Semi-skilled</td></tr>
                <tr><td className="p-2 border">4</td><td className="p-2 border">3 to 6 months</td><td className="p-2 border">Semi-skilled</td></tr>
                <tr><td className="p-2 border">5</td><td className="p-2 border">6 months to 1 year</td><td className="p-2 border">Skilled</td></tr>
                <tr><td className="p-2 border">6</td><td className="p-2 border">1 to 2 years</td><td className="p-2 border">Skilled</td></tr>
                <tr><td className="p-2 border">7</td><td className="p-2 border">2 to 4 years</td><td className="p-2 border">Skilled</td></tr>
                <tr><td className="p-2 border">8</td><td className="p-2 border">4 to 10 years</td><td className="p-2 border">Skilled</td></tr>
                <tr><td className="p-2 border">9</td><td className="p-2 border">Over 10 years</td><td className="p-2 border">Skilled</td></tr>
              </tbody>
            </table>
          </div>
        </SubSection>
      </Section>

      {/* ─── Section 3: Data Sources ─────────────────────────────────── */}
      <Section id="data-sources" number="3" title="Data Sources">
        <p>
          PVQ-TM integrates data from five authoritative public sources. Each data point in the
          analysis carries a provenance tag indicating which source supplied it.
        </p>
        <SubSection title="Dictionary of Occupational Titles (DOT)">
          <p>
            The DOT contains 12,726 occupation definitions scraped from{" "}
            <code className="bg-muted px-1 rounded text-foreground">occupationalinfo.org</code>,
            each with:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>DOT code (9-digit occupational classification)</li>
            <li>Title and industry designation</li>
            <li>GED levels: Reasoning (R), Math (M), Language (L) on a 1-6 scale</li>
            <li>SVP (Specific Vocational Preparation) level 1-9</li>
            <li>Strength requirement (S/L/M/H/V)</li>
            <li>DPT worker functions (Data/People/Things complexity levels 0-8)</li>
            <li>GOE (Guide for Occupational Exploration) code</li>
            <li>DLU (Date of Last Update)</li>
            <li>Occupational description</li>
          </ul>
          <p className="text-sm italic">
            Note: The DOT was last updated in 1991. While the occupational definitions remain the
            legal standard for SSA transferability determinations, PVQ-TM supplements DOT data
            with current O*NET data where available.
          </p>
        </SubSection>
        <SubSection title="O*NET (Occupational Information Network)">
          <p>
            O*NET provides current occupational data via the O*NET Web Services API, including:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Tasks and Detailed Work Activities (DWAs)</li>
            <li>Tools and technology requirements</li>
            <li>Knowledge, skills, and abilities with importance scores</li>
            <li>Work context and generalized work activities</li>
            <li>Job zones and SVP ranges</li>
            <li>Related occupations and career changers data</li>
          </ul>
        </SubSection>
        <SubSection title="BLS Occupational Requirements Survey (ORS)">
          <p>
            ORS provides statistically derived physical demand, environmental condition, and
            cognitive requirement data with standard errors. When available, ORS takes priority
            over DOT for trait demand estimation due to its statistical rigor and recency.
          </p>
        </SubSection>
        <SubSection title="BLS Occupational Employment and Wage Statistics (OEWS)">
          <p>
            OEWS provides employment counts, wage percentiles (10th, 25th, median, 75th, 90th),
            and mean wages by occupation and geographic area. Used for labor market scoring.
          </p>
        </SubSection>
        <SubSection title="RHAJ (Revised Handbook for Analyzing Jobs)">
          <p>
            RHAJ reference definitions provide the canonical descriptions for DPT worker functions,
            GED levels, SVP training times, GATB aptitudes, temperaments, physical demands, and
            environmental conditions. These definitions anchor the normalization functions.
          </p>
        </SubSection>
      </Section>

      {/* ─── Section 4: 24-Trait System ──────────────────────────────── */}
      <Section id="trait-system" number="4" title="24-Trait Worker Profile System">
        <p>
          The PVQ-TM trait system evaluates worker capacity and occupational demands across 24
          traits organized into three groups. Each trait is normalized to a common 0-4 scale.
        </p>
        <TraitTable />
        <SubSection title="Scale Interpretation">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left p-2 border font-semibold">Level</th>
                  <th className="text-left p-2 border font-semibold">Aptitude</th>
                  <th className="text-left p-2 border font-semibold">Physical</th>
                  <th className="text-left p-2 border font-semibold">Environmental</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="p-2 border font-mono">0</td><td className="p-2 border">Not Present</td><td className="p-2 border">Sedentary / Not Present</td><td className="p-2 border">None</td></tr>
                <tr><td className="p-2 border font-mono">1</td><td className="p-2 border">Low</td><td className="p-2 border">Light / Seldom</td><td className="p-2 border">Low</td></tr>
                <tr><td className="p-2 border font-mono">2</td><td className="p-2 border">Moderate</td><td className="p-2 border">Medium / Occasionally</td><td className="p-2 border">Moderate</td></tr>
                <tr><td className="p-2 border font-mono">3</td><td className="p-2 border">High</td><td className="p-2 border">Heavy / Frequently</td><td className="p-2 border">High</td></tr>
                <tr><td className="p-2 border font-mono">4</td><td className="p-2 border">Very High</td><td className="p-2 border">Very Heavy / Constantly</td><td className="p-2 border">Extreme</td></tr>
              </tbody>
            </table>
          </div>
        </SubSection>
        <SubSection title="Normalization Functions">
          <p>
            Each data source uses different native scales. PVQ-TM applies the following
            normalization functions to map all sources to the common 0-4 scale:
          </p>
          <NormalizationTable />
        </SubSection>
        <SubSection title="Source Priority Cascade">
          <p>
            When multiple data sources provide values for the same trait, PVQ-TM uses the
            following priority order: <strong className="text-foreground">ORS &gt; DOT &gt; O*NET</strong>.
            ORS takes priority because it provides statistically measured demand data with standard
            errors. Each trait in every analysis carries a source tag indicating its provenance.
          </p>
        </SubSection>
        <SubSection title="Worker Profile Types">
          <p>
            Each case maintains up to four profile rows:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong className="text-foreground">Work History Profile:</strong> Trait levels documented from past employment records</li>
            <li><strong className="text-foreground">Evaluative Profile:</strong> Trait levels from clinical evaluation (e.g., FCE)</li>
            <li><strong className="text-foreground">Pre-Injury Profile:</strong> Baseline trait levels before the date of injury</li>
            <li><strong className="text-foreground">Post-Injury Profile:</strong> Current residual functional capacity &mdash; this is the binding constraint used in all computations</li>
          </ul>
        </SubSection>
      </Section>

      {/* ─── Section 5: Workflow ──────────────────────────────────────── */}
      <Section id="workflow" number="5" title="Five-Step Analysis Workflow">
        <p>
          PVQ-TM follows a structured five-step workflow. Each step must complete before the next
          begins, ensuring proper data dependencies.
        </p>
        <div className="space-y-6 mt-4">
          {[
            {
              step: "1",
              title: "Document Past Relevant Work & Skills",
              desc: "Record the worker's past relevant work (PRW) history, including DOT codes, SVP levels, strength requirements, and duration. For each PRW entry, extract acquired skills using the structured format: action verb + object + context + tools/software + materials/services. Each skill is tagged with SVP level, evidence source, frequency, recency, and performance mode.",
            },
            {
              step: "2",
              title: "Generate Candidate Occupations",
              desc: "PVQ-TM uses a dual-search strategy to identify potential target occupations. The Legacy Search queries DOT work fields and MPSMS codes at the same or lower SVP level. The Current Search queries O*NET related occupations and career changers data. Results are merged, deduplicated, and filtered by the SVP gate (target SVP must not exceed source SVP).",
            },
            {
              step: "3",
              title: "Filter by Trait Feasibility",
              desc: "Each candidate occupation's trait demands (derived from DOT GED, strength, and available ORS data) are compared against the worker's post-injury profile across all 24 traits. Any occupation where demand exceeds capacity on even one trait is excluded. This is a hard gate with no exceptions.",
            },
            {
              step: "4",
              title: "Assess Vocational Adjustment",
              desc: "Surviving occupations are rated on four dimensions of vocational adjustment: tools, work processes, work setting, and industry. PVQ-TM provides data-driven auto-estimates based on GOE similarity, industry designation overlap, and O*NET tools/technology comparison. The evaluator may override any auto-estimated rating with a manual assessment.",
            },
            {
              step: "5",
              title: "Evaluate Labor Market Viability",
              desc: "For each surviving occupation, PVQ-TM retrieves current employment counts, wage data, and employment projections. These are scored against thresholds to assess whether the occupation represents a viable labor market option for the worker.",
            },
          ].map((s) => (
            <Card key={s.step}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Badge className="w-7 h-7 rounded-full flex items-center justify-center p-0 text-xs">
                    {s.step}
                  </Badge>
                  {s.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      {/* ─── Section 6: STQ ──────────────────────────────────────────── */}
      <Section id="stq" number="6" title="Skill Transfer Quotient (STQ)">
        <p>
          The STQ measures the degree of skill overlap between the worker&apos;s past relevant
          work and a target occupation. It combines five similarity dimensions using a weighted
          formula.
        </p>
        <FormulaCard
          title="STQ Formula"
          formula="STQ = 0.35 x taskDwaOverlap + 0.25 x wfMpsmsOverlap + 0.20 x toolsOverlap + 0.10 x materialsOverlap + 0.10 x credentialOverlap"
        >
          <p>Each component is scored 0-100. The weighted sum yields a composite STQ on the same scale.</p>
        </FormulaCard>
        <SubSection title="Component Details">
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-foreground">Task/DWA Overlap (35%):</strong>{" "}
              Jaccard similarity between the worker&apos;s acquired skill statements and the
              target occupation&apos;s O*NET tasks and detailed work activities (DWAs). Also
              includes DPT (Data-People-Things) worker function descriptors from DOT where
              available.
            </li>
            <li>
              <strong className="text-foreground">Work Field/MPSMS Overlap (25%):</strong>{" "}
              Jaccard similarity between the source and target DOT work field codes and
              Materials, Products, Subject Matter, and Services (MPSMS) codes.
            </li>
            <li>
              <strong className="text-foreground">Tools/Technology Overlap (20%):</strong>{" "}
              Token-level comparison between the worker&apos;s documented tools/software and the
              target occupation&apos;s O*NET tools and technology list.
            </li>
            <li>
              <strong className="text-foreground">Materials/Services Overlap (10%):</strong>{" "}
              Token-level comparison of materials, products, and services between source and
              target.
            </li>
            <li>
              <strong className="text-foreground">Credential/Knowledge Overlap (10%):</strong>{" "}
              Comparison of knowledge domains between the worker&apos;s background and the
              target occupation&apos;s O*NET knowledge requirements.
            </li>
          </ul>
        </SubSection>
        <SubSection title="SVP Gate">
          <p>
            Before STQ is computed, a hard SVP gate is applied: the target occupation&apos;s SVP
            must be equal to or lower than the highest SVP among the worker&apos;s past relevant
            work entries. If the gate fails, the occupation is excluded with STQ = 0.
          </p>
        </SubSection>
        <SubSection title="Multiple PRW Entries">
          <p>
            When a worker has multiple past relevant work entries, PVQ-TM computes STQ against
            each PRW entry independently and uses the highest-scoring match. This recognizes that
            different PRW entries may provide different transferable skills.
          </p>
        </SubSection>
      </Section>

      {/* ─── Section 7: TFQ ──────────────────────────────────────────── */}
      <Section id="tfq" number="7" title="Trait Feasibility Quotient (TFQ)">
        <p>
          The TFQ determines whether the worker can physically and cognitively perform the target
          occupation given their post-injury residual functional capacity.
        </p>
        <SubSection title="Hard Exclusion Gate">
          <p>
            For each of the 24 traits, the worker&apos;s post-injury capacity is compared against
            the occupation&apos;s demand level. If the demand exceeds capacity on <em>any single
            trait</em>, the occupation is excluded entirely. There are no partial credits or
            trade-offs between traits.
          </p>
          <FormulaCard
            title="Trait Comparison"
            formula="For each trait i: margin_i = worker_capacity_i - occupation_demand_i&#10;If margin_i < 0 for ANY trait: occupation is EXCLUDED"
          />
        </SubSection>
        <SubSection title="Reserve Margin Scoring">
          <p>
            Among occupations that survive the hard exclusion gate, TFQ is computed from the
            reserve margin&mdash;the average surplus capacity across all rated traits:
          </p>
          <FormulaCard
            title="TFQ Formula"
            formula="TFQ = (sum of margin_i / (count of rated traits x 4)) x 100"
          >
            <p>
              The maximum possible margin per trait is 4 (full scale range). TFQ is bounded 0-100,
              where higher values indicate greater reserve capacity.
            </p>
          </FormulaCard>
        </SubSection>
        <SubSection title="DOT-to-Trait Mapping">
          <p>
            PVQ-TM maps the following DOT fields to the 24-trait demand vector:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left p-2 border font-semibold">DOT Field</th>
                  <th className="text-left p-2 border font-semibold">Trait</th>
                  <th className="text-left p-2 border font-semibold">Normalization</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="p-2 border">GED Reasoning (R)</td><td className="p-2 border">Reasoning</td><td className="p-2 border font-mono text-xs">normalizeDOTGED()</td></tr>
                <tr><td className="p-2 border">GED Math (M)</td><td className="p-2 border">Math</td><td className="p-2 border font-mono text-xs">normalizeDOTGED()</td></tr>
                <tr><td className="p-2 border">GED Language (L)</td><td className="p-2 border">Language</td><td className="p-2 border font-mono text-xs">normalizeDOTGED()</td></tr>
                <tr><td className="p-2 border">Strength</td><td className="p-2 border">Strength</td><td className="p-2 border font-mono text-xs">normalizeDOTStrength()</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm italic mt-2">
            The remaining 20 traits are sourced from ORS when available, or marked as
            &ldquo;proxy&rdquo; (null) when no authoritative data exists. Null traits do not
            contribute to feasibility exclusion&mdash;only traits with measured demands can cause
            exclusion.
          </p>
        </SubSection>
      </Section>

      {/* ─── Section 8: VAQ ──────────────────────────────────────────── */}
      <Section id="vaq" number="8" title="Vocational Adjustment Quotient (VAQ)">
        <p>
          The VAQ measures how much vocational adjustment the worker would need to transition
          from their past relevant work to the target occupation. It assesses four dimensions
          per SSA policy.
        </p>
        <FormulaCard
          title="VAQ Formula"
          formula="VAQ = (tools + workProcesses + workSetting + industry) / 4"
        />
        <SubSection title="Rating Scale">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left p-2 border font-semibold">Score</th>
                  <th className="text-left p-2 border font-semibold">Label</th>
                  <th className="text-left p-2 border font-semibold">Meaning</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="p-2 border font-mono">100</td><td className="p-2 border">Very little or none</td><td className="p-2 border">Essentially the same tools/processes/setting/industry</td></tr>
                <tr><td className="p-2 border font-mono">67</td><td className="p-2 border">Slight</td><td className="p-2 border">Minor differences; worker can adapt quickly</td></tr>
                <tr><td className="p-2 border font-mono">33</td><td className="p-2 border">Moderate</td><td className="p-2 border">Meaningful differences requiring adaptation</td></tr>
                <tr><td className="p-2 border font-mono">0</td><td className="p-2 border">Substantial</td><td className="p-2 border">Fundamentally different; significant retraining needed</td></tr>
              </tbody>
            </table>
          </div>
        </SubSection>
        <SubSection title="Auto-Estimation Logic">
          <p>
            When the evaluator has not provided manual ratings, PVQ-TM auto-estimates each
            dimension from DOT and O*NET data:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong className="text-foreground">Tools:</strong> O*NET tools/technology overlap between source and target. &gt;75% overlap = 100, &gt;50% = 67, &gt;25% = 33, &le;25% = 0.</li>
            <li><strong className="text-foreground">Work Processes:</strong> GOE code comparison. Same GOE group (first 4 chars) = 100, same division (first 2 chars) = 67, different = 33.</li>
            <li><strong className="text-foreground">Work Setting:</strong> Industry designation comparison. Exact match = 100, shared significant words = 67, no overlap = 33.</li>
            <li><strong className="text-foreground">Industry:</strong> Broader sector comparison. Same primary sector = 100, any word overlap = 67, completely different = 33.</li>
          </ul>
          <p className="text-sm italic mt-2">
            Auto-estimated ratings are clearly marked in the output. The evaluator should review
            and may override any auto-estimated value with a manual assessment based on their
            professional judgment.
          </p>
        </SubSection>
        <SubSection title="Advanced Age Rule">
          <p>
            For workers of advanced age (55+) or closely approaching advanced age (50-54), SSA
            regulations require that transferable skills require &ldquo;very little, if any,
            vocational adjustment.&rdquo; In PVQ-TM, this means all four dimensions must score
            100. Any dimension below 100 results in exclusion of the target occupation.
          </p>
        </SubSection>
      </Section>

      {/* ─── Section 9: LMQ ──────────────────────────────────────────── */}
      <Section id="lmq" number="9" title="Labor Market Quotient (LMQ)">
        <p>
          The LMQ evaluates whether a target occupation has sufficient labor market viability
          to represent a realistic employment option for the worker.
        </p>
        <FormulaCard
          title="LMQ Formula"
          formula="LMQ = 0.40 x employmentScore + 0.35 x wageScore + 0.25 x projectionsScore"
        />
        <SubSection title="Employment Score (40% weight)">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left p-2 border font-semibold">Employment Level</th>
                  <th className="text-left p-2 border font-semibold">Score</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="p-2 border">&gt; 100,000</td><td className="p-2 border">100</td></tr>
                <tr><td className="p-2 border">&gt; 50,000</td><td className="p-2 border">80</td></tr>
                <tr><td className="p-2 border">&gt; 20,000</td><td className="p-2 border">60</td></tr>
                <tr><td className="p-2 border">&gt; 5,000</td><td className="p-2 border">40</td></tr>
                <tr><td className="p-2 border">&gt; 1,000</td><td className="p-2 border">20</td></tr>
                <tr><td className="p-2 border">&le; 1,000</td><td className="p-2 border">10</td></tr>
                <tr><td className="p-2 border">Unknown</td><td className="p-2 border">50 (neutral)</td></tr>
              </tbody>
            </table>
          </div>
        </SubSection>
        <SubSection title="Wage Score (35% weight)">
          <p>
            Compares the target occupation&apos;s median wage against the worker&apos;s prior
            earnings using a wage ratio:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left p-2 border font-semibold">Wage Ratio (target / prior)</th>
                  <th className="text-left p-2 border font-semibold">Score</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="p-2 border">&ge; 1.0 (same or better)</td><td className="p-2 border">100</td></tr>
                <tr><td className="p-2 border">&ge; 0.9</td><td className="p-2 border">80</td></tr>
                <tr><td className="p-2 border">&ge; 0.75</td><td className="p-2 border">60</td></tr>
                <tr><td className="p-2 border">&ge; 0.5</td><td className="p-2 border">40</td></tr>
                <tr><td className="p-2 border">&lt; 0.5</td><td className="p-2 border">20</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm mt-2">
            If no prior earnings are available, the score is based on absolute wage levels: &gt;$60K = 80, &gt;$40K = 60, &gt;$25K = 40, otherwise 20.
          </p>
        </SubSection>
        <SubSection title="Projections Score (25% weight)">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left p-2 border font-semibold">Condition</th>
                  <th className="text-left p-2 border font-semibold">Score</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="p-2 border">Growth &gt; 10% AND openings &gt; 10,000</td><td className="p-2 border">100</td></tr>
                <tr><td className="p-2 border">Growth &gt; 5% AND openings &gt; 5,000</td><td className="p-2 border">80</td></tr>
                <tr><td className="p-2 border">Growth &gt; 0% AND openings &gt; 1,000</td><td className="p-2 border">60</td></tr>
                <tr><td className="p-2 border">Other combinations</td><td className="p-2 border">40</td></tr>
                <tr><td className="p-2 border">Declining AND openings &lt; 1,000</td><td className="p-2 border">20</td></tr>
                <tr><td className="p-2 border">Unknown</td><td className="p-2 border">50 (neutral)</td></tr>
              </tbody>
            </table>
          </div>
        </SubSection>
      </Section>

      {/* ─── Section 10: PVQ ─────────────────────────────────────────── */}
      <Section id="pvq" number="10" title="PVQ Composite Score">
        <p>
          The PVQ is the final composite score that combines all four quotients into a single
          ranking metric. It is used <em>only</em> for ordering among occupations that have already
          passed all exclusion gates. The PVQ never overrides the legal rule structure.
        </p>
        <FormulaCard
          title="PVQ Formula"
          formula="PVQ = 0.45 x STQ + 0.25 x TFQ + 0.15 x VAQ + 0.15 x LMQ"
        >
          <p>Score range: 0-100. Higher is better.</p>
        </FormulaCard>
        <SubSection title="Weight Rationale">
          <ul className="list-disc pl-6 space-y-1">
            <li><strong className="text-foreground">STQ at 45%:</strong> Skill overlap is the primary determinant of transferability per SSA policy.</li>
            <li><strong className="text-foreground">TFQ at 25%:</strong> Physical/cognitive feasibility is the second most important factor&mdash;no transfer is possible if the worker cannot perform the job.</li>
            <li><strong className="text-foreground">VAQ at 15%:</strong> Vocational adjustment reflects the practical difficulty of transitioning.</li>
            <li><strong className="text-foreground">LMQ at 15%:</strong> Labor market viability ensures the occupation represents a real employment opportunity.</li>
          </ul>
        </SubSection>
        <SubSection title="Exclusion Gates">
          <p>
            Three sequential exclusion gates are evaluated before computing the PVQ composite.
            If any gate fails, the occupation is excluded with PVQ = 0:
          </p>
          <ol className="list-decimal pl-6 space-y-1">
            <li><strong className="text-foreground">Gate 1 &mdash; STQ/SVP:</strong> Target SVP must not exceed source SVP.</li>
            <li><strong className="text-foreground">Gate 2 &mdash; TFQ:</strong> Worker must meet or exceed all trait demands.</li>
            <li><strong className="text-foreground">Gate 3 &mdash; VAQ:</strong> For advanced-age cases, all adjustment dimensions must score 100.</li>
          </ol>
        </SubSection>
        <SubSection title="Confidence Grading">
          <p>
            Each PVQ result carries a confidence grade (A through D) reflecting the completeness
            of the underlying data:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left p-2 border font-semibold">Grade</th>
                  <th className="text-left p-2 border font-semibold">Meaning</th>
                  <th className="text-left p-2 border font-semibold">Criteria</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="p-2 border font-mono font-bold text-green-600">A</td><td className="p-2 border">Full data</td><td className="p-2 border">All primary sources available (ORS + OEWS + O*NET + DOT), 20+ traits rated, matched tasks/DWAs present</td></tr>
                <tr><td className="p-2 border font-mono font-bold text-blue-600">B</td><td className="p-2 border">Mostly complete</td><td className="p-2 border">Most data available, some proxy-derived values, 15+ traits rated</td></tr>
                <tr><td className="p-2 border font-mono font-bold text-yellow-600">C</td><td className="p-2 border">Significant gaps</td><td className="p-2 border">Multiple proxy-derived values, 10+ traits rated, partial wage/employment data</td></tr>
                <tr><td className="p-2 border font-mono font-bold text-red-600">D</td><td className="p-2 border">Minimal data</td><td className="p-2 border">Few rated traits, limited overlap data, missing labor market information</td></tr>
              </tbody>
            </table>
          </div>
        </SubSection>
      </Section>

      {/* ─── Section 11: Reproducibility ─────────────────────────────── */}
      <Section id="reproducibility" number="11" title="Reproducibility & Audit Trail">
        <p>
          A core design goal of PVQ-TM is that any qualified professional can independently
          verify and replicate any analysis. The following mechanisms ensure reproducibility.
        </p>
        <SubSection title="Data Version Stamps">
          <p>
            Every analysis records the versions of data sources used at the time of computation:
            O*NET version, ORS release, OEWS survey year, and the DOT data extraction date. This
            ensures that even as data sources are updated, prior analyses can be understood in the
            context of their original data.
          </p>
        </SubSection>
        <SubSection title="Source Tracking Per Trait">
          <p>
            Every trait comparison in TFQ includes a source tag (<code className="bg-muted px-1 rounded text-foreground">ORS</code>,{" "}
            <code className="bg-muted px-1 rounded text-foreground">DOT</code>,{" "}
            <code className="bg-muted px-1 rounded text-foreground">ONET</code>, or{" "}
            <code className="bg-muted px-1 rounded text-foreground">proxy</code>)
            indicating which data source provided the demand value. This allows reviewers to
            assess the provenance of each data point.
          </p>
        </SubSection>
        <SubSection title="STQ Detail Breakdown">
          <p>
            STQ results include the specific matched items for each component: matched tasks,
            matched DWAs, matched tools, matched materials, and matched knowledge domains. This
            allows line-by-line verification of the overlap computation.
          </p>
        </SubSection>
        <SubSection title="VAQ Manual vs. Auto-Estimated">
          <p>
            VAQ results clearly distinguish between evaluator-provided manual ratings and
            data-driven auto-estimates. Auto-estimated values include the underlying data used
            for estimation (GOE codes, industry designations, tool overlap percentages).
          </p>
        </SubSection>
        <SubSection title="Replication Steps">
          <p>
            To replicate a PVQ-TM analysis:
          </p>
          <ol className="list-decimal pl-6 space-y-1">
            <li>Obtain the same data versions recorded in the analysis metadata</li>
            <li>Enter the identical worker profile (24 traits, post-injury)</li>
            <li>Enter the identical PRW entries with DOT codes and acquired skills</li>
            <li>Run candidate generation with the same parameters</li>
            <li>Apply the formulas documented in Sections 6-10 above</li>
            <li>Results must match to within rounding tolerance (0.01)</li>
          </ol>
        </SubSection>
        <SubSection title="Open Source">
          <p>
            The PVQ-TM computation engine is implemented in TypeScript with all source code
            available for inspection. The normalization functions, similarity algorithms, scoring
            thresholds, and composite formulas are fully specified in the codebase and correspond
            exactly to the documentation in this article.
          </p>
        </SubSection>
      </Section>

      <Separator className="my-12" />

      <footer className="text-sm text-muted-foreground text-center pb-8">
        <p>
          PVQ-TM Methodology Document &mdash; Version 1.0
        </p>
        <p className="mt-1">
          This document describes a public, transparent methodology. All formulas and thresholds
          are published for independent verification and replication.
        </p>
      </footer>
    </div>
  );
}
