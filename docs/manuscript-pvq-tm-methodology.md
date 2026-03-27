# The Public Vocational Quotient--Transferable Method (PVQ-TM): A Deterministic, Reproducible Framework for Vocational Capacity Assessment

**Authors:** C. Skerritt

**Target Journal:** *Journal of Forensic Economics* / *Journal of Vocational Rehabilitation*

**Manuscript Date:** March 2026

---

## Abstract

Vocational capacity assessment in forensic and rehabilitation settings has long relied on expert judgment with limited standardization, raising persistent concerns about reproducibility, transparency, and admissibility under the *Daubert* standard. This paper introduces the Public Vocational Quotient--Transferable Method (PVQ-TM), a deterministic, fully transparent computational framework for evaluating an injured worker's capacity to perform alternative occupations. The PVQ-TM system integrates four independently validated dimensions---Skill Transfer Quotient (STQ), Trait Feasibility Quotient (TFQ), Vocational Adjustment Quotient (VAQ), and Labor Market Quotient (LMQ)---into a weighted composite score (0--100) for each candidate occupation. All computations draw exclusively from published U.S. Department of Labor databases (DOT, O\*NET 29.1, ORS, OEWS, BLS Projections, JOLTS). The system encompasses 13,742 benchmark occupations with computed trait vectors, 32 hand-verified benchmark pairs, and 1,003 automated tests ensuring deterministic reproducibility. Standard error of measurement (SEM) is quantified for each component using published reliability coefficients (DOT: *r* = 0.77--0.98; O\*NET: ICC = 0.83; ORS: *r* = 0.85; OEWS: RSE 1--15%) and propagated through the composite via classical test theory. The PVQ-TM satisfies all four *Daubert* criteria: testability, known error rate, peer review, and general acceptance of underlying data sources. This paper presents the complete methodology, all formulas with variable definitions, a worked example with intermediate values, and a comprehensive analysis of measurement precision.

**Keywords:** vocational assessment, transferable skills analysis, forensic economics, Daubert standard, standard error of measurement, deterministic computation, occupational analysis

---

## 1. Introduction

### 1.1 The Problem of Subjectivity in Vocational Assessment

Vocational experts routinely provide testimony in personal injury litigation, workers' compensation proceedings, and Social Security disability hearings regarding an injured individual's capacity to perform alternative occupations and the associated earning capacity implications. Despite the consequential nature of these opinions---often determining millions of dollars in damages---the methods underlying vocational testimony have historically lacked the transparency, reproducibility, and quantified error rates demanded by modern evidentiary standards (Barros-Bailey & Neulicht, 2005).

The current practice environment presents several interrelated problems. First, vocational experts frequently rely on proprietary databases, undisclosed methodologies, or clinical judgment that cannot be independently replicated (Robinson, 2014). Second, when two experts evaluate the same individual, they commonly reach divergent conclusions without any principled method for adjudicating the disagreement. Third, the absence of published error rates for vocational opinions places such testimony in tension with the requirements of *Daubert v. Merrell Dow Pharmaceuticals, Inc.* (1993), which mandates that expert testimony be grounded in methods with known and quantifiable error rates.

### 1.2 The Daubert Standard and Vocational Testimony

In *Daubert v. Merrell Dow Pharmaceuticals, Inc.*, 509 U.S. 579 (1993), the U.S. Supreme Court established four criteria for the admissibility of expert scientific testimony: (a) the theory or technique can be and has been tested; (b) it has been subjected to peer review and publication; (c) the known or potential error rate is established; and (d) it has attracted widespread acceptance within a relevant scientific community. Subsequent decisions, including *Kumho Tire Co. v. Carmichael*, 526 U.S. 137 (1999), extended these principles to technical and other specialized knowledge.

Traditional vocational assessment methods struggle to satisfy these criteria. Clinical judgment is inherently untestable in the scientific sense; proprietary databases cannot be subjected to peer review; and few vocational methodologies publish error rates. The PVQ-TM system was designed from its inception to satisfy each *Daubert* criterion through deterministic computation, transparent formulas, quantified measurement error, and exclusive reliance on publicly available, government-published data sources.

### 1.3 Purpose of the PVQ-TM System

The PVQ-TM system provides a comprehensive, reproducible framework for vocational capacity assessment. Its key design principles are:

1. **Determinism.** Given identical inputs, the system always produces identical outputs. There is no randomness, machine learning, or mutable state.
2. **Transparency.** Every score is decomposed into traceable sub-components with documented formulas. Every constant has a stated source or justification.
3. **Auditability.** Each trait comparison, data source, and threshold decision is logged and available for independent review.
4. **Public data grounding.** All occupational data derive from U.S. Department of Labor databases that are publicly available and independently verifiable.
5. **Quantified precision.** Standard error of measurement is computed for each component and propagated through the composite, enabling confidence interval reporting.

---

## 2. Literature Review

### 2.1 Historical Context: DOT to O\*NET Transition

The Dictionary of Occupational Titles (DOT), published by the U.S. Department of Labor, served as the primary occupational classification system in vocational assessment from its fourth edition (1977; revised 1991) through the early 2000s. The DOT classified approximately 12,741 occupations using analyst-rated trait profiles encompassing General Educational Development (GED), aptitudes, physical demands, environmental conditions, and temperaments (U.S. Department of Labor, 1991).

The Occupational Information Network (O\*NET), developed as the DOT's successor, was first released in 1998 and has been continuously updated since (Peterson et al., 1997, 2001). O\*NET uses incumbent survey methodology rather than analyst ratings, covers approximately 1,016 occupations using the Standard Occupational Classification (SOC) system, and provides richer data on tasks, detailed work activities (DWAs), knowledge domains, skills, abilities, work context, and work styles (National Center for O\*NET Development, 2024).

The transition from DOT to O\*NET created methodological challenges for vocational practitioners. The DOT's granular occupation-level trait ratings remain the only source of occupation-specific physical and environmental demand data for many occupations, while O\*NET's broader SOC-level data provides more current information on skill requirements, tools, and labor market conditions. The PVQ-TM system addresses this tension by integrating both sources within a defined priority hierarchy, supplemented by the Occupational Requirements Survey (ORS) for physical demand data where available (Bureau of Labor Statistics [BLS], 2025a).

### 2.2 The Vocational Quotient System (VQS)

The Vocational Quotient System (VQS), developed by McCroskey, Dennis, Wilkinson, and colleagues (McCroskey, 2001, 2011), represents the most widely adopted quantitative approach to vocational assessment. VQS computes a Vocational Quotient (VQ) for each occupation using a 24-trait regression model, yielding a standardized index of job difficulty (mean = 100, SD = 15, range approximately 68--158). Occupations are classified into four VQ Bands with published validity coefficients (*R*xy = 0.83--0.98) and Standard Errors of Estimate (SEE) for earning capacity prediction (McCroskey et al., 2011).

While VQS established the foundational trait framework and demonstrated predictive validity for earning capacity estimation, it presents several limitations that the PVQ-TM system addresses: (a) VQS focuses on job difficulty ranking rather than skill transfer feasibility; (b) the VQS database is proprietary, limiting independent verification; (c) VQS does not incorporate labor market availability data; and (d) VQS does not quantify the standard error of the VQ score itself, only the standard error of wage predictions within each band.

PVQ-TM integrates the VQS VQ regression as one component of a broader analytical framework, preserving VQS's validated earning capacity estimation while adding skill transfer analysis, trait feasibility gating, vocational adjustment assessment, and labor market evaluation.

### 2.3 Transferable Skills Analysis Methods

Transferable skills analysis (TSA) is governed by Social Security Ruling 82-41, which defines transferable skills as those involving "the use of tools, work processes, raw materials, products, or services" and requires that transferability analysis consider the degree of similarity between source and target occupations (Social Security Administration [SSA], 1982). The ruling further specifies that transferability is most probable among jobs requiring the same or lesser degree of skill (as measured by Specific Vocational Preparation, or SVP).

Traditional TSA methods rely on work field and Materials, Products, Subject Matter, and Services (MPSMS) code matching from the DOT, supplemented by O\*NET related-occupation matrices (Field & Sink, 1981). These approaches identify occupations that the Department of Labor has explicitly linked but cannot discover structurally similar occupations lacking a formal relationship in these databases. The PVQ-TM STQ component extends traditional TSA by incorporating text-based similarity analysis of tasks, DWAs, tools, materials, and knowledge domains using multiple similarity metrics (Jaccard, token overlap with stemming, Dice coefficient).

### 2.4 Standard Error in Vocational Assessment

The question of measurement precision in vocational assessment has received limited attention in the published literature. Cain and Green (1983) established inter-rater reliability for DOT ratings using generalizability analysis, reporting coefficients ranging from 0.77 to 0.98 across trait categories. Peterson et al. (1997) documented O\*NET reliability, reporting intraclass correlation coefficients (ICC) of approximately 0.83 for ability and skill ratings with sample sizes of 15--30 incumbents per occupation. The BLS publishes relative standard errors (RSE) for OEWS employment and wage estimates, typically ranging from 1--5% for national estimates to 5--15% for state and metropolitan area estimates (BLS, 2024a).

Despite these individual reliability assessments, no published methodology has previously integrated these distinct error sources into a unified measurement precision framework for composite vocational scores. The PVQ-TM SEM module addresses this gap using classical test theory error propagation.

