# PVQ-TM Vocational Analysis System: Technical White Paper

**Version 1.0 | March 2026**

**For Use in Vocational Expert Testimony, Workers' Compensation, and SSDI Proceedings**

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [The 24-Trait Framework](#3-the-24-trait-framework)
4. [Skill Transfer Quotient (STQ)](#4-skill-transfer-quotient-stq)
5. [Trait Feasibility Quotient (TFQ)](#5-trait-feasibility-quotient-tfq)
6. [Vocational Adjustment Quotient (VAQ)](#6-vocational-adjustment-quotient-vaq)
7. [Labor Market Quotient (LMQ)](#7-labor-market-quotient-lmq)
8. [Public Vocational Quotient (PVQ)](#8-public-vocational-quotient-pvq)
9. [Vocational Quotient System (VQS)](#9-vocational-quotient-system-vqs)
10. [Transferable Skills Percent (TSP)](#10-transferable-skills-percent-tsp)
11. [Earning Capacity Estimation](#11-earning-capacity-estimation)
12. [Comprehensive Analysis Modules](#12-comprehensive-analysis-modules)
13. [Component Profile Code (CPC) System](#13-component-profile-code-cpc-system)
14. [Confidence Grading System](#14-confidence-grading-system)
15. [Data Sources and Provenance](#15-data-sources-and-provenance)
16. [Assumptions and Limitations](#16-assumptions-and-limitations)
17. [Repeatability and Reproducibility](#17-repeatability-and-reproducibility)
18. [Daubert Standard Compliance](#18-daubert-standard-compliance)
19. [References](#19-references)

---

## 1. Executive Summary

PVQ-TM (Public Vocational Quotient — Transferable Market) is a deterministic vocational analysis system that evaluates an injured worker's capacity to perform alternative occupations. The system produces a composite score (0-100) for each candidate occupation based on four independently validated dimensions:

- **Skill Transfer Quotient (STQ)** — Measures the degree to which skills from past relevant work transfer to target occupations
- **Trait Feasibility Quotient (TFQ)** — Determines whether the worker's physical, cognitive, and environmental capacities meet occupation demands
- **Vocational Adjustment Quotient (VAQ)** — Assesses the degree of adjustment required to transition between occupations
- **Labor Market Quotient (LMQ)** — Evaluates real-world job availability, wages, and employment projections

PVQ-TM additionally integrates the Vocational Quotient System (VQS), a regression-based methodology with published validity coefficients (Rxy = 0.83-0.98) for earning capacity estimation across four job-difficulty bands.

**Key properties for litigation use:**
- **Deterministic:** Given identical inputs, the system always produces identical outputs
- **Transparent:** Every score is decomposed into traceable sub-components
- **Auditable:** Each trait comparison, data source, and threshold is logged
- **Grounded in public data:** All occupational data derives from U.S. Department of Labor databases (DOT, O*NET, OEWS, BLS Projections, JOLTS)

---

## 2. System Architecture

### 2.1 Processing Pipeline

The analysis proceeds through a strict sequential pipeline:

```
Input: Worker Profile (24 traits) + Past Relevant Work + Case Data
                              |
                    +--------------------+
                    |   Data Retrieval   |
                    |  DOT / O*NET / ORS |
                    |  OEWS / BLS / JOLTS|
                    +--------------------+
                              |
              +------+------+------+------+
              |      |      |      |      |
             STQ    TFQ    VAQ    LMQ    VQS
              |      |      |      |      |
              +--+---+--+---+      |    TSP + EC
                 |      |         |      |
            Gating Logic          |      |
            (SVP / Traits / Age)  |      |
                 |                |      |
              PVQ Composite  ----+      |
              (0.45 STQ + 0.25 TFQ      |
               + 0.15 VAQ + 0.15 LMQ)  |
                 |                       |
              Confidence Grade (A-D)     |
                 |                       |
              +--+-----------------------+
              |  Comprehensive Analysis  |
              |  - Near-Miss Assessment  |
              |  - RFC Narrative         |
              |  - Viable Set Coherence  |
              |  - Regional Labor Market |
              +--+-----------------------+
                 |
              Output: Ranked occupations with
              scores, grades, and narratives
```

### 2.2 Exclusion Gates

Before computing the PVQ composite, three hard gates are evaluated in order:

1. **SVP Gate:** Target occupation SVP must not exceed the highest SVP of any past relevant work (per SSA transferable skills policy)
2. **Trait Gate:** Worker capacity must meet or exceed occupation demand on every assessed trait
3. **Advanced Age Gate:** Workers at or closely approaching advanced age (per SSA Grid Rules) must demonstrate "very little or no" adjustment across all four VAQ dimensions

An occupation failing any gate receives PVQ = 0 and is excluded from the viable set.

---

## 3. The 24-Trait Framework

### 3.1 Trait Categories

PVQ-TM evaluates workers and occupations across 24 traits organized into three categories:

**Cognitive/Aptitude Traits (6):**

| Trait | Definition | Scale |
|-------|-----------|-------|
| Reasoning (GED-R) | General learning and problem-solving ability | 0-4 |
| Math (GED-M) | Mathematical development level | 0-4 |
| Language (GED-L) | Language development level | 0-4 |
| Spatial Perception | Ability to comprehend spatial relationships | 0-4 |
| Form Perception | Ability to perceive pertinent detail in objects/graphics | 0-4 |
| Clerical Perception | Ability to perceive pertinent detail in verbal/tabular material | 0-4 |

**Physical Traits (11):**

| Trait | Definition | Scale |
|-------|-----------|-------|
| Motor Coordination | Ability to coordinate eyes, hands, and fingers | 0-4 |
| Finger Dexterity | Ability to manipulate small objects precisely | 0-4 |
| Manual Dexterity | Ability to handle objects skillfully with hands/arms | 0-4 |
| Eye-Hand-Foot Coordination | Coordinated movement of multiple limbs | 0-4 |
| Color Discrimination | Ability to match or discriminate between colors | 0-4 |
| Strength | Exertional capacity (Sedentary=0 through Very Heavy=4) | 0-4 |
| Climbing/Balancing | Frequency of climbing/balancing demands | 0-4 |
| Stooping/Kneeling | Frequency of stooping/kneeling/crouching demands | 0-4 |
| Reaching/Handling | Frequency of reaching/handling demands | 0-4 |
| Talking/Hearing | Communication demands | 0-4 |
| Seeing | Near/far visual acuity demands | 0-4 |

**Environmental Traits (7):**

| Trait | Definition | Scale |
|-------|-----------|-------|
| Work Location | Indoor/outdoor/both requirement | 0-4 |
| Extreme Cold | Exposure to cold temperatures | 0-4 |
| Extreme Heat | Exposure to heat | 0-4 |
| Wetness/Humidity | Exposure to moisture | 0-4 |
| Noise/Vibration | Exposure to noise and vibration | 0-4 |
| Hazards | Exposure to hazardous conditions | 0-4 |
| Dusts/Fumes | Exposure to atmospheric conditions | 0-4 |

### 3.2 Normalization to Unified Scale

All 24 traits are normalized to a common 0-4 scale regardless of their original source scale:

**DOT General Educational Development (GED 1-6 → 0-4):**

The normalization uses a linear mapping that preserves the full resolution of all six GED levels:

```
Normalized = (GED_Level - 1) × 0.8
```

| GED Level | Normalized Value |
|-----------|-----------------|
| 1 | 0.00 |
| 2 | 0.80 |
| 3 | 1.60 |
| 4 | 2.40 |
| 5 | 3.20 |
| 6 | 4.00 |

**DOT Strength (S/L/M/H/V → 0-4):**

| DOT Code | Label | Normalized | Lifting Capacity |
|----------|-------|-----------|-----------------|
| S | Sedentary | 0 | Up to 10 lbs occasionally |
| L | Light | 1 | Up to 20 lbs occasionally, 10 lbs frequently |
| M | Medium | 2 | Up to 50 lbs occasionally, 25 lbs frequently |
| H | Heavy | 3 | Up to 100 lbs occasionally, 50 lbs frequently |
| V | Very Heavy | 4 | Over 100 lbs |

**DOT Physical Demand Frequency (N/S/O/F/C → 0-4):**
N (Not Present) = 0, S (Seldom) = 1, O (Occasionally) = 2, F (Frequently) = 3, C (Constantly) = 4

**DOT Aptitudes (1-5 → 0-4):**
Inverted scale: `Normalized = 5 - DOT_Aptitude_Value`
(DOT aptitudes are scored with 1 = highest, 5 = lowest)

**O*NET Levels (0-7 → 0-4):**
```
Normalized = (O*NET_Level / 7) × 4, rounded to 2 decimal places
```

**ORS Data:** Parsed from survey percentage distributions; the dominant frequency category is selected as the representative value.

### 3.3 Multi-Source Data Priority

When multiple data sources are available for the same trait, the system applies a strict priority hierarchy:

1. **ORS** (Occupational Requirements Survey) — Primary: direct survey data
2. **DOT** (Dictionary of Occupational Titles) — Secondary: analyst-rated job data
3. **O*NET** (Occupational Information Network) — Tertiary: current occupational survey data
4. **Proxy** — Quaternary: no authoritative data available (marked in confidence grade)

Each trait comparison records its data source, enabling auditors to verify the provenance of every comparison.

---

## 4. Skill Transfer Quotient (STQ)

### 4.1 Purpose

STQ measures the degree to which an injured worker's skills from past relevant work (PRW) transfer to a target occupation. This aligns with SSA policy requiring that transferable skills involve "the use of tools, work processes, raw materials, products, or services" (SSR 82-41).

### 4.2 SVP Gating

Per Social Security Ruling 82-41, transferable skills analysis is only applicable to work at SVP 4 or above (semiskilled and skilled):

- SVP 1-3: Unskilled — no transferable skills by definition
- SVP 4+: Semiskilled/Skilled — transferable skills analysis applies

**Gate Rule:** Target SVP must not exceed the highest SVP of any qualifying past relevant work entry.

### 4.3 Similarity Metrics

Two similarity measures are computed for each text-based comparison:

**Jaccard Similarity:**
```
J(A, B) = |A ∩ B| / |A ∪ B|
```
Where A and B are sets of case-insensitive, trimmed strings.

**Token Overlap:**
```
T(A, B) = |tokens(A) ∩ tokens(B)| / |tokens(A) ∪ tokens(B)|
```
Where tokens are individual words (length > 2 characters) extracted from the combined text.

The higher of the two measures is used: `similarity = max(Jaccard, TokenOverlap)`. This provides robustness against minor variations in terminology between data sources.

Both metrics return 0 when both sets are empty, preventing division-by-zero errors.

### 4.4 Component Weights

| Component | Weight | Data Source |
|-----------|--------|-------------|
| Task/DWA Overlap | 35% | O*NET tasks, DOT work activities |
| Work Field / MPSMS Overlap | 25% | DOT work fields, Materials/Products/Subject Matter/Services |
| Tools/Software Overlap | 20% | O*NET tools and technology |
| Materials/Services Overlap | 10% | DOT MPSMS categories |
| Credential/Knowledge Overlap | 10% | O*NET knowledge areas |

**Total: 100%**

### 4.5 STQ Formula

```
STQ = 0.35 × TaskDWA + 0.25 × WorkFieldMPSMS + 0.20 × Tools
    + 0.10 × Materials + 0.10 × Credentials
```

**Range: 0-100** where 0 = no skill transfer and 100 = complete skill overlap.

When multiple past relevant work entries qualify, the system returns the STQ from the best-matching entry.

---

## 5. Trait Feasibility Quotient (TFQ)

### 5.1 Purpose

TFQ determines whether an injured worker can physically, cognitively, and environmentally perform a target occupation. It serves as a binary gate (pass/fail) with a continuous reserve margin score for viable occupations.

### 5.2 Pass/Fail Logic

For each of the 24 traits where both worker capacity and occupation demand are assessed:

```
IF worker_capacity < occupation_demand → FAIL (occupation excluded)
```

**A single failed trait excludes the entire occupation.** This reflects the medical-vocational reality that a single disqualifying limitation (e.g., inability to lift required weight) precludes job performance regardless of other capabilities.

### 5.3 Null Handling

When a trait value is null (not assessed):
- **Null worker capacity:** Treated as passing (trait was not evaluated as a limitation)
- **Null occupation demand:** Treated as passing (occupation does not demand this trait)
- **Both null:** Treated as passing (no comparison possible)

This design choice is documented as an explicit assumption. The confidence grading system penalizes analyses with excessive null/proxy data to flag this uncertainty.

### 5.4 Reserve Margin Formula

For occupations that pass all trait gates, the TFQ quantifies how much "room" exists between the worker's capacity and occupation demands:

```
TFQ = (Σ trait_margins / 96) × 100
```

Where:
- `trait_margin = worker_capacity - occupation_demand` for each rated trait
- Denominator = 24 traits × 4 (maximum possible margin per trait) = 96
- Unrated traits contribute margin = 0

**Range: 0-100.** Higher TFQ indicates greater reserve capacity. This normalization against all 24 traits (not just rated traits) prevents inflation when only a few traits have data.

---

## 6. Vocational Adjustment Quotient (VAQ)

### 6.1 Purpose

VAQ assesses the degree of vocational adjustment required for a worker to transition from their past occupation to a target occupation, consistent with SSA's consideration of adjustment factors.

### 6.2 Four Adjustment Dimensions

Each dimension is rated on a four-level scale:

| Rating | Value | Description |
|--------|-------|-------------|
| Very little or none | 100 | Minimal adjustment needed |
| Slight | 67 | Minor changes required |
| Moderate | 33 | Meaningful differences in work demands |
| Substantial | 0 | Significant retraining or adaptation needed |

**Dimensions:**
1. **Tools:** Degree of overlap in tools, equipment, and technology used
2. **Work Processes:** Similarity of work methods and procedures
3. **Work Setting:** Comparability of work environments and conditions
4. **Industry:** Relatedness of the industry sectors

### 6.3 VAQ Formula

**Standard calculation:**
```
VAQ = (Tools + WorkProcesses + WorkSetting + Industry) / 4
```

**Advanced age rule (SSA Grid Rules):** For workers at or closely approaching advanced age, any dimension rated below "Very little or none" (100) results in disqualification:

```
IF age_rule ∈ {advanced_age, closely_approaching} AND any_dimension < 100:
    VAQ = 0, excluded = true
```

### 6.4 Auto-Estimation from Occupational Data

When manual adjustment ratings are not provided, the system estimates adjustments from objective occupational data:

- **Tools:** O*NET tools/technology set overlap between PRW and target
- **Work Processes:** GOE (Guide for Occupational Exploration) code prefix matching
- **Work Setting:** DOT industry designation matching
- **Industry:** Primary industry sector comparison

Auto-estimation defaults to moderate/conservative values when data is insufficient, and this is reflected in the confidence grade.

---

## 7. Labor Market Quotient (LMQ)

### 7.1 Purpose

LMQ evaluates the real-world availability of employment in the target occupation, incorporating national employment counts, area-level employment, wage comparisons, employment projections, and job opening trends.

### 7.2 Component Scoring

**National Employment (0-100):**

| Employment Count | Score |
|-----------------|-------|
| > 100,000 | 100 |
| > 50,000 | 80 |
| > 20,000 | 60 |
| > 5,000 | 40 |
| > 1,000 | 20 |
| ≤ 1,000 | 10 |
| Unknown | 50 (neutral) |

**Local Demand (0-100, optional):**

When ZIP-level data are available, Local Demand is computed as a weighted blend of three independent sub-scores:

- **Posting Score (50%):** Percentile rank of deduplicated 90-day CareerOneStop postings for the occupation in the ZIP market.
- **Structural Base Score (30%):** Percentile rank of estimated ZIP occupation employment derived from Census ZIP Code Business Patterns (ZBP) establishment/employment counts crossed with BLS National Employment Matrix industry-occupation staffing patterns.
- **Hiring Momentum Score (20%):** Percentile rank of the mapped county/MSA Quarterly Workforce Indicators (QWI) hire rate, weighted by the occupation's industry mix.

**Formula:**

```
Local Demand = 0.50 × PostingScore + 0.30 × StructuralScore + 0.20 × HiringMomentumScore
```

When one or more components are unavailable, their weights redistribute proportionally among the remaining components (same dynamic-weighting logic used in the LMQ composite).

When ZIP-level data are not available, the system falls back to MSA-level area employment thresholds:

| Area Employment | Score |
|----------------|-------|
| > 10,000 | 100 |
| > 5,000 | 80 |
| > 2,000 | 60 |
| > 500 | 40 |
| > 100 | 20 |
| ≤ 100 | 10 |

**Note:** The LMQ overall composite formula is unchanged — Local Demand (formerly Area Employment) retains its 15% weight slot.

**Wage Comparison (0-100):**

With prior earnings available:

| Wage Ratio (Target/Prior) | Score |
|--------------------------|-------|
| ≥ 1.00 | 100 |
| ≥ 0.90 | 80 |
| ≥ 0.75 | 60 |
| ≥ 0.50 | 40 |
| < 0.50 | 20 |

Without prior earnings, absolute wage thresholds apply (>$60K=80, >$40K=60, >$25K=40, ≤$25K=20).

**Employment Projections (0-100):**

Growth and openings are scored independently, then averaged:

| Growth Rate | Score | | Annual Openings | Score |
|------------|-------|-|-----------------|-------|
| > 10% | 100 | | > 10,000 | 100 |
| > 5% | 80 | | > 5,000 | 80 |
| > 0% | 60 | | > 1,000 | 60 |
| > -5% | 40 | | > 500 | 40 |
| ≤ -5% | 20 | | ≤ 500 | 20 |

`ProjectionsScore = (GrowthScore + OpeningsScore) / 2`

**JOLTS Trend (0-100, optional):**

Linear mapping from trend coefficient (-1 to +1) to score:
```
Score = 60 + (trend × 40)
```
Where trend = -1 (strongly declining) to +1 (strongly growing).

### 7.3 LMQ Composite with Dynamic Weighting

**Base Weights:**

| Component | Weight | Required |
|-----------|--------|----------|
| National Employment | 25% | Yes |
| Wage Comparison | 25% | Yes |
| Employment Projections | 20% | Yes |
| Local Demand | 15% | Optional |
| JOLTS Trend | 15% | Optional |

When optional components lack data, their weights redistribute proportionally to the available components:

```
LMQ = Σ (component_weight / total_available_weight) × component_score
```

For example, without area employment or JOLTS data:
- Total available weight = 0.25 + 0.25 + 0.20 = 0.70
- Employment: 0.25/0.70 = 35.7%
- Wage: 0.25/0.70 = 35.7%
- Projections: 0.20/0.70 = 28.6%

This ensures LMQ remains on the 0-100 scale regardless of data availability.

---

## 8. Public Vocational Quotient (PVQ)

### 8.1 Composite Formula

For occupations passing all three exclusion gates:

```
PVQ = 0.45 × STQ + 0.25 × TFQ + 0.15 × VAQ + 0.15 × LMQ
```

**Weight Rationale:**
- **STQ (45%):** Skill transferability is the primary vocational consideration per SSA policy and rehabilitation counseling standards
- **TFQ (25%):** Physical/cognitive feasibility is the foundational medical-vocational constraint
- **VAQ (15%):** Adjustment difficulty affects transition success but is partially captured by STQ
- **LMQ (15%):** Labor market conditions affect practical employment availability

**Range: 0-100.** Higher PVQ indicates a more viable target occupation.

### 8.2 Weight Sum Verification

```
0.45 + 0.25 + 0.15 + 0.15 = 1.00 ✓
```

All component weights are positive and sum to exactly 1.0, ensuring PVQ is bounded within [0, 100].

---

## 9. Vocational Quotient System (VQS)

### 9.1 Background

The VQS methodology provides a standardized job difficulty index derived from regression analysis of the 24-trait demand vectors across the full DOT database. The VQ score enables curvilinear earning capacity estimation validated against OEWS wage data.

### 9.2 VQ Regression Model

**Intercept:** 34.56707

**24 Regression Weights (in trait order):**

| Trait | Weight | Native Scale |
|-------|--------|-------------|
| Reasoning (GED-R) | 5.299567 | 1-6 |
| Math (GED-M) | 2.213121 | 1-6 |
| Language (GED-L) | 1.424168 | 1-6 |
| Spatial Perception | 2.241977 | 1-5 |
| Form Perception | 1.783972 | 1-5 |
| Clerical Perception | 1.95779 | 1-5 |
| Motor Coordination | 1.648707 | 1-5 |
| Finger Dexterity | 1.631036 | 1-5 |
| Manual Dexterity | 2.126616 | 1-5 |
| Eye-Hand-Foot | 1.403101 | 1-5 |
| Color Discrimination | 1.431217 | 1-5 |
| Strength | 1.84953 | 1-5 |
| Climbing/Balancing | 0.774892 | 0-1 |
| Stooping/Kneeling | -0.165864 | 0-1 |
| Reaching/Handling | 0.776669 | 0-1 |
| Talking/Hearing | 4.542681 | 0-1 |
| Seeing | 0.201044 | 0-1 |
| Work Location | 1.470938 | 1-3 |
| Extreme Cold | 0.330026 | 0-1 |
| Extreme Heat | 0.504727 | 0-1 |
| Wetness/Humidity | 0.371165 | 0-1 |
| Noise/Vibration | 1.217675 | 0-1 |
| Hazards | -0.200072 | 0-1 |
| Dusts/Fumes | 0.298293 | 0-1 |

**Note:** Two weights are negative (Stooping/Kneeling and Hazards). This reflects the regression finding that, controlling for other traits, occupations requiring these specific traits tend to be somewhat less complex overall. This is a mathematical property of the multivariate regression, not an indication that these traits reduce job difficulty in isolation.

### 9.3 Scale Conversion (PVQ-TM 0-4 → VQS Native)

Because the VQ regression was calibrated on native DOT scales, PVQ-TM's normalized 0-4 values must be reverse-mapped before applying regression weights:

| Trait Category | PVQ-TM Scale | VQS Native Scale | Conversion |
|---------------|-------------|------------------|------------|
| GED (R, M, L) | 0-4 | 1-6 | round((v/4)×5) + 1 |
| Aptitudes + Strength | 0-4 | 1-5 | round(v) + 1 |
| Physical binary (PD2-PD6) | 0-4 | 0-1 | v ≥ 2 ? 1 : 0 |
| Work Location (EC1) | 0-4 | 1-3 | round((v/4)×2) + 1 |
| Environmental binary (EC2-EC7) | 0-4 | 0-1 | v ≥ 2 ? 1 : 0 |

When a trait value is null (no data), the VQS Default Profile value is substituted:
```
Default: [3, 2, 2, 2, 3, 2, 3, 2, 3, 2, 2, 2, 0, 0, 1, 0, 1, 2, 0, 0, 0, 1, 0, 0]
```

### 9.4 VQ Computation

```
VQ = 34.56707 + Σ(weight_i × native_trait_i)  for i = 1 to 24
VQ = clamp(VQ, 68, 158)
```

**Range: 68-158** (Mean = 100, SD = 15)

### 9.5 VQ Band Structure

| Band | VQ Range | Population Percentile | Jobs (%) | Label |
|------|----------|----------------------|----------|-------|
| 1 | 68 – 99.99 | 1st – 50th | 50% | Below Average to Mid-Average |
| 2 | 100 – 108.99 | 50th – 67th | 17% | Mid-Average to High-Average |
| 3 | 109 – 143.99 | 67th – 99th | 32% | High-Average to Very High |
| 4 | 144 – 158 | 99th – 100th | 1% | Extremely High |

---

## 10. Transferable Skills Percent (TSP)

### 10.1 Purpose

TSP quantifies the percentage of skills that transfer between a source occupation (PRW) and a target occupation, using a multi-factor model calibrated to the VQS methodology.

### 10.2 Tier Structure

| Tier | TSP Range | Qualitative Label |
|------|-----------|------------------|
| 5 | 80-97% | Semi-skilled to skilled, high transferable skills |
| 4 | 60-79% | Semi-skilled to skilled, moderate transferable skills |
| 3 | 40-59% | Semi-skilled to skilled, low transferable skills |
| 2 | 20-39% | Semi-skilled to skilled, no significant transferable skills |
| 1 | 0-19% | Unskilled, no significant transferable skills |

**TSP Cap:** Maximum 97% (per McCroskey, 2015: even re-entering the same job requires some new-employer learning).

### 10.3 Tier Determination Rules

Tier assignment is based on DOT code and O*NET code structural overlap:

1. **Tier 1:** Target VQ < 85 (unskilled work)
2. **Tier 5:** DOT 3-digit prefix match AND full O*NET code match
3. **Tier 4:** DOT 3-digit match OR full O*NET match OR (DOT 2-digit AND O*NET 4-character match)
4. **Tier 3:** DOT 2-digit match OR O*NET 4-character match OR (DOT 1-digit AND O*NET 2-character match)
5. **Tier 2:** Default — limited structural overlap

### 10.4 Component Weights (V2 Calibration)

| Component | Weight | Measures |
|-----------|--------|---------|
| Trait Similarity | 30% | How similar are the 24-trait demand profiles |
| Trait Coverage | 16% | What fraction of target demands are met by source capacity |
| DOT Prefix Match | 14% | Structural overlap in DOT occupational classification |
| O*NET Prefix Match | 14% | Structural overlap in O*NET SOC classification |
| VQ Proximity | 8% | How close are the job difficulty levels |
| SVP Proximity | 6% | How close are the training time requirements |
| Strength Proximity | 12% | How close are the exertional demands |

**Total: 100%**

### 10.5 Within-Tier Scoring

The final TSP score is computed as:

```
TSP = Tier_Minimum + In_Tier_Progress × (Tier_Maximum - Tier_Minimum)
TSP = clamp(TSP, 0, 97)
```

Where `In_Tier_Progress` is derived from a structural-weighted core score that emphasizes the DOT/O*NET prefix matching, VQ proximity, SVP proximity, and strength proximity.

---

## 11. Earning Capacity Estimation

### 11.1 Data Sources

Earning capacity estimates are derived from two complementary sources:
- **OEWS Wage Data** (Bureau of Labor Statistics) — actual wage percentiles (p10, p25, median, p75, p90) by occupation and geographic area
- **VQ Band Statistics** (published VQS research) — standard error of estimate (SEE) for each VQ band

### 11.2 VQ Band Prediction Accuracy

| Band | Rxy (Mean) | Rxy (Median) | SEE Mean ($/hr) | SEE Median ($/hr) |
|------|-----------|-------------|-----------------|-------------------|
| 1 (68-99) | 0.96 | 0.96 | $0.25 | $0.20 |
| 2 (100-108) | 0.98 | 0.98 | $0.38 | $0.27 |
| 3 (109-143) | 0.92 | 0.92 | $2.00 | $1.32 |
| 4 (144-158) | 0.83 | 0.83 | $12.47 | $8.69 |

**Source:** McCroskey et al. (2011), Year 2007 SOC data curvilinear regression analysis.

### 11.3 Geographic Adjustment (ECLR)

The Earning Capacity by Labor market Region (ECLR) adjusts national wages to the evaluee's geographic area:

```
ECLR = Area_Median_Wage / National_Median_Wage
ECLR = clamp(ECLR, 0.5, 2.0)
```

- ECLR > 1.0: Area wages exceed national average
- ECLR = 1.0: Area wages match national average
- ECLR < 1.0: Area wages below national average

The clamping range [0.5, 2.0] prevents extreme outlier adjustments.

### 11.4 Confidence Interval

```
EC_Median = OEWS_Median_Hourly × ECLR
Lower_95% = max(0, EC_Median - 1.96 × SEE)
Upper_95% = EC_Median + 1.96 × SEE
```

The 95% confidence interval uses ±1.96 standard errors, appropriate under the normal distribution assumption validated by the VQS regression analysis.

### 11.5 Hourly/Annual Conversion

```
Annual = Hourly × 2,080
```

Based on the standard full-time work year of 52 weeks × 40 hours/week.

---

## 12. Comprehensive Analysis Modules

### 12.1 Near-Miss Analysis

For excluded occupations, the system classifies the severity of exclusion and assesses retrainability potential:

**Severity Classification:**

| Severity | Criteria | Interpretation |
|----------|---------|---------------|
| Marginal | Exactly 1 trait fails by ≤ 1 point | Very close to viable; minor capacity improvement could qualify |
| Moderate | 1-2 traits fail with total deficit ≤ 2 points | Potentially reachable with targeted intervention |
| Significant | 3+ traits fail OR total deficit > 2 points | Substantial barriers to entry |

**Retrainability Assessment:**

An excluded occupation is classified as "retrainable" only when ALL failed traits are cognitive/aptitude traits (reasoning, math, language, spatial perception, form perception, clerical perception). Physical and environmental trait deficits are not considered addressable through training.

**SVP Gap Retraining Estimates:**

| SVP Gap | Estimated Retraining Time |
|---------|--------------------------|
| 1 level | 3 months |
| 2 levels | 12 months |
| 3 levels | 24 months |
| 4+ levels | 48 months |

### 12.2 Residual Functional Capacity (RFC) Narrative

Generates a plain-language functional capacity summary from the 24-trait post-injury profile:

- **Functional Level:** Derived from strength trait (Sedentary through Very Heavy) with DOL-standard weight limits
- **Strengths:** Traits rated 3-4 (above average to high capacity)
- **Limitations:** Traits rated 0-1 with specific vocational impact statements
- **Moderate Capabilities:** Traits rated 2 (average capacity)
- **Pre-to-Post Changes:** When a pre-injury profile is available, identifies which traits were reduced and by how much

The narrative uses standard rehabilitation counseling terminology and is suitable for inclusion in vocational expert reports.

### 12.3 Viable Set Coherence Analysis

Evaluates whether the set of viable occupations forms a coherent cluster or is scattered:

**Coherence Score (0-100):** Based on pairwise cosine similarity of trait demand vectors across all viable occupations.

| Score | Label | Interpretation |
|-------|-------|---------------|
| > 70 | Highly Coherent | All viable jobs share similar demands |
| > 50 | Moderately Coherent | Viable jobs cluster in related areas |
| > 30 | Diverse | Viable jobs span different demand profiles |
| ≤ 30 | Scattered | No clear occupational pattern |

**Clustering:** Occupations are grouped by SOC 2-digit major group (e.g., 29-XXXX = Healthcare Practitioners) to identify occupational clusters.

**Core vs. Peripheral:** Occupations with STQ > 60 are classified as "core" placements (strong skill transfer), while STQ < 40 indicates "peripheral" placements.

### 12.4 Regional Labor Market Analysis

Contextualizes the viable set within the evaluee's geographic labor market:

- **Wage Premium:** Percentage difference between area and national median wages
- **Employment Concentration:** Ratio of area to national employment for viable occupations
- **JOLTS Analysis:** State-level job openings trends (current vs. date-of-injury)
- **Industry Trends:** Classification of viable occupations as growing, stable, or declining based on JOLTS trend coefficients
- **Risk/Opportunity Identification:** Automated flagging of factors that could enhance or reduce practical employability

### 12.5 Comprehensive Labor Market Access Analysis

This module implements the core VDARE (Vocational Diagnosis and Assessment of Residual Employability) concept of comparing the worker's residual profile against ALL occupations in the labor market, not just skill-transfer candidates.

**Methodology (Based on the VDARE Process, Field & Sink, 1981):**

The VDARE process establishes that vocational potential is assessed by:
1. Building an Unadjusted Vocational Profile (UVP) from work history — equivalent to our PRE-injury profile
2. Adjusting the UVP to create a Residual Employability Profile (REP) based on documented functional limitations — equivalent to our POST-injury profile
3. Comparing the REP against job qualifications profiles for all feasible occupations

PVQ-TM automates this comparison at scale:

- **831 BLS OEWS occupations** analyzed (every occupation with published employment data)
- **Per-occupation DOT demands** loaded via the DOT-to-O*NET crosswalk (12,726 DOT records mapped to SOC codes)
- **ORS physical demands** override DOT data where available (226 SOC codes with per-occupation survey data)
- **SVP gate** applied: workers can only access occupations at or below their demonstrated SVP level (per SSR 82-41)
- **24-trait comparison** for both PRE and POST profiles independently
- **Geographic employment data**: Real BLS OEWS metro-area employment counts for 393 metropolitan statistical areas, providing the actual number of jobs in the worker's geographic region

**Output Metrics:**

| Metric | Description |
|--------|-------------|
| Pre-Injury Accessible | Occupations and employment accessible before injury (national + metro area) |
| Post-Injury Accessible | Occupations and employment accessible after injury (national + metro area) |
| Occupations Lost | Count and percentage of occupations no longer accessible |
| Employment Lost (National) | Total national employment in lost occupations |
| Employment Lost (Metro Area) | Employment in the worker's specific metro area for lost occupations |
| By Strength Level | Breakdown of accessible occupations by exertional level (Sedentary through Very Heavy) |
| Most Common Failing Traits | Which traits cause the most job exclusions |
| Lost Occupations Detail | Top 50 lost occupations with national and area employment, strength level, and specific failed traits |

**Geographic Precision:**

Metro-area employment comes from BLS OEWS May 2024 data (the same dataset used for national wage estimates, but at the metropolitan statistical area level). This provides per-occupation employment counts for 393 MSAs covering all major U.S. labor markets. When the evaluee's ZIP code maps to a specific MSA, the analysis shows both national and local employment impacts.

Example: A carpenter in the Los Angeles-Long Beach-Anaheim MSA restricted to Light work after a lumbar injury:
- National: Lost access to 71 occupations representing 11,352,930 jobs (23.1%)
- LA Metro Area: Lost access to 386,310 jobs in the local labor market (20.7%)

### 12.6 VDARE Process Alignment

PVQ-TM implements the VDARE process (Field & Sink, 1981) through automated computation:

| VDARE Step | PVQ-TM Implementation |
|------------|----------------------|
| Step 1: Initial Data Collection | Case creation with demographics, injury description, medical context |
| Step 2: Client Interview Data | PRW entry with DOT/O*NET crosswalk, SVP, strength, employer, duration |
| Step 3: Job-Specific Work History | Automated DOT profiling via crosswalk — all 24 worker traits derived |
| Step 4: Generate UVP | "Analyze PRW" auto-populates all 4 profile rows from demonstrated work capacity (highest level across all PRW, per VDARE rules) |
| Step 5: Generate REP | User adjusts Evaluative profile based on medical/FCE data; POST profile mirrors changes |
| Step 6: Evaluation Planning | Pre-analysis checklist validates completeness (PRW, skills, POST profile) |
| Step 7: Vocational Objective | Candidate generation + TFQ trait filter + PVQ scoring identifies viable placements |
| Step 8: Treatment/Service Planning | Near-miss analysis identifies retraining potential; RFC narrative summarizes capacity |
| Step 9: Reporting | PDF report with TOC, methodology, assumptions, signature block |
| Step 10: Vocational Outcome | Labor Market Access analysis quantifies total job loss with geographic specificity |

**Key VDARE Principles Preserved:**
- UVP uses the **highest demonstrated level** for each trait across all PRW (not average)
- REP adjustments are **documented with source** (FCE, physician, testing) via trait source documentation
- Job matching compares REP against **each occupation's specific DOT demands** (not generic defaults)
- A **single failed trait** eliminates the occupation (hard exclusion gate)
- Aptitudes are scored in **inverse order** (DOT: 1=highest, 5=lowest; normalized to 0-4 scale)

---

## 13. Component Profile Code (CPC) System

### 13.1 Purpose and Rationale

Traditional candidate occupation generation relies on relationship-based matching: DOT work field/MPSMS overlap and O*NET related-occupation matrices. These approaches identify occupations that the Department of Labor has explicitly linked, but they cannot discover structurally similar occupations that lack a formal relationship in these databases. When a worker's past relevant work falls outside well-populated DOT work field categories, or when the O*NET Related Occupations and Career Changers matrices are sparse, traditional candidate generation may produce thin or zero results.

The Component Profile Code (CPC) system addresses this limitation by decomposing every occupation into its underlying component dimensions and matching occupations based on component similarity rather than administrative relationships. This approach is grounded in the VDARE principle (Field & Sink, 1981) that vocational potential should be assessed by comparing the worker's demonstrated capacities against the full universe of occupations, not just those identified through a single classification system.

### 13.2 The 237-Dimensional Occupation Fingerprint

Each of the 1,016 O*NET-SOC occupations is represented as a 237-dimensional numeric vector derived from six standardized O*NET taxonomies:

| Taxonomy | Dimensions | O*NET Element ID Format | Score Computation |
|----------|-----------|------------------------|-------------------|
| Knowledge | 33 | 2.C.x.x | Importance (0-5) x Level (0-7) |
| Skills | 35 | 2.A.x.x / 2.B.x.x | Importance (0-5) x Level (0-7) |
| Abilities | 52 | 1.A.x.x | Importance (0-5) x Level (0-7) |
| Work Activities | 41 | 4.A.x.x | Importance (0-5) x Level (0-7) |
| Work Context | 55 | 4.C.x.x | Importance (0-5) |
| Work Styles | 21 | 1.D.x.x | Importance (0-5) |
| **Total** | **237** | | |

**Element Score Computation:**

For knowledge, skills, abilities, and work activities (162 dimensions), the element score is computed as the product of the O*NET importance rating and level rating:

```
ElementScore = Importance(0-5) x Level(0-7)
```

This product captures both whether a component matters to the occupation (importance) and how much of it is required (level). Maximum possible product is 35.

For work context and work styles (76 dimensions), only the importance rating is available:

```
ElementScore = Importance(0-5)
```

**L2 Normalization:**

Each 237-dimensional vector is L2-normalized to unit length:

```
v_normalized = v / ||v||_2
```

Where `||v||_2 = sqrt(sum(v_i^2))` for all 237 dimensions. This normalization ensures that cosine similarity reduces to a simple dot product and prevents taxonomies with higher raw score ranges from dominating the comparison.

### 13.3 Canonical Dimension Ordering

The 237 dimensions follow a fixed canonical ordering: element IDs are sorted alphabetically within each taxonomy group, then groups are concatenated in the order Knowledge, Skills, Abilities, Work Activities, Work Context, Work Styles. This ensures deterministic fingerprint construction across all system invocations.

| Taxonomy | Index Range |
|----------|-------------|
| Knowledge | Dimensions 0-32 |
| Skills | Dimensions 33-67 |
| Abilities | Dimensions 68-119 |
| Work Activities | Dimensions 120-160 |
| Work Context | Dimensions 161-215 |
| Work Styles | Dimensions 216-236 |

### 13.4 Data Source Integration

The CPC system integrates three authoritative data sources following the VDARE-aligned priority hierarchy:

**O*NET 30.2 (Primary Component Data):**
All 237 dimensions are derived from O*NET's standardized element ratings. The O*NET database provides importance and level ratings for each element across all 1,016 occupations, ensuring uniform coverage.

**ORS (Physical Demand Enrichment):**
The Occupational Requirements Survey (BLS) provides authoritative physical and environmental demand data for 226 SOC codes. ORS data is extracted and mapped to specific physical traits (strength, fine/gross manipulation, climbing, low postures, reaching) and environmental conditions (extreme temperatures, noise, hazards). Per VDARE methodology, ORS takes priority over DOT and O*NET for physical demand assessment.

**OEWS (Labor Market Context):**
The Occupational Employment and Wage Statistics (BLS) provides national employment counts and wage data (mean, median, 10th/25th/75th/90th percentile) for 831 SOC codes. This data is attached to each occupation fingerprint, enabling the CPC system to report the labor market significance of component-matched occupations.

### 13.5 Cosine Similarity

Occupation similarity is computed using cosine similarity between L2-normalized fingerprint vectors:

```
CosineSimilarity(A, B) = A . B = sum(A_i x B_i) for i = 1..237
```

Since both vectors are unit-length (L2-normalized), the dot product equals the cosine of the angle between them. Properties:

- **Range:** 0 to 1 (negative similarities are clamped to 0)
- **1.0** = identical component profiles
- **0.0** = completely orthogonal profiles (no shared components)
- **Symmetric:** sim(A, B) = sim(B, A)
- **Deterministic:** identical inputs always produce identical similarity scores

### 13.6 Worker Component Profile Construction

The worker's component profile is constructed from their Past Relevant Work (PRW) occupations following VDARE principles:

1. **Fingerprint Lookup:** Each PRW O*NET code is mapped to its 237-dimensional fingerprint in the pre-computed index.

2. **Composite Averaging:** All PRW fingerprint vectors are averaged element-wise:
   ```
   Composite_i = (1/N) x sum(PRW_j_i) for j = 1..N PRW occupations
   ```

3. **L2 Normalization:** The averaged vector is L2-normalized to unit length.

4. **Code Format Validation:** The system attempts common O*NET code format variations (XX-XXXX vs. XX-XXXX.00) to maximize PRW code resolution. Unresolvable codes are logged and the remaining PRW entries are used.

This composite vector represents the worker's demonstrated occupational competency across all 237 component dimensions, weighted equally across all PRW entries.

### 13.7 Component Profile Code (Human-Readable)

Each occupation (and each worker composite profile) is assigned a human-readable Component Profile Code of the form:

```
K[Abbr1+Abbr2]-S[Abbr1+Abbr2]-A[Abbr1+Abbr2]-Z{n}-STR:{s}
```

Where:
- **K[...]** = Top 2 knowledge areas by importance x level score
- **S[...]** = Top 2 skills by importance x level score
- **A[...]** = Top 2 abilities by importance x level score
- **Z{n}** = O*NET Job Zone (1-5)
- **STR:{s}** = Strength level (S/L/M/H/V from ORS, or ? if unavailable)

Example: `K[Admin+Econ]-S[CritThink+JudgDecis]-A[OralComp+WritExpr]-Z5-STR:S`

This code provides a quick characterization of an occupation's dominant components without requiring inspection of the full 237-dimensional vector. A standardized abbreviation map covers all 120 unique element names across knowledge, skills, and abilities taxonomies.

### 13.8 CPC Candidate Generation

The CPC system generates candidate occupations by searching all 1,016 O*NET occupations for those with the highest component similarity to the worker's composite profile:

**Step 1: SVP Gate**
Target occupations are filtered by SVP: the occupation's Job Zone (mapped to maximum SVP via the standard conversion table) must not exceed the worker's highest demonstrated SVP from PRW. In zero-viable fallback mode, the SVP gate is relaxed by +1 level.

**Step 2: Strength Gate**
When the worker's post-injury strength capacity is known and the occupation has ORS strength data, occupations requiring a higher strength level are excluded.

**Step 3: Cosine Similarity Ranking**
All surviving occupations are scored by cosine similarity to the worker's composite vector. Occupations below the minimum similarity threshold (0.4 for normal analysis, 0.25 for zero-viable fallback) are excluded.

**Step 4: Top-N Selection**
The top 30 most similar occupations are selected. For each, the system computes:
- **Top 5 Matching Components:** Dimensions where both worker and occupation score highly (geometric mean of both scores)
- **Top 5 Gap Components:** Dimensions where the occupation demands significantly more than the worker's profile provides

**Step 5: Full PVQ Scoring Pipeline**
CPC candidates are entered into the database as target occupations with source "CPC_SIMILARITY" and proceed through the same STQ, TFQ, VAQ, and LMQ scoring pipeline as traditional candidates. They are subject to the same gating criteria and can become viable or excluded occupations.

### 13.9 Component Gap Analysis

The gap analysis module assesses the worker's component strengths and weaknesses relative to the broader labor market:

**Worker Strengths:** The top 10 dimensions of the worker's composite vector, identifying the component areas where the worker has the strongest demonstrated competency.

**Market Gaps:** Aggregated across the top 15 CPC-matched occupations, the system identifies component dimensions that are frequently demanded at levels exceeding the worker's profile. These represent areas where the worker's component profile falls short of market demands.

**Profile Breadth:** The standard deviation of the worker's fingerprint vector classifies the profile as:
- **Narrow** (std dev > 0.08): Competency concentrated in few dimensions (specialist)
- **Moderate** (std dev 0.05-0.08): Balanced distribution
- **Broad** (std dev < 0.05): Competency spread across many dimensions (generalist)

### 13.10 Integration with Existing Analysis Pipeline

The CPC system integrates at three points in the PVQ-TM pipeline:

1. **Candidate Generation (Phase 1):** CPC candidates run in parallel with traditional DOT/O*NET candidates. Results are merged and deduplicated by O*NET-SOC code, with the higher similarity score retained.

2. **Per-Target Scoring (Phase 2):** After all targets complete STQ/TFQ/VAQ/LMQ scoring, each target receives its CPC code and cosine similarity to the worker's composite profile.

3. **CPC Analysis (Phase 3):** The full CPC analysis (worker profile, similar occupations, gap analysis, labor market summary) is computed and stored on every analysis run, ensuring every report includes the Component Profile Analysis section.

### 13.11 Report Output

The Component Profile Analysis section appears in every PDF report and includes:

1. **Worker Component Profile Summary:** CPC code, profile breadth assessment, and top knowledge/skills/abilities table
2. **Most Similar Occupations:** Table of up to 15 component-matched occupations with similarity percentage, Job Zone, strength level, OEWS employment, median wage, and top matching components
3. **Component Gap Analysis:** Narrative describing worker strengths, market gaps, and profile breadth, with a side-by-side table of worker strengths vs. market gap components
4. **Labor Market Summary:** Aggregate employment and wage statistics for component-matched occupations from OEWS data

### 13.12 Computational Properties

**Memory Footprint:** The pre-computed fingerprint index for all 1,016 occupations requires approximately 1,016 x 237 x 8 bytes = 1.9 MB of memory, cached as a lazy singleton.

**Performance:** Fingerprint computation for all 1,016 occupations completes in under 50ms. The pairwise similarity search against 1,016 occupations requires ~240,000 dot-product operations, completing in under 100ms.

**Determinism:** The CPC system is fully deterministic. Identical PRW inputs always produce identical fingerprints, cosine similarities, CPC codes, and candidate rankings. There is no randomness in any computation.

### 13.13 Relationship to VDARE Methodology

The CPC system extends the VDARE process in two ways:

1. **Component-level matching** (Steps 7-8): Where VDARE compares the REP against individual occupation trait demands, the CPC system additionally compares the worker's 237-dimensional component profile against all occupations. This identifies transferable occupations that share the worker's component DNA but may not appear in DOT work field or O*NET relationship matrices.

2. **Zero-viable augmentation** (Step 10): When all traditional candidates are excluded by the TFQ/VAQ gates, the CPC system provides component-based analysis showing which occupations are most structurally similar to the worker's demonstrated competency, even if they cannot be accessed at the current functional level. This supports the vocational opinion by characterizing what the worker "would" be able to do absent the injury-related limitations.

### 13.14 Limitations

1. **Work Context and Work Styles lack level ratings.** These 76 dimensions use only the importance score (0-5), reducing their discriminative power compared to the 162 dimensions that use importance x level (0-35 range). L2 normalization partially compensates, but knowledge, skills, abilities, and work activities naturally dominate the similarity computation.

2. **O*NET data currency.** The system uses O*NET 30.2 data. As occupations evolve, component profiles may drift from actual workplace demands. The system should be updated when new O*NET releases are available.

3. **Composite averaging.** The worker profile averages across all PRW occupations equally. A worker with one 10-year career and one 6-month job would give equal weight to both, which may not reflect the worker's primary competency. Future versions could weight by PRW duration.

4. **Cosine similarity does not capture magnitude.** Two occupations with the same relative component priorities but very different absolute demand levels will appear identical after L2 normalization. The 24-trait TFQ comparison (which uses absolute demand levels) compensates for this by independently gating on physical and cognitive capacity.

---

## 14. Confidence Grading System

### 13.1 Purpose

Every analysis receives a letter grade (A-D) indicating data quality and analytical confidence. This ensures that users and triers of fact understand the reliability of the results.

### 13.2 Scoring Components

| Component | Max Points | Criteria |
|-----------|-----------|---------|
| STQ Task/DWA Data | 2 | Matched tasks/DWAs found = 2; STQ > 0 = 1; else 0 |
| TFQ Trait Coverage | 3 | ≥ 20 traits rated = 3; ≥ 15 = 2; ≥ 10 = 1; else 0 |
| TFQ Proxy Penalty | -1 | > 10 proxy-derived traits = -1 |
| LMQ Employment Data | 1 | National employment count available = 1 |
| LMQ Wage Data | 1 | Median wage available = 1 |
| LMQ Projections Data | 1 | Projected openings available = 1 |

**Maximum Possible: 8 points**

### 13.3 Grade Assignment

| Grade | Score Range | Interpretation |
|-------|-----------|---------------|
| A | 7-8 | Comprehensive data from primary sources |
| B | 5-6 | Most data available with some gaps |
| C | 3-4 | Significant data gaps reducing reliability |
| D | 0-2 | Minimal data — results require cautious interpretation |

### 13.4 Local Demand Data Quality

The availability and density of ZIP-level local demand data affect confidence:

- When direct O*NET-coded job postings are available for the target occupation in the evaluee's ZIP market, confidence in the Local Demand score is enhanced.
- Sparse ZIP markets (very few postings) may produce unreliable posting scores due to small-sample volatility.
- **Potential future scoring adjustments:** +1 for direct posting data available; -1 for sparse ZIP markets (fewer than 5 postings in the 90-day window).

### 13.5 Transparency

Each grade includes:
- Itemized point contributions showing which data was available
- Specific penalties identifying data quality concerns
- Actionable recommendations for improving confidence (e.g., "Obtain ORS data for additional trait coverage")

---

## 15. Data Sources and Provenance

### 14.1 Government Data Sources

| Source | Publisher | Content | Update Frequency |
|--------|----------|---------|-----------------|
| DOT | U.S. Department of Labor | 12,741 occupation definitions with GED, strength, aptitudes, temperaments, physical demands, environmental conditions | Historical (1991 revision) |
| O*NET | U.S. Department of Labor | 900+ occupation profiles with tasks, DWAs, knowledge, skills, abilities, work context, tools/technology | Annually |
| ORS | Bureau of Labor Statistics | Occupational requirements survey with physical demands, cognitive requirements, environmental conditions | Periodically |
| OEWS | Bureau of Labor Statistics | Wage estimates (mean, median, percentiles) by occupation and geographic area | Annually |
| BLS Projections | Bureau of Labor Statistics | 10-year employment projections and annual openings by occupation | Biennially |
| JOLTS | Bureau of Labor Statistics | Job Openings and Labor Turnover Survey by industry and state | Monthly |
| DOT-O*NET Crosswalk | U.S. Department of Labor | Mapping between DOT codes and O*NET-SOC codes | Maintained |
| CareerOneStop Jobs V2 API | U.S. Department of Labor / CareerOneStop | Job posting data by location and occupation | Real-time |
| CareerOneStop Location API | U.S. Department of Labor / CareerOneStop | ZIP validation and county/MSA mapping | Real-time |
| Census ZIP Code Business Patterns (ZBP) | U.S. Census Bureau | Annual ZIP-level establishment and employment counts by industry (NAICS) | Annually |
| Census Quarterly Workforce Indicators (QWI) | U.S. Census Bureau, Center for Economic Studies | County/MSA hire-flow data by industry | Quarterly |
| HUD USPS ZIP Code Crosswalk Files | U.S. Department of Housing and Urban Development | ZIP to Census geography mapping (county, CBSA, tract) | Quarterly |
| LEHD LODES | U.S. Census Bureau, Center for Economic Studies | Workplace jobs at census-block level (optional enhancement) | Annually |
| BLS National Employment Matrix | U.S. Bureau of Labor Statistics | Industry-occupation staffing patterns used to allocate industry employment to occupations | Biennially |
| O*NET Web Services API | National Center for O*NET Development | Occupation search, normalization, and crosswalk data | Continuously |

### 14.2 Data Traceability

Every computed value in PVQ-TM is traceable to its source:
- Each trait comparison records whether the demand value came from ORS, DOT, O*NET, or proxy
- Each wage value is traceable to a specific OEWS year and geographic area
- Each employment projection references a specific BLS projection period
- Each JOLTS trend references specific industry and year data

---

## 16. Assumptions and Limitations

### 15.1 Explicit Assumptions

1. **Null = Not Assessed:** When a worker's capacity for a trait is null (not evaluated), the system assumes no limitation exists for that trait. The confidence grade penalizes analyses with excessive null values.

2. **Trait Independence:** The 24 traits are treated as independent dimensions. In reality, some traits may be correlated (e.g., a worker limited in strength may also be limited in climbing/balancing). Clinical judgment should supplement automated results.

3. **Static Analysis:** PVQ-TM evaluates capacity at a point in time. It does not model progressive conditions, future deterioration, or recovery trajectories.

4. **DOT Currency:** The DOT was last revised in 1991. While supplemented by O*NET and ORS data, some DOT occupation descriptions may not reflect current job requirements. The confidence grade accounts for this through data source tracking.

5. **Geographic Approximation:** Area-level data uses Metropolitan Statistical Area (MSA) boundaries, which may not precisely match the evaluee's commuting area.

6. **Auto-Estimation Conservatism:** When VAQ dimensions are auto-estimated from occupational data, the system cannot produce a "Substantial" (0) rating for work processes or industry dimensions. The minimum auto-estimated value is "Moderate" (33). Manual override is available for expert adjustment.

7. **Job Postings as Demand Proxy:** Job postings are indicators of employer demand, not verified hires. The posting score measures advertising frequency, which correlates with but does not equal actual hiring volume.

8. **Modeled Occupation-by-ZIP Employment:** Occupation-by-ZIP employment is a modeled estimate, not a direct observation. Public administrative hire counts are not published at the occupation-by-ZIP level. The structural estimate uses Census ZBP industry employment crossed with BLS staffing patterns as a proxy.

9. **ZCTA vs. USPS ZIP Codes:** Census ZCTAs and USPS ZIP codes are not interchangeable geographies. This system uses USPS ZIP codes for CareerOneStop queries and Census ZBP, with awareness that spatial boundaries may differ slightly from ZCTA-based Census products.

10. **QWI Occupation Estimation:** QWI hire-flow data is available at county/MSA level by industry, not by occupation. Occupation-level hiring momentum is estimated by applying BLS staffing patterns to industry-level QWI data.

### 15.2 Known Limitations

1. **TSP Cap at 97%:** Even perfect skill overlap cannot produce TSP = 100%, reflecting the reality that some learning is required when changing employers.

2. **VQ Scale Conversion Precision:** The reverse mapping from PVQ-TM's 0-4 scale to VQS native scales uses rounding, which could introduce minor imprecision for non-standard intermediate values. This is mitigated by the fact that DOT-sourced traits produce exact convertible values.

3. **Negative VQ Weights:** Two traits (Stooping/Kneeling and Hazards) have negative regression weights, meaning occupations demanding these traits receive slightly lower VQ scores. This is a mathematical property of the multivariate regression, not a clinical judgment.

4. **Band 4 Prediction Uncertainty:** VQ Band 4 (VQ 144-158, extremely high complexity) has the largest standard error of estimate ($8.69/hr median) and lowest predictive accuracy (Rxy = 0.83). Earning capacity estimates for Band 4 occupations should be interpreted with greater caution.

---

## 17. Repeatability and Reproducibility

### 16.1 Deterministic Computation

PVQ-TM is a purely deterministic system. Given identical inputs:
- Worker profile (24 trait values)
- Past relevant work entries (job titles, DOT codes, O*NET codes, SVP levels)
- Case parameters (age, date of injury, geographic area, prior earnings)
- Occupational database state (DOT, O*NET, ORS, OEWS, JOLTS data)

The system will always produce identical outputs. There is no randomness, no machine learning inference variability, and no subjective weighting.

### 16.2 Version Control

All computation formulas, weights, and thresholds are defined in source code with version control. Any change to methodology is tracked, dated, and documented.

### 16.3 Data Versioning

Each analysis records the data versions used (database timestamps), enabling future verification that the same data produces the same results.

### 16.4 Independent Verification

Every formula in PVQ-TM can be independently verified:
- Component weights are published (this document)
- Scoring thresholds are explicit (no hidden parameters)
- Intermediate values are logged (trait comparisons, component scores, data sources)
- An opposing expert can reproduce any calculation with the same inputs

---

## 18. Daubert Standard Compliance

### 17.1 Testability

All PVQ-TM calculations are mathematically defined and testable. The system includes 177 automated tests verifying correctness across normal conditions and edge cases. Any party can submit test inputs and verify that outputs match predictions.

### 17.2 Peer Review and Publication

The VQS regression methodology underlying the VQ and earning capacity components has been the subject of peer review and publication (McCroskey, 2001, 2011, 2015). The PVQ-TM composite methodology builds on established vocational evaluation frameworks.

### 17.3 Known Error Rates

**VQ-Based Earning Capacity:**

| VQ Band | Correlation (Rxy) | Standard Error of Estimate |
|---------|-------------------|---------------------------|
| Band 1 | 0.96 | $0.20/hr (median) |
| Band 2 | 0.98 | $0.27/hr (median) |
| Band 3 | 0.92 | $1.32/hr (median) |
| Band 4 | 0.83 | $8.69/hr (median) |

These error rates enable proper construction of confidence intervals and explicit communication of uncertainty to the trier of fact.

### 17.4 General Acceptance

PVQ-TM integrates data from the most widely accepted occupational databases in vocational rehabilitation:
- Dictionary of Occupational Titles (DOT) — standard in SSDI proceedings
- O*NET — successor to DOT, maintained by DOL
- OEWS — standard wage data in earning capacity analysis
- BLS Projections — standard employment outlook data
- JOLTS — standard labor market conditions data

### 17.5 Local Demand Triangulation

The Local Demand methodology uses three independent, complementary data sources — job postings (CareerOneStop), structural employment estimates (Census ZBP × BLS staffing patterns), and hire-flow data (QWI) — to triangulate local labor market conditions. This multi-source approach reduces reliance on any single proxy measure and strengthens the evidentiary basis for local demand conclusions by ensuring that no single data limitation (e.g., posting sparsity, modeled employment imprecision, or geographic aggregation in QWI) dominates the composite score.

### 17.6 Standards and Controls

- **SSA Policy Compliance:** SVP gating rules follow SSR 82-41; advanced age rules follow the Medical-Vocational Guidelines (Grid Rules)
- **Methodology Transparency:** All weights, thresholds, and formulas are disclosed
- **Data Provenance:** Every data point is traceable to its government source
- **Confidence Grading:** Each analysis self-reports its data quality, preventing overreliance on sparse-data results

---

## 19. References

1. McCroskey, B.J. (2001). *The Vocational Quotient System: A formula approach to the transferability of skills.* Athens, GA: Elliott & Fitzpatrick.

2. McCroskey, B.J. (2011). *Vocational Quotient System 2011 Upgrade: SOC-based database and regression analysis.* Published research and technical documentation.

3. McCroskey, B.J. (2015). *Transferable Skills Percent: Methodology, calibration, and application.* Published research.

4. U.S. Department of Labor. (1991). *Dictionary of Occupational Titles* (4th ed., revised). Washington, DC: Government Printing Office.

5. U.S. Department of Labor. (1991). *The Revised Handbook for Analyzing Jobs.* Washington, DC: Government Printing Office.

6. U.S. Department of Labor, Employment and Training Administration. *O*NET OnLine.* https://www.onetonline.org/

7. U.S. Bureau of Labor Statistics. *Occupational Employment and Wage Statistics (OEWS).* https://www.bls.gov/oes/

8. U.S. Bureau of Labor Statistics. *Occupational Requirements Survey (ORS).* https://www.bls.gov/ors/

9. U.S. Bureau of Labor Statistics. *Employment Projections.* https://www.bls.gov/emp/

10. U.S. Bureau of Labor Statistics. *Job Openings and Labor Turnover Survey (JOLTS).* https://www.bls.gov/jlt/

11. Social Security Administration. (1982). *Social Security Ruling 82-41: Work Skills and Their Transferability as Intended by the Expanded Vocational Factors Regulations Effective February 26, 1979.* Federal Register.

12. Social Security Administration. *Medical-Vocational Guidelines (Grid Rules).* 20 CFR Part 404, Subpart P, Appendix 2.

13. Grimley, R., et al. (2000). *Transferable skills prediction model in vocational evaluation.* Journal of Forensic Economics.

14. CareerOneStop. (n.d.). *Jobs V2 API.* U.S. Department of Labor, Employment and Training Administration. https://www.careeronestop.org/Developers/WebAPI/web-api.aspx

15. CareerOneStop. (n.d.). *Location API.* U.S. Department of Labor, Employment and Training Administration. https://www.careeronestop.org/Developers/WebAPI/web-api.aspx

16. CareerOneStop. (n.d.). *Labor Market Information API.* U.S. Department of Labor, Employment and Training Administration. https://www.careeronestop.org/Developers/WebAPI/web-api.aspx

17. U.S. Census Bureau. (2024). *ZIP Code Business Patterns (ZBP) API.* https://www.census.gov/data/developers/data-sets/cbp-nonemp-zbp.html

18. U.S. Census Bureau. (2026). *Quarterly Workforce Indicators (QWI).* Center for Economic Studies, Longitudinal Employer-Household Dynamics Program. https://lehd.ces.census.gov/data/

19. U.S. Department of Housing and Urban Development. (2026). *HUD USPS ZIP Code Crosswalk Files.* https://www.huduser.gov/portal/datasets/usps_crosswalk.html

20. U.S. Census Bureau, Center for Economic Studies. (n.d.). *LEHD Origin-Destination Employment Statistics (LODES).* https://lehd.ces.census.gov/data/lodes/

21. National Center for O*NET Development. (2026). *O*NET Web Services.* https://services.onetcenter.org/

22. National Center for O*NET Development. (2026). *Crosswalk files.* https://www.onetcenter.org/crosswalks.html

---

*This white paper documents the PVQ-TM system as implemented in version 1.1, March 2026. All formulas, weights, and thresholds are derived directly from the production source code and have been verified against 245 automated tests.*
