# PVQ-TM Manual Calculation Guide

**Version:** 1.0
**System:** PVQ-TM Standardized Engine
**Purpose:** Complete formula reference enabling manual reproduction of any PVQ score with a calculator.

---

## Table of Contents

1. [Trait Normalization Reference Tables](#section-1-trait-normalization-reference-tables)
2. [Skill Transfer Quotient (STQ)](#section-2-skill-transfer-quotient-stq)
3. [Trait Feasibility Quotient (TFQ)](#section-3-trait-feasibility-quotient-tfq)
4. [Vocational Adjustment Quotient (VAQ)](#section-4-vocational-adjustment-quotient-vaq)
5. [Labor Market Quotient (LMQ)](#section-5-labor-market-quotient-lmq)
6. [PVQ Composite](#section-6-pvq-composite)
7. [Vocational Quotient (VQ) Regression](#section-7-vocational-quotient-vq-regression)
8. [Earning Capacity (EC)](#section-8-earning-capacity-ec)
9. [Component Profile Code (CPC)](#section-9-component-profile-code-cpc)
10. [Transferable Skills Percent (TSP)](#section-10-transferable-skills-percent-tsp)
11. [Complete Worked Example](#section-11-complete-worked-example)

---

## Section 1: Trait Normalization Reference Tables

The PVQ-TM system uses a unified **24-trait vector** with all values normalized to a **0-4 scale**.

### 1.1 The 24 Traits

| # | Key | Label | Group |
|---|-----|-------|-------|
| 1 | reasoning | Reasoning | Aptitude |
| 2 | math | Math | Aptitude |
| 3 | language | Language | Aptitude |
| 4 | spatialPerception | Spatial Perception | Aptitude |
| 5 | formPerception | Form Perception | Aptitude |
| 6 | clericalPerception | Clerical Perception | Aptitude |
| 7 | motorCoordination | Motor Coordination | Physical |
| 8 | fingerDexterity | Finger Dexterity | Physical |
| 9 | manualDexterity | Manual Dexterity | Physical |
| 10 | eyeHandFoot | Eye-Hand-Foot Coord. | Physical |
| 11 | colorDiscrimination | Color Discrimination | Physical |
| 12 | strength | Strength | Physical |
| 13 | climbBalance | Climb/Balance | Physical |
| 14 | stoopKneel | Stoop/Kneel | Physical |
| 15 | reachHandle | Reach/Handle | Physical |
| 16 | talkHear | Talk/Hear | Physical |
| 17 | see | See | Physical |
| 18 | workLocation | Work Location | Environmental |
| 19 | extremeCold | Extreme Cold | Environmental |
| 20 | extremeHeat | Extreme Heat | Environmental |
| 21 | wetnessHumidity | Wetness/Humidity | Environmental |
| 22 | noiseVibration | Noise/Vibration | Environmental |
| 23 | hazards | Hazards | Environmental |
| 24 | dustsFumes | Dusts/Fumes | Environmental |

### Scale Semantics

| Value | Strength Label | Frequency Label | General Label |
|-------|---------------|----------------|---------------|
| 0 | Sedentary | Not Present | None |
| 1 | Light | Seldom | Low |
| 2 | Medium | Occasionally | Moderate |
| 3 | Heavy | Frequently | High |
| 4 | Very Heavy | Constantly | Extreme |

### 1.2 DOT GED (1-6) to 0-4

**Formula:**

```
normalized = (gedLevel - 1) x (4 / 5)
```

Equivalently: `normalized = (gedLevel - 1) x 0.8`

Result is rounded to 2 decimal places.

**Complete Table:**

| DOT GED Level | Normalized (0-4) |
|---------------|-----------------|
| 1 | 0.00 |
| 2 | 0.80 |
| 3 | 1.60 |
| 4 | 2.40 |
| 5 | 3.20 |
| 6 | 4.00 |

**Edge cases:** Values < 1 return 0; values > 6 return 4.

Applies to traits: **reasoning**, **math**, **language**.

### 1.3 DOT Aptitude (1-5, inverted) to 0-4

**Formula:**

```
normalized = 5 - dotValue
```

Result clamped to minimum of 0: `max(0, 5 - dotValue)`

DOT aptitude scale is inverted: 1 = highest aptitude (top 10%), 5 = lowest (bottom 10%).

**Complete Table:**

| DOT Aptitude | Meaning | Normalized (0-4) |
|-------------|---------|-----------------|
| 1 | Top 10% | 4 |
| 2 | Top 33% | 3 |
| 3 | Middle 33% | 2 |
| 4 | Lower 33% | 1 |
| 5 | Bottom 10% | 0 |

Applies to traits: **spatialPerception**, **formPerception**, **clericalPerception**, **motorCoordination**, **fingerDexterity**, **manualDexterity**, **eyeHandFoot**, **colorDiscrimination**.

### 1.4 DOT Strength Code to 0-4

**Mapping Table:**

| DOT Code | Label | Normalized (0-4) |
|----------|-------|-----------------|
| S | Sedentary | 0 |
| L | Light | 1 |
| M | Medium | 2 |
| H | Heavy | 3 |
| V | Very Heavy | 4 |

Applies to trait: **strength**.

### 1.5 DOT Physical Demands / Environmental Conditions to 0-4

**Mapping Table:**

| DOT Code | Label | Normalized (0-4) |
|----------|-------|-----------------|
| N | Not Present | 0 |
| S | Seldom | 1 |
| O | Occasionally | 2 |
| F | Frequently | 3 |
| C | Constantly | 4 |

Applies to traits: **climbBalance**, **stoopKneel**, **reachHandle**, **talkHear**, **see**, **workLocation**, **extremeCold**, **extremeHeat**, **wetnessHumidity**, **noiseVibration**, **hazards**, **dustsFumes**.

### 1.6 O\*NET Level (0-7) to 0-4

**Formula:**

```
normalized = min(4, max(0, (level / 7) x 4))
```

Result is rounded to 2 decimal places.

**Sample Values:**

| O\*NET Level | Normalized |
|-------------|-----------|
| 0 | 0.00 |
| 1 | 0.57 |
| 2 | 1.14 |
| 3 | 1.71 |
| 3.5 | 2.00 |
| 4 | 2.29 |
| 5 | 2.86 |
| 6 | 3.43 |
| 7 | 4.00 |

Used for O\*NET abilities mapped to traits: **spatialPerception** (1.A.1.f.1), **formPerception** (1.A.1.f.2), **clericalPerception** (1.A.1.e.3), **eyeHandFoot** (1.A.2.b.2), **colorDiscrimination** (1.A.4.a.3).

### 1.7 O\*NET Score (0-100) to 0-4

**Formula:**

```
normalized = min(4, max(0, (score / maxScale) x 4))
```

Where `maxScale` defaults to 100. Rounded to 2 decimal places.

---

## Section 2: Skill Transfer Quotient (STQ)

The STQ measures the degree of transferable skills from Prior Relevant Work (PRW) to a target occupation.

### 2.1 SVP Gate (Hard Prerequisite)

**Rule:** Target SVP must be less than or equal to the highest source PRW SVP.

```
IF targetSVP > max(sourceSVP for all PRW entries) THEN STQ = 0, EXCLUDED
```

A PRW entry must have SVP >= 4 (semiskilled minimum) to contribute transferable skills.

### 2.2 Similarity Functions

Three similarity measures are computed for each component, and the **maximum** is selected:

#### Jaccard Similarity

```
Jaccard(A, B) = |A intersection B| / |A union B|
```

Both sets are lowercased and trimmed before comparison. Returns 0 if both sets are empty.

#### Token Overlap (with Stemming)

Each string array is tokenized (split on whitespace), words shorter than 3 characters are discarded, and both the exact token and its stemmed form are added to the token set.

**Stemming suffix regex** (applied in sequence, the first match is replaced and removed):

1. `/ying$/` replaced with `"y"`
2. `/(tion|sion|ment|ness|ence|ance|ible|able|ious|eous|ical|ally|ings|ated|ting|ling|ling)$/` replaced with `""`
3. `/(ing|ies|ied|ers|est|ous|ful|ive|ize|ise|ant|ent|ism|ist|ity)$/` replaced with `""`
4. `/(ed|er|ly|al|or|es|en)$/` replaced with `""`
5. `/(s)$/` replaced with `""`

Words of length <= 4 are not stemmed.

```
TokenOverlap(A, B) = |tokens(A) intersection tokens(B)| / |tokens(A) union tokens(B)|
```

#### Dice Coefficient

```
Dice(A, B) = 2 x |stemmedA intersection stemmedB| / (|stemmedA| + |stemmedB|)
```

Where sets are stemmed, lowercased, and trimmed. Returns 0 if denominator is 0.

#### Selection Rule

For each component:

```
componentOverlap = max(Jaccard, TokenOverlap, Dice) x 100
```

### 2.3 Component Weights (Skilled Worker Pathway, SVP >= 4)

| Component | Weight | Description |
|-----------|--------|-------------|
| Task/DWA Overlap | 0.35 | Combined tasks + DWAs, best-of-three similarity |
| Work Field / MPSMS | 0.25 | Average of Jaccard(workFields) and Jaccard(MPSMS), x 100 |
| Tools Overlap | 0.20 | Best-of-three similarity on tools/software |
| Materials Overlap | 0.10 | Best-of-three similarity on materials/services |
| Credential/Knowledge | 0.10 | Best-of-three similarity on knowledge domains |

**Note on Work Field / MPSMS:** This component uses only Jaccard (not best-of-three). The formula is:

```
wfMpsmsOverlap = ((Jaccard(sourceWorkFields, targetWorkFields) + Jaccard(sourceMPSMS, targetMPSMS)) / 2) x 100
```

### 2.4 Final STQ Formula (Skilled)

```
STQ = 0.35 x taskDwaOverlap + 0.25 x wfMpsmsOverlap + 0.20 x toolsOverlap + 0.10 x materialsOverlap + 0.10 x credentialOverlap
```

Result is rounded to 2 decimal places. Range: 0 to 100.

### 2.5 Unskilled Worker Pathway (SVP < 4)

When all PRW entries have SVP < 4 AND the target occupation has SVP <= 3, an alternative scoring applies:

| Component | Weight |
|-----------|--------|
| Task/DWA Overlap | 0.50 |
| Tools Overlap | 0.30 |
| Work Field / MPSMS | 0.20 |

```
STQ_unskilled = 0.50 x taskOverlap + 0.30 x toolsOverlap + 0.20 x wfOverlap
```

The SVP gate always passes for unskilled targets (SVP <= 3).

### 2.6 Aggregate STQ (Multiple PRW)

When an evaluee has multiple PRW entries, each is individually scored against the target. The PRW entry producing the **highest STQ** is used as the final result.

---

## Section 3: Trait Feasibility Quotient (TFQ)

The TFQ determines whether a worker's post-injury capacities meet an occupation's physical and cognitive demands.

### 3.1 Pass/Fail Rule (Categorical Comparison)

For each of the 24 traits:

```
passes = (workerCapacity >= floor(occupationDemand))
```

**Categorical tolerance:** Occupation demands are floored to their integer category for comparison. This prevents false exclusions when both worker and occupation are in the same categorical band (e.g., worker=2 vs demand=2.48 both represent "Occasionally").

The raw margin is still computed for reserve scoring:

```
margin = workerCapacity - occupationDemand   (can be fractional)
```

### 3.2 Analysis Modes

#### Strict Mode (SSA/Litigation)

Any single trait failure = **automatic exclusion** (TFQ = 0, passes = false).

#### Clinical Mode (Rehabilitation)

Failures are classified:
- **Marginal failure:** |margin| <= 1.0 (deficit within one categorical level)
- **Severe failure:** |margin| > 1.0

Rules:
- Any severe failure = exclusion
- More than 1 marginal failure = exclusion
- Exactly 1 marginal failure = tolerated, with a **15-point TFQ penalty**

```
TFQ_clinical = max(0, min(100, reserveMargin - 15 x marginalFailureCount))
```

### 3.3 Reserve Margin Formula

Among surviving occupations (all traits pass), the TFQ score is based on the reserve margin:

```
rawMargin = (sum of margins for rated traits) / (ratedTraitCount x 4) x 100
```

Where:
- `margin_i = workerCapacity_i - occupationDemand_i` for each trait where both values are non-null
- `ratedTraitCount` = number of traits where both capacity and demand are available
- Factor of 4 represents the maximum possible scale range (0-4)

**Data Coverage Penalty:**

```
COVERAGE_THRESHOLD = 12
coverageFactor = min(1.0, ratedTraitCount / 12)
reserveMargin = rawMargin x coverageFactor
```

If fewer than 12 traits have data, the margin is linearly penalized. Full credit at 12+ rated traits.

### 3.4 Final TFQ (Strict Mode, All Traits Pass)

```
TFQ = min(100, max(0, reserveMargin))
```

Result is rounded to 2 decimal places.

---

## Section 4: Vocational Adjustment Quotient (VAQ)

The VAQ rates the degree of vocational adjustment required in four dimensions.

### 4.1 Ordinal Scale

| Score | Label | Meaning |
|-------|-------|---------|
| 100 | Very little or none | Minimal adjustment needed |
| 67 | Slight | Some adjustment |
| 33 | Moderate | Significant adjustment |
| 0 | Substantial | Complete change required |

### 4.2 Four Dimensions

1. **Tools** - equipment and technology overlap
2. **Work Processes** - methods, procedures, workflow similarity
3. **Work Setting** - physical environment and context
4. **Industry** - industry sector alignment

### 4.3 VAQ Formula

```
VAQ = (tools + workProcesses + workSetting + industry) / 4
```

Result is rounded to 2 decimal places.

### 4.4 Auto-Estimation Thresholds

When evaluator ratings are not provided, dimensions are auto-estimated from data:

#### Tools Dimension (O\*NET tools/tech overlap)

Uses the **smaller set** as denominator for overlap calculation:

```
overlap = |sourceTools intersection targetTools| / min(|sourceTools|, |targetTools|)
```

| Overlap | Rating |
|---------|--------|
| > 75% | 100 (Very little or none) |
| > 50% | 67 (Slight) |
| > 25% | 33 (Moderate) |
| <= 25% | 0 (Substantial) |
| No data | 33 (Conservative default) |

#### Work Processes Dimension (GOE code similarity)

| Condition | Rating |
|-----------|--------|
| Same GOE group (first 4+ chars) | 100 |
| Same GOE division (first 2 chars) | 67 |
| Different GOE division | 33 |
| No GOE data | 33 (Conservative default) |

#### Work Setting Dimension (Industry designation)

| Condition | Rating |
|-----------|--------|
| Exact industry designation match | 100 |
| Shared significant words | 67 |
| No overlap | 33 |
| No data | 33 (Conservative default) |

#### Industry Dimension (Broader sector comparison)

| Condition | Rating |
|-----------|--------|
| Same primary sector (first significant word) | 100 |
| Any word overlap | 67 |
| No overlap | 33 |
| No data | 33 (Conservative default) |

### 4.5 Advanced Age Rule

Applies when `ageRule` is `"advanced_age"` or `"closely_approaching"`:

```
IF age >= 55 (advanced age / closely approaching) AND any dimension < 100:
  IF autoEstimated:
    passes = true (tentatively), pendingEvaluatorReview = true
  ELSE:
    passes = false, VAQ = 0
    exclusionReason = "Advanced age rule requires very little or no vocational adjustment"
```

---

## Section 5: Labor Market Quotient (LMQ)

The LMQ assesses labor market viability of a target occupation.

### 5.1 Component Scoring Functions

#### Employment Score (National)

**Formula (log-based continuous):**

```
logScore = (log10(max(1, employment)) - 2) x (90 / 3.7) + 10
employmentScore = round(max(5, min(100, logScore)))
```

If employment is null: score = 50 (neutral). If employment <= 0: score = 5.

**Approximate mapping:**

| Employment | Score |
|-----------|-------|
| 100 | ~10 |
| 1,000 | ~30 |
| 5,000 | ~45 |
| 20,000 | ~60 |
| 50,000 | ~75 |
| 100,000 | ~85 |
| 500,000 | ~100 |

#### Wage Score

**With prior earnings:**

```
ratio = medianWage / priorEarnings
score = round(max(10, min(100, 10 + min(90, ratio x 90))))
```

Mapping: ratio 0 = score 10, ratio 1.0 = score 100, capped at 100.

**Without prior earnings (absolute wage):**

```
absScore = (medianWage / 80000) x 100
score = round(max(10, min(100, absScore)))
```

Mapping: $15k = 20, $30k = 45, $45k = 65, $60k = 80, $80k+ = 100.

If medianWage is null: score = 50.

#### Projections Score

Average of growth sub-score and openings sub-score:

**Growth sub-score:**

```
growthScore = 50 + (projectedGrowthPct / 15) x 50
growthScore = max(10, min(100, round(growthScore)))
```

Mapping: -10% = 10, 0% = 50, +15% = 100. Null = 50.

**Openings sub-score (log-based):**

```
openingsScore = (log10(max(1, projectedOpenings)) - 1.5) x (90 / 3.2) + 20
openingsScore = max(10, min(100, round(openingsScore)))
```

If openings <= 0: score = 10. Null = 50.

```
projectionsScore = round((growthScore + openingsScore) / 2)
```

If both growth and openings are null: score = 50.

#### JOLTS Trend Score

```
score = 60 + trend x 40
score = max(0, min(100, round(score)))
```

| Trend Value | Score |
|-------------|-------|
| +1.0 (strongly growing) | 100 |
| +0.5 (growing) | 80 |
| 0.0 (stable) | 60 |
| -0.5 (declining) | 40 |
| -1.0 (strongly declining) | 20 |

Returns -1 if null (signal: no data available, weight redistributes).

#### Local Demand Score

If `localDemandScore` is provided (0-100 from Local Demand engine): used directly, clamped to [0, 100].

**Legacy fallback** (areaEmployment count, log-based):

```
logScore = (log10(max(1, areaEmployment)) - 1) x (90 / 3.7) + 10
areaScore = round(max(5, min(100, logScore)))
```

Returns -1 if null (weight redistributes).

### 5.2 LMQ Base Weights

| Component | Base Weight |
|-----------|------------|
| Employment (national) | 0.25 |
| Wage | 0.25 |
| Projections | 0.20 |
| Local Demand | 0.15 |
| JOLTS Trend | 0.15 |

### 5.3 Weight Redistribution

When optional components (Local Demand, JOLTS) have no data (score = -1), their weights are **redistributed proportionally** to available components:

```
normalizedWeight_i = baseWeight_i / sum(baseWeights of available components)
```

**Example:** If JOLTS unavailable and Local Demand available:

Available weights: 0.25 + 0.25 + 0.20 + 0.15 = 0.85

```
employment: 0.25 / 0.85 = 0.294
wage:       0.25 / 0.85 = 0.294
projections:0.20 / 0.85 = 0.235
localDemand:0.15 / 0.85 = 0.176
```

**Example:** If both JOLTS and Local Demand unavailable:

Available weights: 0.25 + 0.25 + 0.20 = 0.70

```
employment: 0.25 / 0.70 = 0.357
wage:       0.25 / 0.70 = 0.357
projections:0.20 / 0.70 = 0.286
```

### 5.4 Final LMQ Formula

```
LMQ = sum(normalizedWeight_i x score_i) for all available components
```

Result is rounded to 2 decimal places.

---

## Section 6: PVQ Composite

### 6.1 PVQ Formula

```
PVQ = 0.45 x STQ + 0.25 x TFQ + 0.15 x VAQ + 0.15 x LMQ
```

Result is rounded to 2 decimal places. Range: 0 to 100.

### 6.2 Exclusion Gate Order

Gates are checked in this order. If any gate fails, PVQ = 0 and the occupation is excluded:

1. **SVP Gate** (from STQ): target SVP > source SVP
2. **Trait Gate** (from TFQ): any trait failure (strict) or severe/multiple failure (clinical)
3. **Age Gate** (from VAQ): advanced age + any adjustment needed (unless auto-estimated)

### 6.3 Confidence Grade Scoring

The confidence grade uses an 8-point maximum scoring system:

| Component | Condition | Points |
|-----------|-----------|--------|
| **STQ Data** | Matched tasks or DWAs exist | +2 |
| | STQ > 0 but no exact matches | +1 |
| | No skill transfer data | +0 |
| **TFQ Trait Coverage** | >= 20 traits rated | +3 |
| | >= 15 traits rated | +2 |
| | >= 10 traits rated | +1 |
| | < 10 traits rated | +0 |
| **TFQ Proxy Penalty** | > 10 proxy-derived traits | -1 |
| **LMQ Employment** | National employment available | +1 |
| **LMQ Wage** | Median wage available | +1 |
| **LMQ Projections** | Projected openings available | +1 |

**Maximum possible score:** 8 (2 + 3 + 1 + 1 + 1)

**Grade Thresholds:**

| Grade | Score Range | Meaning |
|-------|-----------|---------|
| A | >= 7 | Comprehensive data from primary sources |
| B | 5-6 | Most data available, some proxy-derived |
| C | 3-4 | Significant data gaps |
| D | < 3 | Minimal data available |

---

## Section 7: Vocational Quotient (VQ) Regression

### 7.1 VQ Formula

```
VQ = 34.56707 + sum(weight_i x nativeValue_i) for all 24 traits
```

Result is clamped to [68, 158] and rounded to 2 decimal places.

### 7.2 All 24 VQ Regression Weights

| # | Trait Key | VQS Variable | Weight | Scale Group |
|---|-----------|-------------|--------|-------------|
| 0 | reasoning | GEDR | 5.299567 | GED |
| 1 | math | GEDM | 2.213121 | GED |
| 2 | language | GEDL | 1.424168 | GED |
| 3 | spatialPerception | APTS | 2.241977 | APT |
| 4 | formPerception | APTP | 1.783972 | APT |
| 5 | clericalPerception | APTQ | 1.95779 | APT |
| 6 | motorCoordination | APTK | 1.648707 | APT |
| 7 | fingerDexterity | APTF | 1.631036 | APT |
| 8 | manualDexterity | APTM | 2.126616 | APT |
| 9 | eyeHandFoot | APTE | 1.403101 | APT |
| 10 | colorDiscrimination | APTC | 1.431217 | APT |
| 11 | strength | PD1 | 1.84953 | PD1 |
| 12 | climbBalance | PD2 | 0.774892 | PD Binary |
| 13 | stoopKneel | PD3 | -0.165864 | PD Binary |
| 14 | reachHandle | PD4 | 0.776669 | PD Binary |
| 15 | talkHear | PD5 | 4.542681 | PD Binary |
| 16 | see | PD6 | 0.201044 | PD Binary |
| 17 | workLocation | EC1 | 1.470938 | EC1 |
| 18 | extremeCold | EC2 | 0.330026 | EC Binary |
| 19 | extremeHeat | EC3 | 0.504727 | EC Binary |
| 20 | wetnessHumidity | EC4 | 0.371165 | EC Binary |
| 21 | noiseVibration | EC5 | 1.217675 | EC Binary |
| 22 | hazards | EC6 | -0.200072 | EC Binary |
| 23 | dustsFumes | EC7 | 0.298293 | EC Binary |

**Intercept:** 34.56707

### 7.3 Scale Conversion (PVQ-TM 0-4 to VQS Native DOT Scales)

Before applying regression weights, PVQ-TM normalized values (0-4) must be reverse-mapped to VQS native DOT scales:

| Scale Group | Traits | PVQ-TM Range | VQS Native Range | Conversion Formula |
|------------|--------|-------------|------------------|-------------------|
| GED | reasoning, math, language | 0-4 | 1-6 | `round((norm / 4) x 5) + 1` |
| APT | spatial, form, clerical, motor, finger, manual, eyeHand, color | 0-4 | 1-5 | `round((norm / 4) x 4) + 1` |
| PD1 | strength | 0-4 | 1-5 | `round((norm / 4) x 4) + 1` |
| PD Binary | climb, stoop, reach, talk, see | 0-4 | 0-1 | `norm >= 2 ? 1 : 0` |
| EC1 | workLocation | 0-4 | 1-3 | `round((norm / 4) x 2) + 1` |
| EC Binary | cold, heat, wetness, noise, hazards, dusts | 0-4 | 0-1 | `norm >= 2 ? 1 : 0` |

### 7.4 VQS Default Profile (for null trait substitution)

When a trait value is null/missing, the following VQS native-scale defaults are used:

| Index | Trait | Default (Native Scale) |
|-------|-------|----------------------|
| 0 | reasoning | 3 |
| 1 | math | 2 |
| 2 | language | 2 |
| 3 | spatialPerception | 2 |
| 4 | formPerception | 3 |
| 5 | clericalPerception | 2 |
| 6 | motorCoordination | 3 |
| 7 | fingerDexterity | 2 |
| 8 | manualDexterity | 3 |
| 9 | eyeHandFoot | 2 |
| 10 | colorDiscrimination | 2 |
| 11 | strength | 2 |
| 12 | climbBalance | 0 |
| 13 | stoopKneel | 0 |
| 14 | reachHandle | 1 |
| 15 | talkHear | 0 |
| 16 | see | 1 |
| 17 | workLocation | 2 |
| 18 | extremeCold | 0 |
| 19 | extremeHeat | 0 |
| 20 | wetnessHumidity | 0 |
| 21 | noiseVibration | 1 |
| 22 | hazards | 0 |
| 23 | dustsFumes | 0 |

### 7.5 VQ Band Structure

| Band | VQ Range | Label | Percentile Range | % of Jobs |
|------|----------|-------|-----------------|-----------|
| 1 | 68.00 - 99.99 | Below Average to Mid-Average | 1st-50th | 50% |
| 2 | 100.00 - 108.99 | Mid-Average to High-Average | 50th-67th | 17% |
| 3 | 109.00 - 143.99 | High-Average to Very-High | 67th-99th | 32% |
| 4 | 144.00 - 158.00 | Extremely High | 99th-100th | 1% |

**Band classification logic:**

```
IF vq < 100  THEN band = 1
IF vq < 109  THEN band = 2
IF vq < 144  THEN band = 3
ELSE              band = 4
```

---

## Section 8: Earning Capacity (EC)

### 8.1 ECLR (Earning Capacity Link Relative)

**Formula:**

```
ECLR = areaMedianWage / nationalMedianWage
```

Clamped to [0.5, 2.0]. Rounded to 4 decimal places. Returns 1.0 if data is insufficient.

### 8.2 Wage Conversion

OEWS wages (annual) are converted to hourly:

```
hourlyWage = annualWage / 2080
```

Then ECLR-adjusted:

```
adjustedHourly = hourlyWage x ECLR
```

### 8.3 Confidence Interval (95%)

```
CI_lower = max(0, median - 1.96 x SEE)
CI_upper = median + 1.96 x SEE
```

Where SEE is the Standard Error of Estimate for the VQ band (using median SEE).

### 8.4 Published VQ Band Statistics

| Band | Rxy (Mean) | Rxy (Median) | SEE Mean ($/hr) | SEE Median ($/hr) | SEE P10 ($/hr) | SEE P90 ($/hr) |
|------|-----------|-------------|-----------------|-------------------|----------------|----------------|
| 1 | 0.96 | 0.96 | 0.25 | 0.20 | 0.15 | 0.63 |
| 2 | 0.98 | 0.98 | 0.38 | 0.27 | 0.20 | 0.63 |
| 3 | 0.92 | 0.92 | 2.00 | 1.32 | 0.90 | 3.04 |
| 4 | 0.83 | 0.83 | 12.47 | 8.69 | 6.00 | 19.26 |

**Source:** McCroskey, Dennis, Wilkinson, et al. (2011). Year 2007 SOC Data curvilinear regression results.

---

## Section 9: Component Profile Code (CPC)

### 9.1 237-Dimension Breakdown

| Taxonomy | Dimension Range | Count |
|----------|----------------|-------|
| Knowledge | 0-32 | 33 |
| Skills | 33-67 | 35 |
| Abilities | 68-119 | 52 |
| Work Activities | 120-160 | 41 |
| Work Context | 161-215 | 55 |
| Work Styles | 216-236 | 21 |
| **Total** | | **237** |

### 9.2 Vector Construction

For each O\*NET element within an occupation:

**Knowledge, Skills, Abilities, Work Activities:**

```
score = importance x level
```

Where `importance` = O\*NET importance value (`v`), `level` = O\*NET level value (`l`).

**Work Context and Work Styles:**

```
score = importance
```

(Only importance/value is used; no level component.)

### 9.3 L2 Normalization

After computing all 237 raw scores:

```
norm = sqrt(sum(score_i^2) for i = 0..236)

IF norm > 0:
  normalized_i = score_i / norm   for each dimension i
ELSE:
  normalized_i = 0   (vector unchanged)
```

### 9.4 Cosine Similarity

Between two L2-normalized vectors A and B:

```
cosineSimilarity(A, B) = sum(A_i x B_i) for i = 0..236
```

Since both vectors are unit-length (L2-normalized), the cosine similarity equals the dot product.

Result is clamped to [0, 1].

### 9.5 CPC Code Format

**Format:** `KK.kk-SS.ss-AA.aa-WW.ww-ZP-CCRS`

| Segment | Meaning | Range |
|---------|---------|-------|
| KK.kk | Primary.Secondary knowledge domain | 01-33 |
| SS.ss | Primary.Secondary skill domain | 01-35 |
| AA.aa | Primary.Secondary ability domain | 01-52 |
| WW.ww | Primary.Secondary work activity | 01-41 |
| Z | Job zone | 1-5 |
| P | Physical strength demand | 1-5 (S/L/M/H/V) |
| CCRS | ORS physical demands (Climb, Crouch/Stoop, Reach, Sensory/Manip) | each 0-4 |

**Example:** `01.03-07.29-01.08-15.22-32-1230`

---

## Section 10: Transferable Skills Percent (TSP)

### 10.1 Five-Tier System

| Tier | TSP Range | Label |
|------|----------|-------|
| 1 | 0-19% | Unskilled, no significant transferable skills |
| 2 | 20-39% | Semi-skilled to skilled, no significant transferable skills |
| 3 | 40-59% | Semi-skilled to skilled, low transferable skills |
| 4 | 60-79% | Semi-skilled to skilled, moderate transferable skills |
| 5 | 80-97% | Semi-skilled to skilled, high transferable skills |

**Maximum TSP = 97%** (even re-entering the same occupation requires some new learning).

### 10.2 Tier Determination Rules (DOT/O\*NET Prefix Matching)

Tiers are determined by DOT code prefix length and O\*NET code matching:

| Rule | Condition | Tier |
|------|-----------|------|
| 1 | Target VQ < 85 | 1 |
| 2 | DOT 3-digit match AND full O\*NET match | 5 |
| 3a | DOT 3-digit match | 4 |
| 3b | Full O\*NET code match | 4 |
| 3c | DOT 2-digit AND O\*NET 4-char match | 4 |
| 4a | DOT 2-digit match | 3 |
| 4b | O\*NET 4-char match | 3 |
| 4c | DOT 1-digit AND O\*NET 2-char match | 3 |
| 5 | Default (limited overlap) | 2 |

DOT prefix: compare digit-by-digit from left (non-numeric characters stripped).
O\*NET prefix: compare character-by-character after stripping `.XX` detail suffix.

### 10.3 Component Weights

| Component | Weight | Formula |
|-----------|--------|---------|
| Trait Similarity | 0.30 | Avg of per-trait similarity: `1 - |source - target| / 4` |
| Trait Coverage | 0.16 | Proportion of target traits met by source |
| DOT Prefix Score | 0.14 | 3+ digits=1.0, 2=0.67, 1=0.33, 0=0.0 |
| O\*NET Prefix Score | 0.14 | Full=1.0, 4+ chars=0.75, 2+ chars=0.45, else=0.0 |
| VQ Proximity | 0.08 | `1 - |sourceVQ - targetVQ| / 60`, clamped [0,1] |
| SVP Proximity | 0.06 | `1 - |sourceSVP - targetSVP| / 8`, clamped [0,1] |
| Strength Proximity | 0.12 | `1 - |sourceStr - targetStr| / 4`, clamped [0,1] |

### 10.4 TSP Computation

**Step 1:** Compute weighted base (0-1):

```
weightedBase = 0.30 x traitSim + 0.16 x traitCov + 0.14 x dotPrefix + 0.14 x onetPrefix + 0.08 x vqProx + 0.06 x svpProx + 0.12 x strProx
```

**Step 2:** Compute tier core score (structural similarity emphasis):

```
tierCoreScore = 0.38 x dotPrefix + 0.22 x onetPrefix + 0.15 x vqProx + 0.10 x svpProx + 0.15 x strProx
```

**Step 3:** Compute in-tier progress:

| Tier | Formula |
|------|---------|
| 5 | `clamp01(tierCoreScore - 0.1)` |
| 1 | `clamp01(weightedBase)` |
| 2-4 | `clamp01(tierCoreScore - 0.45)` |

**Step 4:** Compute final TSP:

```
TSP = tierMin + inTierProgress x (tierMax - tierMin)
TSP = max(0, min(97, round(TSP x 10) / 10))
```

---

## Section 11: Complete Worked Example

### Case Setup

**Worker:** Former Construction Laborer (DOT 869.664-014), age 42
- Post-injury restriction: Sedentary work only
- Prior earnings: $45,000/year
- PRW SVP: 4 (semiskilled)
- PRW O\*NET: 47-2061.00

**Target Occupation:** Cashier (DOT 211.462-010, O\*NET 41-2011.00)
- SVP: 3 (unskilled)
- National employment: 3,500,000
- Median wage: $29,120/year
- Projected growth: +1%
- Projected openings: 500,000/year

### Step 1: Trait Normalization

**Worker Post-Profile (capacities after injury):**

| Trait | Raw Rating | Source | Normalized |
|-------|-----------|--------|-----------|
| reasoning | GED R=3 | DOT | (3-1) x 0.8 = **1.60** |
| math | GED M=2 | DOT | (2-1) x 0.8 = **0.80** |
| language | GED L=2 | DOT | (2-1) x 0.8 = **0.80** |
| spatialPerception | Apt=4 | DOT | 5 - 4 = **1** |
| formPerception | Apt=4 | DOT | 5 - 4 = **1** |
| clericalPerception | Apt=4 | DOT | 5 - 4 = **1** |
| motorCoordination | Apt=3 | DOT | 5 - 3 = **2** |
| fingerDexterity | Apt=3 | DOT | 5 - 3 = **2** |
| manualDexterity | Apt=3 | DOT | 5 - 3 = **2** |
| eyeHandFoot | Level=2.0 | O\*NET | (2.0/7) x 4 = **1.14** |
| colorDiscrimination | Level=1.5 | O\*NET | (1.5/7) x 4 = **0.86** |
| strength | Sedentary post-injury | Evaluator | **0** |
| climbBalance | N | Post-profile | **0** |
| stoopKneel | S | Post-profile | **1** |
| reachHandle | O | Post-profile | **2** |
| talkHear | F | Post-profile | **3** |
| see | O | Post-profile | **2** |
| workLocation | N | Post-profile | **0** |
| extremeCold | N | Post-profile | **0** |
| extremeHeat | N | Post-profile | **0** |
| wetnessHumidity | N | Post-profile | **0** |
| noiseVibration | S | Post-profile | **1** |
| hazards | N | Post-profile | **0** |
| dustsFumes | N | Post-profile | **0** |

**Cashier Occupation Demands:**

| Trait | Raw | Source | Normalized |
|-------|-----|--------|-----------|
| reasoning | GED R=3 | DOT | **1.60** |
| math | GED M=3 | DOT | **1.60** |
| language | GED L=3 | DOT | **1.60** |
| spatialPerception | Apt=4 | DOT | **1** |
| formPerception | Apt=4 | DOT | **1** |
| clericalPerception | Apt=3 | DOT | **2** |
| motorCoordination | Apt=3 | DOT | **2** |
| fingerDexterity | Apt=3 | DOT | **2** |
| manualDexterity | Apt=3 | DOT | **2** |
| eyeHandFoot | Level=1.0 | O\*NET | **0.57** |
| colorDiscrimination | Level=1.0 | O\*NET | **0.57** |
| strength | L (Light) | DOT | **1** |
| climbBalance | N | DOT | **0** |
| stoopKneel | O | DOT | **2** |
| reachHandle | F | DOT | **3** |
| talkHear | F | DOT | **3** |
| see | O | DOT | **2** |
| workLocation | N | DOT | **0** |
| extremeCold | N | DOT | **0** |
| extremeHeat | N | DOT | **0** |
| wetnessHumidity | N | DOT | **0** |
| noiseVibration | O | DOT | **2** |
| hazards | N | DOT | **0** |
| dustsFumes | N | DOT | **0** |

### Step 2: STQ Computation

**SVP Gate Check:** Source SVP (4) >= Target SVP (3). **PASSES.**

Since all PRW is semiskilled (SVP=4) and target is unskilled (SVP=3), but we do have SVP >= 4, the standard skilled pathway applies.

Assume the following similarity results (illustrative):
- Task/DWA: Jaccard=0.05, TokenOverlap=0.12, Dice=0.08. Best = 0.12 x 100 = **12.0**
- WorkField/MPSMS: Jaccard(WF)=0.0, Jaccard(MPSMS)=0.0. Average = (0+0)/2 x 100 = **0.0**
- Tools: Jaccard=0.10, TokenOverlap=0.15, Dice=0.12. Best = 0.15 x 100 = **15.0**
- Materials: All=0. Best = **0.0**
- Credentials: Jaccard=0.05, TokenOverlap=0.08, Dice=0.06. Best = 0.08 x 100 = **8.0**

```
STQ = 0.35 x 12.0 + 0.25 x 0.0 + 0.20 x 15.0 + 0.10 x 0.0 + 0.10 x 8.0
    = 4.20 + 0.00 + 3.00 + 0.00 + 0.80
    = 8.00
```

**STQ = 8.00**

### Step 3: TFQ Computation (Strict Mode)

**Trait-by-trait comparison (worker capacity vs occupation demand):**

| Trait | Worker | Demand | floor(Demand) | Passes? | Margin |
|-------|--------|--------|--------------|---------|--------|
| reasoning | 1.60 | 1.60 | 1 | Yes | 0.00 |
| math | 0.80 | 1.60 | 1 | No | -0.80 |
| language | 0.80 | 1.60 | 1 | No | -0.80 |
| spatialPerception | 1 | 1 | 1 | Yes | 0.00 |
| formPerception | 1 | 1 | 1 | Yes | 0.00 |
| clericalPerception | 1 | 2 | 2 | No | -1.00 |
| motorCoordination | 2 | 2 | 2 | Yes | 0.00 |
| fingerDexterity | 2 | 2 | 2 | Yes | 0.00 |
| manualDexterity | 2 | 2 | 2 | Yes | 0.00 |
| eyeHandFoot | 1.14 | 0.57 | 0 | Yes | +0.57 |
| colorDiscrimination | 0.86 | 0.57 | 0 | Yes | +0.29 |
| strength | 0 | 1 | 1 | No | -1.00 |
| climbBalance | 0 | 0 | 0 | Yes | 0.00 |
| stoopKneel | 1 | 2 | 2 | No | -1.00 |
| reachHandle | 2 | 3 | 3 | No | -1.00 |
| talkHear | 3 | 3 | 3 | Yes | 0.00 |
| see | 2 | 2 | 2 | Yes | 0.00 |
| workLocation | 0 | 0 | 0 | Yes | 0.00 |
| extremeCold | 0 | 0 | 0 | Yes | 0.00 |
| extremeHeat | 0 | 0 | 0 | Yes | 0.00 |
| wetnessHumidity | 0 | 0 | 0 | Yes | 0.00 |
| noiseVibration | 1 | 2 | 2 | No | -1.00 |
| hazards | 0 | 0 | 0 | Yes | 0.00 |
| dustsFumes | 0 | 0 | 0 | Yes | 0.00 |

**Failed traits:** math, language, clericalPerception, strength, stoopKneel, reachHandle, noiseVibration (7 failures)

In **strict mode**, any failure = exclusion. **TFQ = 0. EXCLUDED.**

This Construction Laborer restricted to sedentary cannot work as a Cashier due to strength (Light required vs Sedentary capacity) and multiple other trait failures.

**Note:** Let us instead use a target where the worker passes all traits to continue the example.

### Revised Target: Information Clerk (DOT 237.367-018, O\*NET 43-4171.00)

Assume this sedentary occupation with demands the worker meets on all 24 traits.

Assume all traits pass with the following margins (hypothetical):

- Rated traits: 20 of 24
- Sum of margins: +6.0
- rawMargin = (6.0 / (20 x 4)) x 100 = 7.5
- coverageFactor = min(1.0, 20/12) = 1.0
- reserveMargin = 7.5 x 1.0 = 7.5

```
TFQ = min(100, max(0, 7.5)) = 7.50
```

**TFQ = 7.50.** Passes.

### Step 4: VAQ Computation

Assume evaluator ratings (Information Clerk vs Construction Laborer):

| Dimension | Rating | Label |
|-----------|--------|-------|
| Tools | 33 | Moderate (different tools) |
| Work Processes | 33 | Moderate (office vs construction) |
| Work Setting | 33 | Moderate (indoor office vs outdoor) |
| Industry | 33 | Moderate (services vs construction) |

```
VAQ = (33 + 33 + 33 + 33) / 4 = 33.00
```

Age rule = "standard" (age 42). No advanced age restriction.

**VAQ = 33.00.** Passes.

### Step 5: LMQ Computation

Given for Information Clerk:
- Employment: 150,000
- Median wage: $38,000/yr
- Prior earnings: $45,000/yr
- Projected growth: +3%
- Projected openings: 15,000/yr
- Local demand score: 72
- JOLTS trend: +0.2

**Employment score:**

```
logScore = (log10(150000) - 2) x (90 / 3.7) + 10
         = (5.176 - 2) x 24.324 + 10
         = 3.176 x 24.324 + 10
         = 77.25 + 10
         = 87.25
         = round(87) = 87
```

**Wage score (with prior earnings):**

```
ratio = 38000 / 45000 = 0.8444
score = 10 + min(90, 0.8444 x 90) = 10 + 76.0 = 86
= round(86) = 86
```

**Projections score:**

Growth: `50 + (3/15) x 50 = 50 + 10 = 60`

Openings: `(log10(15000) - 1.5) x (90/3.2) + 20 = (4.176 - 1.5) x 28.125 + 20 = 2.676 x 28.125 + 20 = 75.26 + 20 = 95`
Clamped: `min(100, 95) = 95`

```
projectionsScore = round((60 + 95) / 2) = 78 (rounding 77.5)
```

**JOLTS trend score:**

```
score = 60 + 0.2 x 40 = 60 + 8 = 68
```

**Local demand score:** 72 (used directly)

**All 5 components available.** Total base weight = 0.25 + 0.25 + 0.20 + 0.15 + 0.15 = 1.00. No redistribution needed.

```
LMQ = 0.25 x 87 + 0.25 x 86 + 0.20 x 78 + 0.15 x 72 + 0.15 x 68
    = 21.75 + 21.50 + 15.60 + 10.80 + 10.20
    = 79.85
```

**LMQ = 79.85**

### Step 6: PVQ Composite

Assume revised STQ for Information Clerk = 15.50.

```
PVQ = 0.45 x 15.50 + 0.25 x 7.50 + 0.15 x 33.00 + 0.15 x 79.85
    = 6.975 + 1.875 + 4.95 + 11.9775
    = 25.7775
    = 25.78 (rounded)
```

**PVQ = 25.78**

### Step 7: Confidence Grade

- STQ: Has some token-overlap matches but no exact task/DWA matches, STQ > 0 --> +1
- TFQ: 20 traits rated --> +3
- TFQ proxy penalty: Assume 5 proxy traits (< 10 threshold) --> no penalty
- LMQ employment: Available --> +1
- LMQ wage: Available --> +1
- LMQ projections: Available --> +1

**Total: 1 + 3 + 1 + 1 + 1 = 7**

Score >= 7: **Grade A**

### Step 8: VQ Regression

Using Information Clerk demand traits, convert each to VQS native scale, then apply weights.

Example (abbreviated for key traits):

| Trait | Normalized | Scale | Native | Weight | Contribution |
|-------|-----------|-------|--------|--------|-------------|
| reasoning | 1.60 | GED | round(1.6/4 x 5)+1 = round(2)+1 = 3 | 5.299567 | 15.899 |
| math | 0.80 | GED | round(0.8/4 x 5)+1 = round(1)+1 = 2 | 2.213121 | 4.426 |
| language | 1.60 | GED | 3 | 1.424168 | 4.273 |
| talkHear | 3.00 | PD Binary | 3>=2? --> 1 | 4.542681 | 4.543 |
| strength | 0 | PD1 | round(0/4 x 4)+1 = 1 | 1.84953 | 1.850 |
| ... | ... | ... | ... | ... | ... |

```
VQ = 34.56707 + sum(all 24 contributions)
```

Assume the full calculation yields **VQ = 94.25**.

Band: VQ < 100 --> **Band 1** (Below Average to Mid-Average)

### Step 9: Earning Capacity

Using Band 1 statistics and the Information Clerk wage data:

```
hourlyMedian = 38000 / 2080 = 18.27 $/hr
ECLR = 1.0 (no geographic adjustment assumed)
adjustedMedian = 18.27 x 1.0 = 18.27 $/hr

SEE (Band 1 median) = 0.20 $/hr

95% CI lower = max(0, 18.27 - 1.96 x 0.20) = max(0, 17.88) = 17.88 $/hr
95% CI upper = 18.27 + 1.96 x 0.20 = 18.66 $/hr
```

**Earning capacity estimate:** $18.27/hr ($38,002/yr)
**95% confidence interval:** $17.88 - $18.66/hr ($37,190 - $38,813/yr)
**Rxy:** 0.96 (predictive validity)

---

## Appendix: Source Files

| File | Module |
|------|--------|
| `src/lib/engine/traits.ts` | 24-trait system, normalization functions |
| `src/lib/engine/skill-transfer.ts` | STQ computation |
| `src/lib/engine/trait-feasibility.ts` | TFQ computation |
| `src/lib/engine/vocational-adjustment.ts` | VAQ computation |
| `src/lib/engine/labor-market.ts` | LMQ computation |
| `src/lib/engine/pvq.ts` | PVQ composite |
| `src/lib/engine/vocational-quotient.ts` | VQ regression |
| `src/lib/engine/earning-capacity.ts` | EC estimation |
| `src/lib/engine/component-profile.ts` | CPC fingerprinting |
| `src/lib/engine/tsp.ts` | TSP computation |
| `src/lib/engine/confidence-explanation.ts` | Confidence grading |