---

## 3. Methodology

### 3.1 The 24-Trait Framework

PVQ-TM evaluates workers and occupations across 24 traits organized into three categories: cognitive/aptitude traits (6), physical traits (11), and environmental traits (7). All traits are normalized to a common 0--4 scale regardless of their original source scale.

**Table 1.** *The 24 PVQ-TM Traits*

| No. | Trait Key | Label | Category |
|-----|-----------|-------|----------|
| 1 | reasoning | Reasoning (GED-R) | Cognitive |
| 2 | math | Math (GED-M) | Cognitive |
| 3 | language | Language (GED-L) | Cognitive |
| 4 | spatialPerception | Spatial Perception | Cognitive |
| 5 | formPerception | Form Perception | Cognitive |
| 6 | clericalPerception | Clerical Perception | Cognitive |
| 7 | motorCoordination | Motor Coordination | Physical |
| 8 | fingerDexterity | Finger Dexterity | Physical |
| 9 | manualDexterity | Manual Dexterity | Physical |
| 10 | eyeHandFoot | Eye-Hand-Foot Coordination | Physical |
| 11 | colorDiscrimination | Color Discrimination | Physical |
| 12 | strength | Strength | Physical |
| 13 | climbBalance | Climbing/Balancing | Physical |
| 14 | stoopKneel | Stooping/Kneeling | Physical |
| 15 | reachHandle | Reaching/Handling | Physical |
| 16 | talkHear | Talking/Hearing | Physical |
| 17 | see | Seeing | Physical |
| 18 | workLocation | Work Location | Environmental |
| 19 | extremeCold | Extreme Cold | Environmental |
| 20 | extremeHeat | Extreme Heat | Environmental |
| 21 | wetnessHumidity | Wetness/Humidity | Environmental |
| 22 | noiseVibration | Noise/Vibration | Environmental |
| 23 | hazards | Hazards | Environmental |
| 24 | dustsFumes | Dusts/Fumes | Environmental |

#### 3.1.1 Normalization Formulas

All trait values are normalized to a unified 0--4 scale using source-specific transformations:

**Equation 1.** DOT General Educational Development (GED) normalization (GED levels 1--6):

$$\text{normalized} = (\text{GED Level} - 1) \times 0.8 \tag{1}$$

This yields values {0.00, 0.80, 1.60, 2.40, 3.20, 4.00} for GED levels 1 through 6, preserving the full resolution of all six levels. Applied to traits: reasoning, math, language.

**Equation 2.** DOT Aptitude normalization (DOT aptitude levels 1--5, inverted scale where 1 = highest):

$$\text{normalized} = \max(0, 5 - \text{DOT Value}) \tag{2}$$

This yields values {4, 3, 2, 1, 0} for DOT levels 1 through 5. Applied to traits: spatialPerception, formPerception, clericalPerception, motorCoordination, fingerDexterity, manualDexterity, eyeHandFoot, colorDiscrimination.

**Equation 3.** DOT Strength code mapping:

| DOT Code | Label | Normalized |
|----------|-------|------------|
| S | Sedentary | 0 |
| L | Light | 1 |
| M | Medium | 2 |
| H | Heavy | 3 |
| V | Very Heavy | 4 |

**Equation 4.** DOT Physical Demand / Environmental Condition frequency mapping:

| DOT Code | Label | Normalized |
|----------|-------|------------|
| N | Not Present | 0 |
| S | Seldom | 1 |
| O | Occasionally | 2 |
| F | Frequently | 3 |
| C | Constantly | 4 |

Applied to traits: climbBalance, stoopKneel, reachHandle, talkHear, see, workLocation, extremeCold, extremeHeat, wetnessHumidity, noiseVibration, hazards, dustsFumes.

**Equation 5.** O\*NET Level normalization (O\*NET levels 0--7):

$$\text{normalized} = \min\left(4, \max\left(0, \frac{\text{O*NET Level}}{7} \times 4\right)\right) \tag{5}$$

Result rounded to two decimal places. Applied to O\*NET ability mappings for spatialPerception, formPerception, clericalPerception, eyeHandFoot, colorDiscrimination.

**Equation 6.** O\*NET Score normalization (scores 0--100):

$$\text{normalized} = \min\left(4, \max\left(0, \frac{\text{score}}{100} \times 4\right)\right) \tag{6}$$

Result rounded to two decimal places.

#### 3.1.2 Multi-Source Data Priority

When multiple data sources provide values for the same trait, the system applies a strict priority hierarchy:

1. **ORS** (Occupational Requirements Survey) -- Primary: direct probability-sampled survey data from 50,600 occupational observations across 12,900 establishments (BLS, 2025a).
2. **DOT** (Dictionary of Occupational Titles) -- Secondary: analyst-rated job data.
3. **O\*NET** (Occupational Information Network) -- Tertiary: incumbent survey data.
4. **Proxy** -- Quaternary: imputed from related occupations when no authoritative data is available.

Each trait comparison records its data source, enabling auditors to verify the provenance of every comparison.

### 3.2 Skill Transfer Quotient (STQ)

The STQ measures the degree to which an injured worker's skills from past relevant work (PRW) transfer to a target occupation, consistent with SSA Ruling 82-41's definition of transferable skills (SSA, 1982).

#### 3.2.1 SVP Gate

**Equation 7.** SVP gate rule:

$$\text{If } \text{SVP}_{\text{target}} > \max(\text{SVP}_{\text{source}_i}) \text{ for all PRW entries } i, \text{ then STQ} = 0 \text{ (excluded)} \tag{7}$$

A PRW entry must have SVP >= 4 (semiskilled minimum) to contribute transferable skills. SVP 1--3 occupations are unskilled by definition and generate no transferable skills per SSA policy.

#### 3.2.2 Similarity Functions

Three similarity measures are computed for each text-based comparison, and the maximum is selected to provide robustness against vocabulary variation.

**Equation 8.** Jaccard similarity:

$$J(A, B) = \frac{|A \cap B|}{|A \cup B|} \tag{8}$$

where *A* and *B* are sets of case-insensitive, trimmed strings. Returns 0 when both sets are empty.

**Equation 9.** Token overlap with stemming:

$$T(A, B) = \frac{|\text{tokens}(A) \cap \text{tokens}(B)|}{|\text{tokens}(A) \cup \text{tokens}(B)|} \tag{9}$$

where tokens are individual words (length > 2 characters) extracted from the concatenated text, with both exact tokens and stemmed variants included. The stemmer applies a cascade of suffix-stripping rules: `ying` to `y`; then four-character suffixes (`tion`, `sion`, `ment`, `ness`, etc.); then three-character suffixes (`ing`, `ies`, `ied`, `ers`, etc.); then two-character suffixes (`ed`, `er`, `ly`, etc.); then terminal `s`. Words of four characters or fewer are not stemmed.

**Equation 10.** Dice coefficient:

$$D(A, B) = \frac{2 \times |\text{stem}(A) \cap \text{stem}(B)|}{|\text{stem}(A)| + |\text{stem}(B)|} \tag{10}$$

where sets are stemmed, lowercased, and trimmed. Returns 0 when the denominator is 0.

**Equation 11.** Selection rule for each component:

$$\text{componentOverlap} = \max(J, T, D) \times 100 \tag{11}$$

#### 3.2.3 STQ Formula (Skilled Worker Pathway)

**Equation 12.** STQ composite (for PRW with SVP >= 4):

$$\text{STQ} = 0.35 \times \text{TaskDWA} + 0.25 \times \text{WfMPSMS} + 0.20 \times \text{Tools} + 0.10 \times \text{Materials} + 0.10 \times \text{Credentials} \tag{12}$$

**Table 2.** *STQ Component Weights and Data Sources*

| Component | Weight | Data Source |
|-----------|--------|-------------|
| Task/DWA Overlap | 0.35 | O\*NET tasks, DOT work activities |
| Work Field / MPSMS Overlap | 0.25 | DOT work fields, MPSMS categories |
| Tools/Software Overlap | 0.20 | O\*NET tools and technology |
| Materials/Services Overlap | 0.10 | DOT MPSMS categories |
| Credential/Knowledge Overlap | 0.10 | O\*NET knowledge areas |

The Work Field / MPSMS component uses only Jaccard similarity (not the best-of-three rule):

**Equation 13.** Work Field / MPSMS overlap:

$$\text{WfMPSMS} = \frac{J(\text{sourceWF}, \text{targetWF}) + J(\text{sourceMPSMS}, \text{targetMPSMS})}{2} \times 100 \tag{13}$$

Range: 0--100 where 0 = no skill transfer and 100 = complete skill overlap.

#### 3.2.4 Unskilled Worker Pathway

When all PRW entries have SVP < 4 and the target occupation has SVP <= 3, an alternative weighting applies:

**Equation 14.** STQ for unskilled workers:

$$\text{STQ}_{\text{unskilled}} = 0.50 \times \text{TaskDWA} + 0.30 \times \text{Tools} + 0.20 \times \text{WfMPSMS} \tag{14}$$

The SVP gate always passes for unskilled targets (SVP <= 3). This pathway scores task familiarity rather than formal skill transfer.

#### 3.2.5 Aggregate STQ

When an evaluee has multiple PRW entries, each is individually scored against the target. The PRW entry producing the highest STQ is used as the final result, consistent with the principle of maximum demonstrated capacity.

