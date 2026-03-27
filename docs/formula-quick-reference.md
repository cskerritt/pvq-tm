# PVQ-TM Formula Quick Reference

**Single-page cheat sheet for all formulas, weights, and constants.**

---

## Normalization Formulas

| Source | Formula | Output |
|--------|---------|--------|
| DOT GED (1-6) | `(gedLevel - 1) x 0.8` | 0-4 |
| DOT Aptitude (1-5) | `5 - dotValue` | 0-4 (inverted) |
| DOT Strength (S/L/M/H/V) | S=0, L=1, M=2, H=3, V=4 | 0-4 |
| DOT Physical/Env (N/S/O/F/C) | N=0, S=1, O=2, F=3, C=4 | 0-4 |
| O\*NET Level (0-7) | `(level / 7) x 4` | 0-4 |
| O\*NET Score (0-100) | `(score / 100) x 4` | 0-4 |

---

## Similarity Functions

| Function | Formula |
|----------|---------|
| Jaccard | \|A inter B\| / \|A union B\| |
| Token Overlap | \|tokens(A) inter tokens(B)\| / \|tokens(A) union tokens(B)\| (with stemming) |
| Dice | 2 x \|A inter B\| / (\|A\| + \|B\|) (stemmed) |
| Selection | `max(Jaccard, TokenOverlap, Dice) x 100` |

**Stemming suffixes (applied in order):** `ying` -> `y`; then `tion|sion|ment|ness|ence|ance|ible|able|ious|eous|ical|ally|ings|ated|ting|ling`; then `ing|ies|ied|ers|est|ous|ful|ive|ize|ise|ant|ent|ism|ist|ity`; then `ed|er|ly|al|or|es|en`; then `s`. Words <= 4 chars: not stemmed.

---

## STQ (Skill Transfer Quotient)

**Gate:** targetSVP <= max(sourceSVP). Source must have SVP >= 4.

```
STQ = 0.35 x taskDwa + 0.25 x wfMpsms + 0.20 x tools + 0.10 x materials + 0.10 x credentials
```

Unskilled pathway (all PRW SVP < 4, target SVP <= 3): `STQ = 0.50 x taskDwa + 0.30 x tools + 0.20 x wfMpsms`

---

## TFQ (Trait Feasibility Quotient)

**Pass rule:** `workerCapacity >= floor(occupationDemand)` per trait.

**Strict:** Any failure = TFQ = 0, excluded.
**Clinical:** 1 marginal failure (|deficit| <= 1.0) tolerated with 15-pt penalty.

```
rawMargin = sum(margins) / (ratedCount x 4) x 100
coverageFactor = min(1.0, ratedCount / 12)
TFQ = clamp(0, 100, rawMargin x coverageFactor)
```

Clinical with toleration: `TFQ = clamp(0, 100, reserveMargin - 15 x marginalCount)`

---

## VAQ (Vocational Adjustment Quotient)

Scale: 100 (none), 67 (slight), 33 (moderate), 0 (substantial)

```
VAQ = (tools + workProcesses + workSetting + industry) / 4
```

Advanced age (>= 55): any dimension < 100 = excluded (unless auto-estimated).

**Auto-estimation thresholds:**

| Dimension | >75% | >50% | >25% | <=25% | No data |
|-----------|------|------|------|-------|---------|
| Tools (O\*NET overlap) | 100 | 67 | 33 | 0 | 33 |
| Work Processes (GOE) | 4-char match=100 | 2-char=67 | else=33 | - | 33 |
| Work Setting (industry) | exact=100 | word overlap=67 | else=33 | - | 33 |
| Industry (sector) | same sector=100 | word overlap=67 | else=33 | - | 33 |

---

## LMQ (Labor Market Quotient)

| Component | Base Weight | Score Formula |
|-----------|------------|---------------|
| Employment | 0.25 | `(log10(emp) - 2) x 24.324 + 10`, clamped [5, 100] |
| Wage | 0.25 | With prior: `10 + min(90, ratio x 90)`. Without: `(wage/80000) x 100` |
| Projections | 0.20 | `avg(growthScore, openingsScore)` |
| Local Demand | 0.15 | Direct 0-100 score (or legacy log-scaled area emp) |
| JOLTS Trend | 0.15 | `60 + trend x 40` |

Growth: `50 + (growthPct / 15) x 50`. Openings: `(log10(open) - 1.5) x 28.125 + 20`.

**Weight redistribution:** When optional components unavailable, normalize remaining weights to sum to 1.0.

---

## PVQ (Composite)

```
PVQ = 0.45 x STQ + 0.25 x TFQ + 0.15 x VAQ + 0.15 x LMQ
```

**Exclusion gate order:** SVP -> Trait -> Age

---

## Confidence Grade