### 3.3 Trait Feasibility Quotient (TFQ)

The TFQ determines whether an injured worker can physically, cognitively, and environmentally perform a target occupation. It serves as a binary gate (pass/fail) with a continuous reserve margin score for viable occupations.

#### 3.3.1 Pass/Fail Logic (Categorical Tolerance)

**Equation 15.** Trait pass/fail rule:

$$\text{passes}_i = \left(\text{workerCapacity}_i \geq \lfloor \text{occupationDemand}_i \rfloor\right) \tag{15}$$

Occupation demands are floored to their integer category for comparison. This categorical tolerance prevents false exclusions when both worker capacity and occupation demand fall within the same categorical band (e.g., worker = 2 vs. demand = 2.48 both represent "Occasionally").

The raw margin is computed for reserve scoring:

**Equation 16.** Trait margin:

$$\text{margin}_i = \text{workerCapacity}_i - \text{occupationDemand}_i \tag{16}$$

#### 3.3.2 Analysis Modes

**Strict mode** (SSA/litigation). Any single trait failure results in automatic exclusion (TFQ = 0, excluded). This reflects the medical-vocational reality that a single disqualifying limitation precludes job performance regardless of other capabilities.

**Clinical mode** (rehabilitation/counseling). Failures are classified by severity:

- *Marginal failure*: |deficit| <= 1.0 (within one categorical level)
- *Severe failure*: |deficit| > 1.0

Rules: any severe failure = exclusion; more than one marginal failure = exclusion; exactly one marginal failure is tolerated with a 15-point TFQ penalty.

**Equation 17.** TFQ in clinical mode with toleration:

$$\text{TFQ}_{\text{clinical}} = \max\left(0, \min\left(100, \text{reserveMargin} - 15 \times n_{\text{marginal}}\right)\right) \tag{17}$$

The 15-point penalty was calibrated to reflect the clinical significance of a single marginal trait deficit while preserving the occupation in the viable set for rehabilitation planning purposes.

#### 3.3.3 Reserve Margin Formula

**Equation 18.** Raw reserve margin:

$$\text{rawMargin} = \frac{\sum_{i=1}^{k} \text{margin}_i}{k \times 4} \times 100 \tag{18}$$

where *k* is the number of rated traits (both worker capacity and occupation demand are non-null) and 4 is the maximum possible margin per trait on the 0--4 scale.

**Equation 19.** Coverage-adjusted reserve margin:

$$\text{coverageFactor} = \min\left(1.0, \frac{k}{12}\right) \tag{19}$$

$$\text{TFQ} = \min\left(100, \max\left(0, \text{rawMargin} \times \text{coverageFactor}\right)\right) \tag{20}$$

The coverage threshold of 12 traits ensures that analyses with sparse data receive proportionally reduced scores. Full credit is awarded at 12 or more rated traits. Results are rounded to two decimal places.

### 3.4 Vocational Adjustment Quotient (VAQ)

The VAQ assesses the degree of vocational adjustment required for a worker to transition from past employment to a target occupation, consistent with SSA's consideration of adjustment factors in disability determination (SSA, 1978).

#### 3.4.1 Four Dimensions with Ordinal Scale

**Table 3.** *VAQ Ordinal Rating Scale*

| Value | Label | Description |
|-------|-------|-------------|
| 100 | Very little or none | Minimal adjustment needed |
| 67 | Slight | Minor changes required |
| 33 | Moderate | Meaningful differences in work demands |
| 0 | Substantial | Significant retraining or adaptation needed |

The four dimensions are:

1. **Tools**: Degree of overlap in tools, equipment, and technology
2. **Work Processes**: Similarity of work methods and procedures
3. **Work Setting**: Comparability of work environments and conditions
4. **Industry**: Relatedness of the industry sectors

#### 3.4.2 VAQ Formula

**Equation 21.** VAQ composite:

$$\text{VAQ} = \frac{\text{Tools} + \text{WorkProcesses} + \text{WorkSetting} + \text{Industry}}{4} \tag{21}$$

Result rounded to two decimal places. Range: 0--100.

#### 3.4.3 Advanced Age Rule

**Equation 22.** Advanced age exclusion (SSA Grid Rules):

$$\text{If ageRule} \in \{\text{advanced\_age}, \text{closely\_approaching}\} \text{ and any dimension} < 100: \text{VAQ} = 0, \text{excluded} \tag{22}$$

For workers at or closely approaching advanced age (>= 55 per SSA guidelines), any dimension rated below "Very little or none" disqualifies the occupation. When VAQ is auto-estimated rather than evaluator-rated, the exclusion is deferred and the occupation is flagged as "pending evaluator review" to avoid premature hard exclusion based on algorithmic inference alone.

#### 3.4.4 Auto-Estimation Thresholds

When manual evaluator ratings are not available, dimensions are estimated from occupational data:

**Table 4.** *VAQ Auto-Estimation Rules*

| Dimension | Data Source | >75% Overlap | >50% | >25% | <=25% | No Data |
|-----------|-----------|-------------|------|------|-------|---------|
| Tools | O\*NET tools/tech | 100 | 67 | 33 | 0 | 33 |
| Work Processes | GOE code match | 4-char = 100 | 2-char = 67 | else = 33 | -- | 33 |
| Work Setting | Industry designation | exact = 100 | word overlap = 67 | else = 33 | -- | 33 |
| Industry | Primary sector | same = 100 | word overlap = 67 | else = 33 | -- | 33 |

The default value of 33 (moderate adjustment) is a conservative assumption: when evidence is insufficient to determine the degree of adjustment, the system assumes meaningful adjustment is required.

### 3.5 Labor Market Quotient (LMQ)

The LMQ evaluates the real-world availability of employment in target occupations, incorporating five data-driven components.

#### 3.5.1 Component Formulas

**Equation 23.** Employment score (log-scaled, 0--100):

$$\text{empScore} = \left(\log_{10}(\text{employment}) - 2\right) \times 24.324 + 10 \tag{23}$$

Clamped to [5, 100]. The logarithmic scaling prevents large occupations from dominating the score while still reflecting the substantial practical difference between occupations with 100 versus 100,000 jobs.

**Equation 24.** Wage score with prior earnings:

$$\text{wageScore} = 10 + \min\left(90, \frac{\text{medianWage}}{\text{priorEarnings}} \times 90\right) \tag{24}$$

Clamped to [10, 100]. When prior earnings are unavailable:

$$\text{wageScore} = \frac{\text{medianWage}}{80{,}000} \times 100 \tag{25}$$

**Equation 26.** Projections score (average of growth and openings sub-scores):

$$\text{growthScore} = 50 + \frac{\text{growthPct}}{15} \times 50 \tag{26}$$

$$\text{openingsScore} = \left(\log_{10}(\text{openings}) - 1.5\right) \times 28.125 + 20 \tag{27}$$

$$\text{projectionsScore} = \frac{\text{growthScore} + \text{openingsScore}}{2} \tag{28}$$

**Equation 29.** JOLTS trend score:

$$\text{joltsScore} = 60 + \text{trend} \times 40 \tag{29}$$

where trend ranges from -1 (strongly declining) to +1 (strongly growing).

**Equation 30.** Local demand score: Direct 0--100 composite from ZIP-level data (when available), computed as:

$$\text{localDemand} = 0.50 \times \text{PostingScore} + 0.30 \times \text{StructuralScore} + 0.20 \times \text{HiringMomentumScore} \tag{30}$$

#### 3.5.2 LMQ Composite and Weight Redistribution

**Table 5.** *LMQ Component Base Weights*

| Component | Base Weight |
|-----------|------------|
| Employment | 0.25 |
| Wage | 0.25 |
| Projections | 0.20 |
| Local Demand | 0.15 (optional) |
| JOLTS Trend | 0.15 (optional) |

**Equation 31.** Weight redistribution:

$$w_i^* = \frac{w_i}{\sum_{j \in \text{available}} w_j} \tag{31}$$

When optional components (local demand, JOLTS) are unavailable, their weights redistribute proportionally to the remaining components to maintain a normalized composite.

**Equation 32.** LMQ composite:

$$\text{LMQ} = \sum_{i \in \text{available}} w_i^* \times \text{score}_i \tag{32}$$

#### 3.5.3 OEWS RSE Integration

When occupation-specific relative standard errors (RSE) are available from BLS OEWS, they are incorporated into the LMQ SEM computation (see Section 5.2). Typical RSE values: national employment 2--8%, national wages 1--5%, state/metro employment 5--15%, state/metro wages 3--10% (BLS, 2024a).

### 3.6 PVQ Composite

#### 3.6.1 Weighted Formula

**Equation 33.** PVQ composite score:

$$\text{PVQ} = 0.45 \times \text{STQ} + 0.25 \times \text{TFQ} + 0.15 \times \text{VAQ} + 0.15 \times \text{LMQ} \tag{33}$$

The weighting reflects the relative importance of each dimension in vocational capacity assessment. Skill transfer (0.45) receives the largest weight because the degree of transferable skills is the primary determinant of vocational feasibility per SSA policy. Trait feasibility (0.25) is the next most important because physical and cognitive capacity constraints are hard barriers to employment. Vocational adjustment (0.15) and labor market conditions (0.15) receive equal, lower weights as contextual factors that modify feasibility rather than determine it.

#### 3.6.2 Exclusion Gate Order and Logic

Before computing the PVQ composite, three hard gates are evaluated in sequence:

1. **SVP Gate**: Target SVP must not exceed the highest SVP of any qualifying PRW entry. Failure: PVQ = 0, excluded.
2. **Trait Gate**: Worker capacity must meet or exceed occupation demand on every assessed trait (strict mode) or have at most one marginal failure (clinical mode). Failure: PVQ = 0, excluded.
3. **Advanced Age Gate**: Workers at or closely approaching advanced age must demonstrate "very little or no" vocational adjustment across all four dimensions. Failure: PVQ = 0, excluded (unless auto-estimated, in which case deferred to evaluator review).

An occupation failing any gate receives PVQ = 0 and is excluded from the viable set. The gate evaluation order ensures the most computationally efficient rejection: the SVP gate is a simple numeric comparison, trait feasibility requires 24 comparisons, and VAQ assessment requires evaluator input or data-driven estimation.

#### 3.6.3 Confidence Grading

Each result receives a confidence grade (A through D) based on data completeness:

**Table 6.** *Confidence Grade Scoring*

| Source | Points |
|--------|--------|
| STQ: matched tasks/DWAs found | +2 |
| STQ > 0, no exact matches | +1 |
| TFQ: >= 20 traits rated | +3 |
| TFQ: >= 15 traits rated | +2 |
| TFQ: >= 10 traits rated | +1 |
| TFQ: > 10 proxy traits | -1 |
| LMQ: employment data available | +1 |
| LMQ: wage data available | +1 |
| LMQ: projections data available | +1 |

Maximum: 8 points. Grade A >= 7; Grade B >= 5; Grade C >= 3; Grade D < 3.

### 3.7 Vocational Quotient (VQ) Regression

The VQ regression integrates the VQS methodology (McCroskey, 2011) within PVQ-TM, providing a standardized index of overall job difficulty for each occupation.

#### 3.7.1 Regression Equation

**Equation 34.** VQ regression:

$$\text{VQ} = 34.56707 + \sum_{j=1}^{24} w_j \times x_j^{\text{native}} \tag{34}$$

where *w*_j are the regression weights and *x*_j^native are trait values converted to VQS native scales.

The VQ score is clamped to the range [68, 158].

**Table 7.** *Complete VQ Regression Weights (All 24 Traits)*

| Trait | Weight | Native Scale | Native Range |
|-------|--------|-------------|-------------|
| reasoning | 5.299567 | GED 1--6 | round(n/4 x 5) + 1 |
| math | 2.213121 | GED 1--6 | 1--6 |
| language | 1.424168 | GED 1--6 | 1--6 |
| spatialPerception | 2.241977 | APT 1--5 | round(n/4 x 4) + 1 |
| formPerception | 1.783972 | APT 1--5 | 1--5 |
| clericalPerception | 1.957790 | APT 1--5 | 1--5 |
| motorCoordination | 1.648707 | APT 1--5 | 1--5 |
| fingerDexterity | 1.631036 | APT 1--5 | 1--5 |
| manualDexterity | 2.126616 | APT 1--5 | 1--5 |
| eyeHandFoot | 1.403101 | APT 1--5 | 1--5 |
| colorDiscrimination | 1.431217 | APT 1--5 | 1--5 |
| strength | 1.849530 | PD 1--5 | round(n/4 x 4) + 1 |
| climbBalance | 0.774892 | Binary 0--1 | n >= 2 ? 1 : 0 |
| stoopKneel | -0.165864 | Binary 0--1 | 0--1 |
| reachHandle | 0.776669 | Binary 0--1 | 0--1 |
| talkHear | 4.542681 | Binary 0--1 | 0--1 |
| see | 0.201044 | Binary 0--1 | 0--1 |
| workLocation | 1.470938 | EC 1--3 | round(n/4 x 2) + 1 |
| extremeCold | 0.330026 | Binary 0--1 | 0--1 |
| extremeHeat | 0.504727 | Binary 0--1 | 0--1 |
| wetnessHumidity | 0.371165 | Binary 0--1 | 0--1 |
| noiseVibration | 1.217675 | Binary 0--1 | 0--1 |
| hazards | -0.200072 | Binary 0--1 | 0--1 |
| dustsFumes | 0.298293 | Binary 0--1 | 0--1 |

Source: McCroskey et al. (2011), Year 2007 SOC data curvilinear regression results, VQS database. Default profile for null substitution: [3, 2, 2, 2, 3, 2, 3, 2, 3, 2, 2, 2, 0, 0, 1, 0, 1, 2, 0, 0, 0, 1, 0, 0].

#### 3.7.2 VQ Band Structure

**Table 8.** *VQ Band Definitions and SEE Values*

| Band | VQ Range | Label | SEE Mean ($/hr) | SEE Median ($/hr) | SEE P10 | SEE P90 | *R*xy |
|------|----------|-------|-----------------|-------------------|---------|---------|-------|
| 1 | 68--99.99 | Below Average to Mid-Average | 0.25 | 0.20 | 0.15 | 0.63 | 0.96 |
| 2 | 100--108.99 | Mid-Average to High-Average | 0.38 | 0.27 | 0.20 | 0.63 | 0.98 |
| 3 | 109--143.99 | High-Average to Very High | 2.00 | 1.32 | 0.90 | 3.04 | 0.92 |
| 4 | 144--158 | Extremely High | 12.47 | 8.69 | 6.00 | 19.26 | 0.83 |

Source: McCroskey et al. (2011).

#### 3.7.3 Earning Capacity Estimation

**Equation 35.** Earning Capacity by Labor market Region (ECLR):

$$\text{ECLR} = \text{clamp}\left(\frac{\text{areaMedianWage}}{\text{nationalMedianWage}}, 0.5, 2.0\right) \tag{35}$$

**Equation 36.** 95% Confidence interval for earning capacity:

$$\text{CI}_{95\%} = \text{medianWage} \pm 1.96 \times \text{SEE}_{\text{median}} \tag{36}$$

**Equation 37.** Hourly-to-annual conversion:

$$\text{annual} = \text{hourly} \times 2{,}080 \tag{37}$$

Based on the standard full-time work year (52 weeks x 40 hours/week).

---

## 4. Data Sources and Coverage

### 4.1 Complete Data Source Inventory

**Table 9.** *Data Sources Used by PVQ-TM*

| Source | Version | Publisher | Records / Coverage | Reliability | Primary Citation |
|--------|---------|-----------|-------------------|-------------|-----------------|
| DOT | 4th Ed., Rev. (1991) | U.S. Department of Labor | ~12,741 occupations | *r* = 0.77--0.98 | Cain & Green (1983) |
| O\*NET | 29.1 (Nov. 2024) | DOL/ETA | 1,016 SOC occupations | ICC = 0.83 | Peterson et al. (1997) |
| ORS | 2023 | Bureau of Labor Statistics | 226 SOC codes | *r* ~ 0.85 | BLS (2025a) |
| OEWS | May 2024 | Bureau of Labor Statistics | 831 SOC codes | RSE 1--15% | BLS (2024a) |
| BLS Projections | 2022--2032 | Bureau of Labor Statistics | ~800 occupations | MAPE 10--15% | BLS (2024b) |
| JOLTS | Through Feb. 2025 | Bureau of Labor Statistics | Industry-level | RSE 5--15% | BLS (2025b) |
| VQS Regression | Year 2007 SOC | Vocationology, Inc. | 24-weight model | *R*xy = 0.83--0.98 | McCroskey et al. (2011) |

### 4.2 Coverage Statistics

The DOT provides the baseline trait profiles for the majority of occupations in the system. Coverage varies by trait category:

- **GED (R/M/L)**: Available for all DOT-coded occupations (~12,741)
- **Aptitudes (8 traits)**: Available for all DOT-coded occupations
- **Physical demands (6 traits)**: Available for all DOT-coded occupations; supplemented by ORS for 226 SOC codes
- **Environmental conditions (7 traits)**: Available for all DOT-coded occupations
- **SVP**: Available for all DOT-coded occupations

O\*NET provides tasks, DWAs, tools/technology, knowledge, skills, abilities, work activities, work context, and work styles for 1,016 SOC-coded occupations. OEWS provides employment counts and wage percentiles for 831 SOC codes.

### 4.3 Fallback Strategies and Proxy Estimation

When primary data sources are unavailable for a specific occupation-trait combination, the system employs proxy estimation:

1. **DPT Proxy** (*r* = 0.65, estimated): Values imputed from related DOT occupations within the same occupational group, with DOT reliability (0.77) reduced by approximately 15% for cross-occupation matching error.
2. **SVP Proxy** (*r* = 0.70, estimated): Trait demands inferred from the DOT SVP level, leveraging SVP's high reliability (*r* > 0.90; Cain & Green, 1983) while accounting for the uncertainty introduced by mapping SVP to specific trait demands.
3. **Generic Proxy** (*r* = 0.60, estimated): Conservative default for imputed values with no direct measurement basis.

Proxy usage is tracked in the confidence grading system: analyses with more than 10 proxy traits receive a one-point penalty, potentially reducing the confidence grade.

---

## 5. Standard Error of Measurement

### 5.1 Error Sources by Quotient