| Source | Points |
|--------|--------|
| STQ matched tasks/DWAs | +2 |
| STQ > 0, no exact matches | +1 |
| TFQ: >= 20 traits rated | +3 |
| TFQ: >= 15 traits rated | +2 |
| TFQ: >= 10 traits rated | +1 |
| TFQ: > 10 proxy traits | -1 |
| LMQ: employment available | +1 |
| LMQ: wage available | +1 |
| LMQ: projections available | +1 |

**Max: 8.** A >= 7, B >= 5, C >= 3, D < 3.

---

## VQ Regression Weights

**VQ = 34.56707 + sum(weight x nativeValue)**

| Trait | Weight | Scale | Native Range |
|-------|--------|-------|-------------|
| reasoning | 5.299567 | GED | 1-6: `round(n/4 x 5)+1` |
| math | 2.213121 | GED | 1-6 |
| language | 1.424168 | GED | 1-6 |
| spatialPerception | 2.241977 | APT | 1-5: `round(n/4 x 4)+1` |
| formPerception | 1.783972 | APT | 1-5 |
| clericalPerception | 1.95779 | APT | 1-5 |
| motorCoordination | 1.648707 | APT | 1-5 |
| fingerDexterity | 1.631036 | APT | 1-5 |
| manualDexterity | 2.126616 | APT | 1-5 |
| eyeHandFoot | 1.403101 | APT | 1-5 |
| colorDiscrimination | 1.431217 | APT | 1-5 |
| strength | 1.84953 | PD1 | 1-5: `round(n/4 x 4)+1` |
| climbBalance | 0.774892 | Binary | 0-1: `n>=2 ? 1 : 0` |
| stoopKneel | -0.165864 | Binary | 0-1 |
| reachHandle | 0.776669 | Binary | 0-1 |
| talkHear | 4.542681 | Binary | 0-1 |
| see | 0.201044 | Binary | 0-1 |
| workLocation | 1.470938 | EC1 | 1-3: `round(n/4 x 2)+1` |
| extremeCold | 0.330026 | Binary | 0-1 |
| extremeHeat | 0.504727 | Binary | 0-1 |
| wetnessHumidity | 0.371165 | Binary | 0-1 |
| noiseVibration | 1.217675 | Binary | 0-1 |
| hazards | -0.200072 | Binary | 0-1 |
| dustsFumes | 0.298293 | Binary | 0-1 |

**VQ range:** clamped [68, 158]. Default profile for nulls: `[3,2,2,2,3,2,3,2,3,2,2,2,0,0,1,0,1,2,0,0,0,1,0,0]`

---

## VQ Bands & SEE Values

| Band | VQ Range | SEE Mean ($/hr) | SEE Median ($/hr) | SEE P10 | SEE P90 | Rxy |
|------|----------|-----------------|-------------------|---------|---------|-----|
| 1 | 68 - 99.99 | 0.25 | 0.20 | 0.15 | 0.63 | 0.96 |
| 2 | 100 - 108.99 | 0.38 | 0.27 | 0.20 | 0.63 | 0.98 |
| 3 | 109 - 143.99 | 2.00 | 1.32 | 0.90 | 3.04 | 0.92 |
| 4 | 144 - 158 | 12.47 | 8.69 | 6.00 | 19.26 | 0.83 |

**Earning Capacity:** `ECLR = areaMedianWage / nationalMedianWage` (clamped [0.5, 2.0])
**95% CI:** `median +/- 1.96 x SEE_median`
**Hourly:** `annual / 2080`

---

## TSP (Transferable Skills Percent)

| Tier | Range | Label |
|------|-------|-------|
| 1 | 0-19% | Unskilled, no significant transferable skills |
| 2 | 20-39% | Semi-skilled, no significant transferable skills |
| 3 | 40-59% | Low transferable skills |
| 4 | 60-79% | Moderate transferable skills |
| 5 | 80-97% | High transferable skills |

**Component weights:** traitSim=0.30, traitCov=0.16, DOT=0.14, O\*NET=0.14, VQ=0.08, SVP=0.06, Str=0.12

**Tier rules:** VQ<85=T1; DOT3+O\*NET_full=T5; DOT3 or O\*NET_full or (DOT2+O\*NET4)=T4; DOT2 or O\*NET4 or (DOT1+O\*NET2)=T3; else=T2

**TSP = tierMin + inTierProgress x (tierMax - tierMin)**, capped at 97%.

---

## CPC (Component Profile Code)

**237 dimensions:** Knowledge(33) + Skills(35) + Abilities(52) + WorkActivities(41) + WorkContext(55) + WorkStyles(21)

**Score:** `importance x level` (KN/SK/AB/WA) or `importance` (WC/WS)

**L2 norm:** `norm = sqrt(sum(v_i^2)); v_i = v_i / norm`

**Cosine similarity:** `sum(A_i x B_i)` for L2-normalized vectors. Clamped [0, 1].