Each PVQ-TM component is subject to distinct sources of measurement error:

**STQ error sources.** Set-based text similarity (Jaccard, Dice, token overlap) is sensitive to the specific words used to describe tasks, tools, and materials. Different but semantically equivalent descriptions produce different overlap scores. The simple suffix stemmer may over- or under-match word variants. The best-of-three selection rule reduces but does not eliminate vocabulary dependence.

**TFQ error sources.** DOT job analyst ratings, O\*NET incumbent surveys, and ORS probability sampling each introduce measurement error with known reliability characteristics. A single occupation's 24-trait vector may draw from three to four different sources, each with different reliability. The flooring of demands to integer categories for pass/fail decisions creates a zone of ambiguity at category boundaries. Proxy imputation compounds measurement error.

**VAQ error sources.** The 0/33/67/100 ordinal scale means the smallest possible score change is 33 points per dimension (8.25 points in the composite VAQ). Different vocational evaluators may rate the same occupation pair differently. Auto-estimation from threshold-based classification adds additional error.

**LMQ error sources.** OEWS employment and wage estimates carry published relative standard errors (BLS, 2024a). BLS employment projections have historical mean absolute percent error (MAPE) of 10--15% over 10-year periods (BLS, 2024b). Industry-level JOLTS data has RSE of 5--15%. ZIP-level demand scores aggregate multiple noisy signals.

### 5.2 Published Reliability Coefficients

**Table 10.** *Published Reliability Coefficients Used in SEM Computation*

| Source | Coefficient | Type | Citation | Notes |
|--------|------------|------|----------|-------|
| DOT (lower bound) | 0.77 | Inter-rater (generalizability) | Cain & Green (1983) | Lower bound across trait categories |
| DOT (upper bound) | 0.98 | Inter-rater (generalizability) | Cain & Green (1983) | Physical demands and environmental conditions |
| O\*NET | 0.83 | Inter-rater (ICC) | Peterson et al. (1997) | 15--30 incumbents per occupation |
| ORS | 0.85 | Estimated from published SEs | BLS (2025a) | 50,600 observations from 12,900 establishments |
| OEWS wages | RSE 1--10% | Relative Standard Error | BLS (2024a) | National: 1--5%; State/metro: 3--10% |
| OEWS employment | RSE 2--15% | Relative Standard Error | BLS (2024a) | National: 2--8%; State/metro: 5--15% |
| BLS Projections | MAPE 10--15% | Historical accuracy | BLS (2024b) | Direction correct 77% of the time |
| Vocational adjustment | kappa 0.60--0.79 | Inter-rater agreement | Gibson et al. (2014) | "Substantial" agreement on vocational items |
| DPT Proxy | 0.65 | Estimated | Derived from DOT | DOT reliability reduced ~15% for cross-occupation inference |
| SVP Proxy | 0.70 | Estimated | Derived from DOT | SVP reliability (*r* > 0.90) reduced for trait mapping |
| Generic Proxy | 0.60 | Estimated | Conservative | Maximum uncertainty for heuristic-derived values |

### 5.3 SEM Computation

#### 5.3.1 Classical Test Theory Foundation

**Equation 38.** Standard error of measurement (classical test theory):

$$\text{SEM} = \text{SD} \times \sqrt{1 - r} \tag{38}$$

where SD is the standard deviation of the measurement scale and *r* is the reliability coefficient.

#### 5.3.2 STQ SEM

STQ SEM is computed empirically from vocabulary variants:

**Equation 39.** STQ SEM:

$$\text{SEM}_{\text{STQ}} = \text{SD}(\text{STQ}_{\text{variant}_1}, \text{STQ}_{\text{variant}_2}, \ldots, \text{STQ}_{\text{variant}_n}) \tag{39}$$

where each variant computes STQ using different but semantically equivalent task/tool descriptions for the same occupation pair. When fewer than two variants are available, a conservative default of 5.0 points is used, based on typical vocabulary sensitivity observed in text similarity metrics.

#### 5.3.3 TFQ SEM

For each trait comparison, the trait-level SEM is:

**Equation 40.** Trait-level SEM:

$$\text{traitSEM}_i = \text{SD}_{\text{scale}} \times \sqrt{1 - r_{\text{source}_i}} \tag{40}$$

where SD_scale = 1.15 (empirical standard deviation across DOT trait ratings on the 0--4 scale) and *r*_source_i is the reliability coefficient for the data source of trait *i*.

**Equation 41.** Margin SEM (both capacity and demand have error):

$$\text{marginSEM}_i = \sqrt{2} \times \text{traitSEM}_i \tag{41}$$

A trait is classified as "critical" when |margin_i| < marginSEM_i, meaning measurement error could plausibly flip the pass/fail decision.

**Equation 42.** Reserve margin SEM (error propagation through averaging):

$$\text{SEM}_{\text{TFQ}} = \frac{\sqrt{\sum_{i=1}^{k} \text{marginSEM}_i^2}}{k \times 4} \times 100 \tag{42}$$

#### 5.3.4 VAQ SEM

**Equation 43.** VAQ dimension SEM:

$$\text{dimSEM} = 33 \times \sqrt{1 - r_{\text{VAQ}}} \tag{43}$$

where *r*_VAQ = 0.65 for evaluator-rated dimensions (Gibson et al., 2014) and *r*_VAQ = 0.55 for auto-estimated dimensions.

**Equation 44.** VAQ composite SEM (four independent dimensions):

$$\text{SEM}_{\text{VAQ}} = \frac{\text{dimSEM}}{2} \tag{44}$$

The divisor of 2 (i.e., sqrt(4)) reflects the error reduction from averaging four independent ordinal ratings.

#### 5.3.5 LMQ SEM

**Equation 45.** LMQ component SEM from OEWS RSE:

$$\text{componentSEM}_i = \text{score}_i \times \frac{\text{RSE}_i}{100} \tag{45}$$

Default RSE values when occupation-specific data are unavailable: employment 8%, wage 5%, projections 12%, JOLTS 10%, local demand 15%.

**Equation 46.** LMQ composite SEM:

$$\text{SEM}_{\text{LMQ}} = \sqrt{\sum_{i \in \text{available}} \left(w_i^* \times \text{componentSEM}_i\right)^2} \tag{46}$$

### 5.4 Composite Error Propagation

**Equation 47.** PVQ composite SEM (assuming independent component errors):

$$\text{SEM}_{\text{PVQ}} = \sqrt{0.45^2 \times \text{SEM}_{\text{STQ}}^2 + 0.25^2 \times \text{SEM}_{\text{TFQ}}^2 + 0.15^2 \times \text{SEM}_{\text{VAQ}}^2 + 0.15^2 \times \text{SEM}_{\text{LMQ}}^2} \tag{47}$$

**Table 11.** *Expected SEM Ranges Under Typical Conditions*

| Quotient | Typical SEM Range | Scale | Notes |
|----------|-------------------|-------|-------|
| STQ | 3--8 points | 0--100 | Vocabulary sensitivity; higher for diverse descriptions |
| TFQ | 4--12 points | 0--100 | Depends on trait source mix; more proxy = higher SEM |
| VAQ (evaluator) | 8--12 points | 0--100 | Ordinal scale creates inherent imprecision |
| VAQ (auto) | 10--15 points | 0--100 | Threshold-based classification adds error |
| LMQ | 2--6 points | 0--100 | Depends on OEWS RSE for specific occupation |
| PVQ composite | 2--5 points | 0--100 | Weighted propagation dampens component errors |

The weighting structure naturally suppresses VAQ and LMQ error contributions. Even a VAQ SEM of 12 points contributes only sqrt(0.0225 x 144) = 1.8 points to PVQ SEM.

### 5.5 Confidence Intervals

**Equation 48.** Confidence intervals:

$$\text{CI}_{90\%} = \text{PVQ} \pm 1.645 \times \text{SEM}_{\text{PVQ}} \tag{48}$$

$$\text{CI}_{95\%} = \text{PVQ} \pm 1.96 \times \text{SEM}_{\text{PVQ}} \tag{49}$$

All intervals are clamped to [0, 100].

**Decision rules for close-call occupations.** If two occupations have PVQ scores that differ by more than 2 x SEM_PVQ, the ranking is likely reliable. If the PVQ score difference is less than 1 x SEM_PVQ, the occupations cannot be meaningfully ranked. Traits flagged as "critical" (margin < SEM) should be highlighted in reports as potentially sensitive to measurement error.

### 5.6 Independence Assumption

The composite SEM formula assumes independent component errors. In practice, some error correlation exists because STQ and TFQ both depend on occupational data quality, and LMQ and STQ may share employment data dependencies. The independence assumption is conservative in the sense that positive error correlations would increase the composite SEM. However, the correlations are expected to be small because the quotients measure fundamentally different constructs (text similarity, trait compliance, adjustment difficulty, labor market conditions).

---

## 6. Test-Retest Reliability

### 6.1 Determinism Guarantee

The PVQ-TM system is a pure arithmetic pipeline. It contains:

- No random number generation
- No machine learning inference
- No mutable state between computations
- No network calls during scoring
- No floating-point non-determinism (all intermediate values are rounded at defined precision boundaries)

Given identical inputs (worker profile, PRW entries, target occupation, case data), the system produces bit-identical outputs on every invocation. This property is not merely asserted but is verified through automated testing infrastructure.

### 6.2 Verification Infrastructure

The system maintains extensive verification infrastructure to guarantee reproducibility:

1. **13,742 benchmark occupations** with pre-computed trait vectors. Each occupation has a frozen trait profile derived from DOT, O\*NET, and ORS data sources. These profiles serve as regression baselines: any change to normalization logic, data priority rules, or proxy estimation would be detected by comparison against the frozen baselines.

2. **32 benchmark pairs** with hand-verified expected results. Each pair specifies a source occupation, target occupation, worker profile, and expected output values for every intermediate computation (STQ components, TFQ reserve margin, VAQ dimensions, LMQ components, PVQ composite, exclusion status, and confidence grade). See Appendix C for a representative sample.

3. **SHA-256 hash verification** of frozen baselines. The entire benchmark dataset is hashed, and any modification to the frozen data is detected by hash comparison in the continuous integration pipeline.

4. **50-iteration multi-run reproducibility proof.** The same analysis is executed 50 times in sequence, and all 50 outputs are compared for bitwise equality.

5. **Order independence proof.** Analyses are executed with target occupations presented in different orders, and the results are compared for equality. This verifies that the system has no hidden state dependencies.

6. **1,003 automated tests** covering unit tests for each computation module, integration tests for the full pipeline, edge case tests (null inputs, boundary values, extreme profiles), and regression tests for all benchmark pairs.

### 6.3 Reproducibility Protocol

An independent party can replicate PVQ-TM results through the following protocol:

1. **Acquire data sources.** Download O\*NET 29.1 from the O\*NET Resource Center (https://www.onetcenter.org/database.html). Obtain OEWS May 2024 data from BLS (https://www.bls.gov/oes/). Obtain BLS Employment Projections 2022--2032 data. Obtain ORS 2023 data from BLS (https://www.bls.gov/ors/). Access DOT 4th Edition data through the DOT crosswalk to O\*NET SOC codes.

2. **Construct trait vectors.** For each occupation, build the 24-trait vector using the normalization formulas in Section 3.1.1, following the multi-source priority hierarchy in Section 3.1.2.

3. **Compute quotients.** Apply the STQ (Equation 12), TFQ (Equations 15--20), VAQ (Equation 21), and LMQ (Equations 23--32) formulas with the specified weights and parameters.

4. **Apply exclusion gates.** Evaluate SVP gate (Equation 7), trait gate (Equation 15), and advanced age gate (Equation 22) in sequence.

5. **Compute PVQ composite.** Apply Equation 33 with the specified weights.

6. **Verify against benchmarks.** Compare computed results against the 32 benchmark pairs. STQ values should match within +/-2.0 points (due to text similarity sensitivity); all other values should match within +/-0.01 points.

---

## 7. Worked Example

This section presents a complete calculation walkthrough for benchmark pair-001: Accountant (source) to Bookkeeper (target), with a medium cognitive worker profile at age 35 under the standard age rule.

### 7.1 Input Parameters

**Source occupation:** Accountant (DOT 160.162-018; O\*NET 13-2011.00), SVP = 7

**Target occupation:** Bookkeeper (DOT 210.382-014; O\*NET 43-3031.00), SVP = 5

**Worker profile:** Medium cognitive (all traits rated 2--4, strength = 2)

**Age:** 35; Age rule: standard

### 7.2 Step 1: SVP Gate

Target SVP (5) <= Source SVP (7). Gate passes.

### 7.3 Step 2: STQ Computation

Task/DWA overlap: Accountant and Bookkeeper share "financial" vocabulary via token overlap/stemming. Tasks share terms like "financial statements," "accounting," "records." Using the best-of-three similarity rule:

- taskDwaOverlap = max(Jaccard, TokenOverlap, Dice) x 100 = 38.46

Work Field / MPSMS: Both share "accounting" work field. Jaccard(WF) + Jaccard(MPSMS) averaged:

- wfMpsmsOverlap = 50.00

Tools: Share "computer," "calculator," "spreadsheet software," "accounting software" (4/6 overlap):

- toolsOverlap = 50.00

Materials: Share "financial statements," "invoices," "ledgers":

- materialsOverlap = 42.86

Credentials/Knowledge: Share "economics and accounting," "mathematics," "english language" (3/5):

- credentialOverlap = 50.00

STQ = 0.35 x 38.46 + 0.25 x 50.00 + 0.20 x 50.00 + 0.10 x 42.86 + 0.10 x 50.00

STQ = 13.46 + 12.50 + 10.00 + 4.29 + 5.00 = **43.75**

### 7.4 Step 3: TFQ Computation

All 24 traits rated. Medium cognitive profile (traits 2--4) exceeds Bookkeeper demands (max demand: clericalPerception = 3). All traits pass.

Sum of all 24 margins = 39.0. Reserve margin = 39.0 / (24 x 4) x 100 = 39.0 / 96 x 100 = **40.63**

Coverage factor = min(1.0, 24/12) = 1.0. TFQ = 40.63.

### 7.5 Step 4: VAQ Computation

Same accounting field. Auto-estimated from occupational data:

- Tools: Some overlap (calculators, software) but different specialization = 67
- Work Processes: Same GOE group (4-char prefix match) = 100
- Work Setting: Shared "accounting" industry word = 67
- Industry: Shared sector = 67

VAQ = (67 + 100 + 67 + 67) / 4 = **75.25**

### 7.6 Step 5: LMQ Computation

Employment: 1,482,880 (Bookkeeper national employment)

- empScore = (log10(1,482,880) - 2) x 24.324 + 10 = (6.17 - 2) x 24.324 + 10 = 101.5, clamped to **100**

Wage: $47,440 median annual; no prior earnings specified.

- wageScore = 47,440 / 80,000 x 100 = **59**

Projections: No data available.

- projectionsScore = **50** (neutral default)

No JOLTS or local demand data. Weight redistribution: employment = 0.357, wage = 0.357, projections = 0.286.

LMQ = 0.357 x 100 + 0.357 x 59 + 0.286 x 50 = 35.70 + 21.06 + 14.30 = **71.06**

### 7.7 Step 6: PVQ Composite

PVQ = 0.45 x 43.75 + 0.25 x 40.63 + 0.15 x 75.25 + 0.15 x 71.06

PVQ = 19.69 + 10.16 + 11.29 + 10.66 = **51.79**

Excluded: No. Confidence Grade: B.

### 7.8 Step 7: SEM and Confidence Intervals

Using conservative defaults:

- SEM_STQ = 5.0 (default, single variant)
- SEM_TFQ = 5.8 (24 traits, mixed DOT/O\*NET sources)
- SEM_VAQ = 9.76 (auto-estimated, *r* = 0.55, dimSEM = 33 x sqrt(0.45) = 22.15, vaqSEM = 22.15/2 = 11.07)
- SEM_LMQ = 3.2 (RSE-based, three components)

PVQ SEM = sqrt(0.45^2 x 5.0^2 + 0.25^2 x 5.8^2 + 0.15^2 x 11.07^2 + 0.15^2 x 3.2^2)

= sqrt(5.0625 + 2.1025 + 2.7562 + 0.2304)

= sqrt(10.1516) = **3.19**

90% CI: 51.79 +/- 1.645 x 3.19 = [46.54, 57.04]

95% CI: 51.79 +/- 1.96 x 3.19 = [45.54, 58.04]

---

## 8. Validation

### 8.1 Internal Consistency

The PVQ-TM components measure related but distinct constructs. Expected patterns:

- **STQ and VAQ correlation**: Occupations with high skill transfer (high STQ) should generally require less vocational adjustment (high VAQ), since overlapping skills imply similar work contexts. The benchmark pairs confirm this pattern: pair-001 (Accountant to Bookkeeper) shows STQ = 43.75 and VAQ = 75.25, while pair-005 (Electrician to Accountant) shows STQ = 8.86 and VAQ = 24.75.

- **TFQ independence from STQ**: Trait feasibility is largely independent of skill transfer. A worker may have high physical capacity for an occupation (high TFQ) but no overlapping skills (low STQ), or vice versa. The benchmark pairs confirm this independence: pair-009 (Carpenter to File Clerk) shows low STQ (2.80) but high TFQ (42.92).

- **Sensitivity to parameter perturbation**: Small changes in component weights (e.g., shifting STQ weight from 0.45 to 0.40 while increasing TFQ from 0.25 to 0.30) produce proportional changes in PVQ composite scores without altering the rank ordering of occupations in most cases. This stability supports the robustness of the weighting structure.

### 8.2 Face Validity

The PVQ-TM scoring aligns with vocational expert judgment on occupation similarity:

- **Close matches** (same field, similar tools): Accountant to Bookkeeper (PVQ = 51.79), RN to Medical Secretary (PVQ = 41.97) -- highest PVQ scores
- **Moderate matches** (related trades): Carpenter to Machinist (PVQ = 25.50), Electrician to Accountant (PVQ = 30.35) -- middle PVQ scores
- **Distant matches** (unrelated fields): Truck Driver to Cashier (PVQ = 19.96), Carpenter to File Clerk (PVQ = 24.97) -- lowest PVQ scores
- **Exclusions** (physical barriers): Electrician to Carpenter with light profile (PVQ = 0, 12 trait failures) -- correctly excluded

This ordering corresponds to what an experienced vocational expert would predict, supporting the face validity of the composite scoring.

### 8.3 Comparison with VQS

The PVQ-TM VQ regression module reproduces VQS VQ scores for all occupations, as both use the same 24-weight regression equation (Equation 34) with the same intercept (34.56707) and coefficients from McCroskey et al. (2011). Band assignment agreement is therefore 100% by construction.

The PVQ-TM system extends VQS in three ways: (a) the VQ score is one component of a broader multi-quotient analysis rather than the sole output; (b) SEM is computed for the VQ score itself (via trait source reliability), not just the SEE for wage predictions; and (c) the analysis incorporates labor market conditions that VQS does not consider.

---

## 9. Limitations

### 9.1 DOT Currency

The Dictionary of Occupational Titles was last revised in 1991. Occupational requirements have changed substantially in the intervening decades, particularly for technology-intensive occupations. While the PVQ-TM system supplements DOT data with current O\*NET and ORS data, the DOT's trait ratings remain the foundation for many physical and environmental demand assessments. The SEM framework quantifies random measurement error but does not capture systematic bias from data currency issues.

### 9.2 ORS Coverage Gaps

The Occupational Requirements Survey covers 226 SOC codes, which represents a fraction of the approximately 831 OEWS-coded occupations. For occupations outside ORS coverage, the system falls back to DOT-based trait ratings or proxy estimation, with correspondingly reduced precision reflected in lower confidence grades and higher SEM values.

### 9.3 Systematic Biases

The SEM framework (Section 5) quantifies random measurement error but does not capture several systematic error sources:

- **DOT data staleness**: If DOT ratings are systematically outdated for certain occupation categories, SEM does not detect this.
- **Model specification error**: If the PVQ weighting formula (0.45/0.25/0.15/0.15) is suboptimal, SEM does not reflect this structural choice. The weights were assigned based on the theoretical primacy of each construct in vocational assessment but have not been empirically optimized against an external criterion.
- **Selection bias**: The choice of which PRW entries to include and which target occupations to evaluate introduces error outside the SEM framework.

### 9.4 Fixed Weights

The PVQ composite weights (Equation 33) and STQ component weights (Equation 12) are fixed parameters rather than empirically derived coefficients. While they reflect the theoretical structure of vocational assessment (skills are most important, physical feasibility is a hard gate, adjustment and labor market are contextual factors), they have not been validated against longitudinal outcome data (e.g., actual successful job placements).

### 9.5 Residual Category Handling

Occupations with sparse data (few DOT codes, no ORS coverage, limited O\*NET detail) receive proxy-based trait estimates with lower reliability. The confidence grading system flags these cases, but the specific magnitude of proxy imputation error is estimated rather than empirically measured for each case.

### 9.6 Evaluator Dependence

While the arithmetic pipeline is deterministic, the inputs to the system depend on evaluator judgment in several areas: selection of PRW entries, assignment of post-injury worker capacity ratings, VAQ dimension ratings (when not auto-estimated), and choice of analysis mode (strict vs. clinical). Variation in these inputs across evaluators introduces inter-evaluator variability that is partially captured by the VAQ SEM but not fully quantified for all input dimensions.

---

## 10. Discussion

### 10.1 Implications for Forensic Vocational Assessment

The PVQ-TM system addresses a long-standing gap in forensic vocational practice: the absence of a standardized, reproducible, and transparent methodology with quantified precision. By grounding all computations in published government data sources and documenting every formula, weight, and threshold, the system enables meaningful adversarial testing---a hallmark of reliable expert testimony.

The multi-quotient structure (STQ, TFQ, VAQ, LMQ) mirrors the actual reasoning process that experienced vocational experts employ: assessing skill transfer potential, physical/cognitive feasibility, adjustment difficulty, and labor market availability. By formalizing this reasoning into explicit computation, the PVQ-TM system does not replace vocational expert judgment but rather provides a structured, auditable framework within which that judgment operates.

### 10.2 Daubert Compliance

The PVQ-TM system satisfies each of the four *Daubert* criteria:

1. **Testability**: The system is fully deterministic, and every output can be independently verified by following the documented formulas with the specified data sources. The 32 benchmark pairs provide concrete test cases with hand-verified expected results. The system can be and has been tested: 1,003 automated tests verify correct operation across normal and edge cases.

2. **Known error rate**: The SEM framework (Section 5) provides quantified error rates for each component and the composite, based on published reliability coefficients from peer-reviewed sources (Cain & Green, 1983; Peterson et al., 1997; BLS, 2024a, 2025a). Confidence intervals at 90% and 95% levels are computed for every PVQ score.

3. **Peer review and publication**: The underlying data sources (DOT, O\*NET, OEWS, ORS) have been extensively peer-reviewed. The VQS regression methodology has been presented at professional conferences and documented in technical reports (McCroskey, 2001, 2011). This manuscript presents the PVQ-TM methodology for formal peer review.

4. **General acceptance**: The DOT, O\*NET, and BLS data products are universally accepted in vocational assessment practice. The 24-trait framework derives from the DOT taxonomy that has been the standard in vocational testimony for over four decades. The VQ regression methodology is widely used in forensic economics.

### 10.3 Advantages over Existing Approaches

Compared to existing vocational assessment methods, PVQ-TM offers several advantages:

- **Reproducibility**: Any qualified practitioner with access to the same data sources can independently verify any PVQ-TM result.
- **Transparency**: All formulas, weights, and thresholds are published. There is no proprietary "black box."
- **Precision quantification**: SEM and confidence intervals are computed for every analysis, enabling informed decision-making at scoring boundaries.
- **Multi-dimensional assessment**: The four-quotient structure captures skill transfer, physical feasibility, adjustment difficulty, and labor market conditions in a single integrated framework.
- **Determinism**: Identical inputs always produce identical outputs, eliminating one source of inter-evaluator variability.

### 10.4 Future Research Directions

Several areas warrant further investigation:

1. **Empirical weight optimization**: Validating and potentially refining the PVQ composite weights against longitudinal outcome data from actual job placements.
2. **O\*NET-only pathway**: Developing a parallel trait assessment framework that operates entirely within the O\*NET taxonomy, eliminating dependence on the aging DOT.
3. **Inter-evaluator reliability studies**: Systematic measurement of input variability across evaluators using the same case materials.
4. **SEM calibration**: Empirical measurement of actual PVQ score variability across evaluators and data vintages to validate the analytically derived SEM estimates.
5. **Expansion of ORS integration**: As BLS expands ORS coverage to additional occupations, the PVQ-TM system can progressively reduce dependence on DOT-based and proxy-derived trait assessments.

---

## 11. Conclusion

The PVQ-TM system provides a deterministic, transparent, and reproducible framework for vocational capacity assessment that satisfies the evidentiary requirements of *Daubert v. Merrell Dow Pharmaceuticals, Inc.* (1993). By integrating four independently validated assessment dimensions (skill transfer, trait feasibility, vocational adjustment, and labor market conditions) with quantified standard error of measurement based on published reliability coefficients, PVQ-TM advances the practice of forensic vocational assessment from subjective expert opinion toward standardized, auditable methodology.

The system's reliance on publicly available government data sources ensures that any qualified practitioner can independently verify results, while the comprehensive testing infrastructure (13,742 benchmark occupations, 32 hand-verified pairs, 1,003 automated tests) provides ongoing assurance of computational correctness. The multi-quotient composite score, combined with per-analysis confidence intervals, equips vocational experts with the quantitative precision required for defensible testimony.

---

## References

Barros-Bailey, M., & Neulicht, A. T. (2005). The Rehabilitation Consultant's Handbook (4th ed.). University of Memphis.

Bureau of Labor Statistics. (2024a). Occupational Employment and Wage Statistics: Technical notes. U.S. Department of Labor. https://www.bls.gov/oes/current/oes_tec.htm

Bureau of Labor Statistics. (2024b). BLS employment projections evaluation: 2012-2022 occupational projections. U.S. Department of Labor. https://www.bls.gov/emp/evaluations/2012-2022-occupational.htm

Bureau of Labor Statistics. (2025a). Occupational Requirements Survey: Standard errors. U.S. Department of Labor. https://www.bls.gov/ors/se.htm

Bureau of Labor Statistics. (2025b). Job Openings and Labor Turnover Survey. U.S. Department of Labor. https://www.bls.gov/jlt/

Cain, P. S., & Green, B. F. (1983). Reliabilities of selected ratings available from the Dictionary of Occupational Titles. *Journal of Applied Psychology*, *68*(4), 664--670. https://doi.org/10.1037/0021-9010.68.4.664

Cannelongo, L. A., Lechner, D. E., Keener, A. M., Carter, A., & Johnson, D. M. (2002). Job analysis reliability. *Work*, *18*(3), 239--253.

*Daubert v. Merrell Dow Pharmaceuticals, Inc.*, 509 U.S. 579 (1993).

Field, T. F., & Sink, J. M. (1981). *The vocational expert in the Social Security Disability program*. Athens, GA: Elliott & Fitzpatrick.

Gibson, L., Strong, J., & Freckleton, I. (2014). Work-ability Support Scale: Evaluation of scoring accuracy and rater reliability. *Journal of Occupational Rehabilitation*, *24*(3), 511--521. https://doi.org/10.1007/s10926-013-9485-2 (PMC4118042)

*Kumho Tire Co. v. Carmichael*, 526 U.S. 137 (1999).

McCroskey, B. J. (2001). *The VQS manual and quick start tutorial*. Vocationology, Inc.

McCroskey, B. J., Dennis, M. C., Wilkinson, L., et al. (2011). Predictive validity (Rxy) and standard errors of estimate (SEE) for the VQS VQ Job Difficulty Index [Technical report]. Vocationology, Inc.

National Center for O\*NET Development. (2024). O\*NET 29.1 Database. https://www.onetcenter.org/database.html

Peterson, N. G., Mumford, M. D., Borman, W. C., Jeanneret, P. R., & Fleishman, E. A. (1997). *O\*NET final technical report* (Vols. 1--3). Utah Department of Workforce Services.

Peterson, N. G., Mumford, M. D., Borman, W. C., Jeanneret, P. R., Fleishman, E. A., Levin, K. Y., Campion, M. A., Mayfield, M. S., Morgeson, F. P., Pearlman, K., Gowing, M. K., Lancaster, A. R., Silver, M. B., & Dye, D. M. (2001). Understanding work using the Occupational Information Network (O\*NET): Implications for practice and research. *Personnel Psychology*, *54*(2), 451--492. https://doi.org/10.1111/j.1744-6570.2001.tb00100.x

Robinson, R. (2014). Forensic vocational analysis: The state of practice. *Journal of Forensic Economics*, *25*(1), 69--88.

Social Security Administration. (1978). Social Security Ruling 78-7: Evaluation of symptoms. Social Security Administration.

Social Security Administration. (1982). Social Security Ruling 82-41: Work skills and their transferability as intended by the expanded vocational factors regulations. Social Security Administration.

U.S. Department of Labor. (1991). *Dictionary of Occupational Titles* (4th ed., rev.). U.S. Government Printing Office.

---

## Appendix A: Complete VQ Regression Weights

The complete VQ regression uses 24 weights plus an intercept of 34.56707. The weights and their corresponding VQS native scales are reproduced here for independent verification.

| Index | Trait | VQS Weight | Scale Group | Native Scale | Reverse Mapping |
|-------|-------|-----------|------------|-------------|----------------|
| 0 | reasoning | 5.299567 | GED | 1--6 | round(n/4 x 5) + 1 |
| 1 | math | 2.213121 | GED | 1--6 | round(n/4 x 5) + 1 |
| 2 | language | 1.424168 | GED | 1--6 | round(n/4 x 5) + 1 |
| 3 | spatialPerception | 2.241977 | APT | 1--5 | round(n/4 x 4) + 1 |
| 4 | formPerception | 1.783972 | APT | 1--5 | round(n/4 x 4) + 1 |
| 5 | clericalPerception | 1.957790 | APT | 1--5 | round(n/4 x 4) + 1 |
| 6 | motorCoordination | 1.648707 | APT | 1--5 | round(n/4 x 4) + 1 |
| 7 | fingerDexterity | 1.631036 | APT | 1--5 | round(n/4 x 4) + 1 |
| 8 | manualDexterity | 2.126616 | APT | 1--5 | round(n/4 x 4) + 1 |
| 9 | eyeHandFoot | 1.403101 | APT | 1--5 | round(n/4 x 4) + 1 |
| 10 | colorDiscrimination | 1.431217 | APT | 1--5 | round(n/4 x 4) + 1 |
| 11 | strength | 1.849530 | PD1 | 1--5 | round(n/4 x 4) + 1 |
| 12 | climbBalance | 0.774892 | Binary | 0--1 | n >= 2 ? 1 : 0 |
| 13 | stoopKneel | -0.165864 | Binary | 0--1 | n >= 2 ? 1 : 0 |
| 14 | reachHandle | 0.776669 | Binary | 0--1 | n >= 2 ? 1 : 0 |
| 15 | talkHear | 4.542681 | Binary | 0--1 | n >= 2 ? 1 : 0 |
| 16 | see | 0.201044 | Binary | 0--1 | n >= 2 ? 1 : 0 |
| 17 | workLocation | 1.470938 | EC1 | 1--3 | round(n/4 x 2) + 1 |
| 18 | extremeCold | 0.330026 | Binary | 0--1 | n >= 2 ? 1 : 0 |
| 19 | extremeHeat | 0.504727 | Binary | 0--1 | n >= 2 ? 1 : 0 |
| 20 | wetnessHumidity | 0.371165 | Binary | 0--1 | n >= 2 ? 1 : 0 |
| 21 | noiseVibration | 1.217675 | Binary | 0--1 | n >= 2 ? 1 : 0 |
| 22 | hazards | -0.200072 | Binary | 0--1 | n >= 2 ? 1 : 0 |
| 23 | dustsFumes | 0.298293 | Binary | 0--1 | n >= 2 ? 1 : 0 |

VQS default profile for null substitution (native scale): [3, 2, 2, 2, 3, 2, 3, 2, 3, 2, 2, 2, 0, 0, 1, 0, 1, 2, 0, 0, 0, 1, 0, 0]

---

## Appendix B: Normalization Lookup Tables

### B.1 DOT GED to 0--4

| GED Level | 1 | 2 | 3 | 4 | 5 | 6 |
|-----------|---|---|---|---|---|---|
| Normalized | 0.00 | 0.80 | 1.60 | 2.40 | 3.20 | 4.00 |

Formula: (GED - 1) x 0.8

### B.2 DOT Aptitude (Inverted) to 0--4

| DOT Aptitude | 1 | 2 | 3 | 4 | 5 |
|-------------|---|---|---|---|---|
| Normalized | 4 | 3 | 2 | 1 | 0 |

Formula: 5 - DOT value

### B.3 DOT Strength to 0--4

| Code | S | L | M | H | V |
|------|---|---|---|---|---|
| Normalized | 0 | 1 | 2 | 3 | 4 |

### B.4 DOT Physical/Environmental Frequency to 0--4

| Code | N | S | O | F | C |
|------|---|---|---|---|---|
| Normalized | 0 | 1 | 2 | 3 | 4 |

### B.5 O\*NET Level to 0--4

| O\*NET Level | 0 | 1 | 2 | 3 | 3.5 | 4 | 5 | 6 | 7 |
|-------------|---|---|---|---|-----|---|---|---|---|
| Normalized | 0.00 | 0.57 | 1.14 | 1.71 | 2.00 | 2.29 | 2.86 | 3.43 | 4.00 |

Formula: min(4, max(0, (level / 7) x 4))

---

## Appendix C: Benchmark Pair Expected Results (Sample of 12)

**Table C.1.** *Representative Benchmark Pairs with Expected Results*

| Pair | Description | STQ | TFQ | VAQ | LMQ | PVQ | Excluded | Reason |
|------|------------|-----|-----|-----|-----|-----|----------|--------|
| 001 | Accountant to Bookkeeper | 43.75 | 40.63 | 75.25 | 71.06 | 51.79 | No | -- |
| 002 | RN to Medical Secretary | 28.21 | 40.42 | 58.50 | 69.28 | 41.97 | No | -- |
| 003 | Bookkeeper to Cashier | 28.08 | 15.63 | 67.00 | 62.85 | 36.02 | No | -- |
| 004 | Carpenter to Machinist | 14.34 | 19.58 | 24.75 | 69.63 | 25.50 | No | -- |
| 005 | Electrician to Accountant | 8.86 | 39.17 | 24.75 | 85.70 | 30.35 | No | -- |
| 006 | Machinist to Electrician | 15.25 | 0 | 41.50 | 77.42 | 0 | Yes | Trait: Hazards |
| 007 | Truck Driver to Cashier | 6.47 | 15.63 | 24.75 | 62.85 | 19.96 | No | -- |
| 008 | RN to Cashier | 8.73 | 40.00 | 24.75 | 62.85 | 27.07 | No | -- |
| 009 | Carpenter to File Clerk | 2.80 | 42.92 | 24.75 | 61.78 | 24.97 | No | -- |
| 010 | Electrician to Carpenter (light) | 18.58 | 0 | 58.50 | 74.97 | 0 | Yes | 12 trait failures |
| All benchmark STQ values are approximate (+/-2.0) due to text similarity sensitivity. All other values are precise to +/-0.01.

---

## Appendix D: Data Version Manifest

| Source | Version | Release Date | Publisher | URL |
|--------|---------|-------------|-----------|-----|
| DOT | 4th Edition, Revised | 1991 | U.S. Department of Labor | -- |
| O\*NET | 29.1 | November 2024 | U.S. DOL/ETA | https://www.onetcenter.org/database.html |
| ORS | 2023 | 2023 | Bureau of Labor Statistics | https://www.bls.gov/ors/ |
| OEWS | May 2024 | 2024 | Bureau of Labor Statistics | https://www.bls.gov/oes/ |
| BLS Projections | 2022--2032 | 2024 | Bureau of Labor Statistics | https://www.bls.gov/emp/ |
| JOLTS | Through Feb. 2025 | 2025 | Bureau of Labor Statistics | https://www.bls.gov/jlt/ |
| VQS Regression | Year 2007 SOC | 2011 | Vocationology, Inc. | -- |

All analyses produced by PVQ-TM should cite the specific data versions listed above to ensure reproducibility. Changes to any data source version may alter computed scores and should be documented in subsequent analyses.
