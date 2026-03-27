# PVQ-TM Standard Error of Measurement (SEM) Methodology

## 1. Introduction

Standard Error of Measurement (SEM) quantifies the precision of PVQ-TM scores. In forensic vocational analysis, SEM is essential for:

- **Daubert compliance**: Courts require experts to demonstrate that their methodology produces results with known and quantifiable error rates. SEM provides the statistical foundation for this requirement.
- **Honest reporting**: A PVQ score of 62 without an error band could be misleading. Reporting PVQ = 62 +/- 4.2 (95% CI: 53.8-70.2) gives the trier of fact appropriate context.
- **Defensible testimony**: When opposing counsel challenges the precision of vocational opinions, SEM provides a research-grounded response.
- **Decision boundaries**: When occupations cluster near inclusion/exclusion thresholds, SEM identifies which classifications are robust and which are sensitive to measurement error.

## 2. Error Source Analysis

Each PVQ-TM quotient is subject to distinct sources of measurement error:

### STQ (Skill Transfer Quotient)
- **Vocabulary sensitivity**: Set-based text similarity (Jaccard, Dice, token overlap) is sensitive to the specific words used to describe tasks and tools. Different but semantically equivalent descriptions produce different overlap scores.
- **Stemming imprecision**: The simple suffix stemmer may over- or under-match word variants.
- **Best-of-three selection**: Taking the maximum of Jaccard, token overlap, and Dice coefficients reduces but does not eliminate vocabulary dependence.

### TFQ (Trait Feasibility Quotient)
- **Trait rating measurement error**: DOT job analyst ratings, O*NET incumbent surveys, and ORS probability sampling each introduce measurement error with known reliability characteristics.
- **Source heterogeneity**: A single occupation's 24-trait vector may draw from 3-4 different sources (ORS, DOT, O*NET, proxy), each with different reliability.
- **Categorical tolerance**: The flooring of demands to integer categories for pass/fail decisions creates a zone of ambiguity at category boundaries.
- **Proxy imputation**: When primary data is unavailable, proxy values from related occupations compound the measurement error.

### VAQ (Vocational Adjustment Quotient)
- **Ordinal scale granularity**: The 0/33/67/100 scale means the smallest possible score change is 33 points per dimension (8.25 points in the composite VAQ).
- **Evaluator subjectivity**: Different vocational evaluators may rate the same occupation-pair differently on the four adjustment dimensions.
- **Auto-estimation uncertainty**: When VAQ is auto-estimated from DOT/O*NET data rather than evaluator-rated, threshold-based classification adds additional error.

### LMQ (Labor Market Quotient)
- **OEWS sampling error**: Employment and wage estimates from the BLS Occupational Employment and Wage Statistics survey carry published Relative Standard Errors (RSE).
- **Projection uncertainty**: BLS employment projections have historical Mean Absolute Percent Error (MAPE) of 10-15% over 10-year periods.
- **JOLTS variability**: Industry-level job openings data has RSE of 5-15%.
- **Local demand composites**: ZIP-level demand scores aggregate multiple noisy signals (postings, structural factors, hiring momentum).

## 3. Published Reliability Coefficients

| Source | Coefficient | Type | Citation | Notes |
|--------|------------|------|----------|-------|
| DOT (lower bound) | 0.77 | Inter-rater (generalizability) | Cain, P.S. & Green, B.F. (1983). Reliabilities of Selected Ratings Available from the Dictionary of Occupational Titles. *Journal of Applied Psychology*, 68(4), 664-670. | Lower bound across trait categories; physical demands and working conditions had higher reliability (0.85-0.98). GED Math and Things complexity were lowest. |
| DOT (upper bound) | 0.98 | Inter-rater (generalizability) | Cain & Green (1983); also Cannelongo, Lechner, Keener, Carter, & Johnson (2002), who found job analysis reliability 0.77-0.98. | Upper bound for well-defined physical demand traits. |
| O*NET | 0.83 | Inter-rater (ICC) | Peterson, N.G., Mumford, M.D., Borman, W.C., Jeanneret, P.R., & Fleishman, E.A. (1997). O*NET Final Technical Report. Utah Dept. of Workforce Services. | 15-30 incumbents per occupation provide 95% CI within +/-1 scale point. |
| ORS | 0.85 | Estimated from published SEs | U.S. Bureau of Labor Statistics (2025). ORS Standard Errors. https://www.bls.gov/ors/se.htm | Probability sampling of 50,600 observations from 12,900 establishments. Standard errors published per estimate. |
| OEWS wages | RSE 1-10% | Relative Standard Error | BLS OEWS Technical Notes (2024). https://www.bls.gov/oes/current/oes_tec.htm | National wages: RSE 1-5%. State/metro: RSE 3-10%. Estimates with RSE > 30% flagged. |
| OEWS employment | RSE 2-15% | Relative Standard Error | BLS OEWS Technical Notes (2024). | National: RSE 2-8%. State/metro: RSE 5-15%. |
| BLS projections | MAPE 10-15% | Historical accuracy | BLS Occupational Projections Evaluation: 2012-2022. https://www.bls.gov/emp/evaluations/2012-2022-occupational.htm | Correctly projected growth/decline direction 77% of the time. |
| Vocational adjustment (evaluator) | kappa 0.60-0.79 | Inter-rater agreement | Gibson, L., et al. (2014). Work-ability Support Scale: Evaluation of Scoring Accuracy and Rater Reliability. *PMC4118042*. | Vocational assessment items showed "substantial" agreement. |
| DPT proxy | 0.65 | Estimated | Derived from DOT reliability (0.77) reduced by ~15% for cross-occupation matching error. | No direct published reliability for proxy-derived values. |
| SVP proxy | 0.70 | Estimated | SVP itself has reliability > 0.90 (Cain & Green, 1983), but mapping to trait demands introduces uncertainty. | Conservative estimate for SVP-based imputation. |
| Generic proxy | 0.60 | Estimated | No direct measurement basis; conservative estimate for heuristic-derived values. | Used when source methodology is unknown. |

## 4. SEM Formulas

### Classical Test Theory Foundation

From Classical Test Theory (CTT):

```
SEM = SD * sqrt(1 - r)
```

Where SD is the standard deviation of the measurement scale and r is the reliability coefficient.

### STQ SEM

STQ SEM is computed empirically from vocabulary variants:

```
SEM_STQ = SD(STQ_variant1, STQ_variant2, ..., STQ_variantN)
```

Where each variant computes STQ using different but semantically equivalent task/tool descriptions for the same occupation pair. When fewer than 2 variants are available, a conservative default of 5.0 points is used.

### TFQ SEM

For each trait comparison:

```
traitSEM = TRAIT_SCALE_SD * sqrt(1 - reliability_of_source)
marginSEM = sqrt(2) * traitSEM  (both capacity and demand have error)
```

A trait is **critical** when |margin| < marginSEM.

The overall reserve margin SEM propagates through the averaging:

```
reserveMarginSEM = sqrt(sum_i(marginSEM_i^2)) / ratedCount / 4 * 100
```

### VAQ SEM

```
dimSEM = 33 * sqrt(1 - reliability)
vaqSEM = dimSEM / sqrt(4)
```

Where reliability = 0.65 for evaluator-rated, 0.55 for auto-estimated.

### LMQ SEM

Each component's score-level SEM:

```
componentSEM = score * (RSE / 100)
```

Propagated through normalized weighted composite:

```
LMQ_SEM = sqrt(sum_i(w_i * componentSEM_i)^2)
```

### PVQ Composite SEM

Assuming independent component errors:

```
PVQ_SEM = sqrt(0.45^2 * STQ_SEM^2 + 0.25^2 * TFQ_SEM^2
             + 0.15^2 * VAQ_SEM^2 + 0.15^2 * LMQ_SEM^2)
```

## 5. Expected SEM Ranges

| Quotient | Typical SEM Range | Scale | Notes |
|----------|-------------------|-------|-------|
| STQ | 3-8 points | 0-100 | Vocabulary sensitivity; higher for occupations with diverse job descriptions |
| TFQ (reserve margin) | 4-12 points | 0-100 | Depends on trait source mix; more proxy = higher SEM |
| VAQ (evaluator) | 8-12 points | 0-100 | Ordinal scale creates inherent imprecision |
| VAQ (auto) | 10-15 points | 0-100 | Threshold-based classification adds error |
| LMQ | 2-6 points | 0-100 | Depends on OEWS RSE for specific occupation |
| PVQ composite | 2-5 points | 0-100 | Weighted propagation dampens component errors |

## 6. PVQ Composite Error Propagation

The PVQ composite formula is:

```
PVQ = 0.45 * STQ + 0.25 * TFQ + 0.15 * VAQ + 0.15 * LMQ
```

Error propagation for independent components:

```
PVQ_SEM^2 = 0.45^2 * STQ_SEM^2 + 0.25^2 * TFQ_SEM^2
          + 0.15^2 * VAQ_SEM^2 + 0.15^2 * LMQ_SEM^2
```

This means:
- STQ contributes 0.2025 * STQ_SEM^2 (largest contribution due to 0.45 weight)
- TFQ contributes 0.0625 * TFQ_SEM^2
- VAQ contributes 0.0225 * VAQ_SEM^2
- LMQ contributes 0.0225 * LMQ_SEM^2

The weighting structure naturally suppresses VAQ and LMQ error contributions. Even a VAQ SEM of 12 points only contributes sqrt(0.0225 * 144) = 1.8 points to PVQ SEM.

### Example Calculation

Given: STQ_SEM = 5, TFQ_SEM = 6, VAQ_SEM = 10, LMQ_SEM = 4

```
PVQ_SEM = sqrt(0.2025*25 + 0.0625*36 + 0.0225*100 + 0.0225*16)
        = sqrt(5.0625 + 2.25 + 2.25 + 0.36)
        = sqrt(9.9225)
        = 3.15
```

For PVQ = 62:
- 68% CI: [58.85, 65.15]
- 90% CI: [56.82, 67.18]  (PVQ +/- 1.645 * 3.15)
- 95% CI: [55.83, 68.17]  (PVQ +/- 1.96 * 3.15)

### Independence Assumption

The formula above assumes independent component errors. In practice, some error correlation exists because:
- STQ and TFQ both depend on occupational data quality
- LMQ and STQ may share employment data dependencies

The independence assumption is **conservative** in the sense that positive error correlations would increase the composite SEM. However, the correlations are expected to be small because the quotients measure fundamentally different constructs (text similarity, trait compliance, adjustment difficulty, labor market conditions).

## 7. Interpretation Guidelines

### What SEM Means

A PVQ SEM of 3.5 means:
- The true PVQ score is within +/-3.5 points of the observed score **68% of the time** (1 SEM)
- The true PVQ score is within +/-5.8 points **90% of the time** (1.645 * SEM)
- The true PVQ score is within +/-6.9 points **95% of the time** (1.96 * SEM)

### Practical Decision Rules

1. **Robust classification**: If two occupations have PVQ scores that differ by more than 2 * PVQ_SEM, the ranking is likely reliable.
2. **Indistinguishable occupations**: If the PVQ score difference is less than 1 * PVQ_SEM, the occupations cannot be meaningfully ranked.
3. **Critical trait alerts**: Traits flagged as "critical" (margin < SEM) should be highlighted in reports as potentially sensitive to measurement error.
4. **Confidence grade interaction**: Occupations with confidence grade "C" or "D" (sparse data, many proxies) will tend to have higher SEMs, providing a quantitative complement to the categorical grade.

### Reporting Recommendations

For forensic reports:
- Always report the PVQ score with its 90% or 95% confidence interval
- Flag critical traits where pass/fail status is sensitive to measurement error
- Note the confidence grade alongside the SEM
- When an occupation is near a decision threshold, explicitly discuss whether SEM could change the classification

## 8. Comparison to VQS SEE

The VQS (Vocational Quotient System) publishes Standard Errors of Estimate (SEE) for wage predictions within each VQ Band:

| VQ Band | SEE Median ($/hr) | Rxy |
|---------|-------------------|-----|
| 1 | $0.20 | 0.96 |
| 2 | $0.27 | 0.98 |
| 3 | $1.32 | 0.92 |
| 4 | $8.69 | 0.83 |

PVQ-TM SEM and VQS SEE measure different things:

- **VQS SEE** measures how precisely VQ predicts **wages** (prediction error in $/hr). It is a criterion-referenced standard error of estimate.
- **PVQ-TM SEM** measures how precisely we can determine the **PVQ score itself** (measurement error in PVQ points). It is a norm-referenced standard error of measurement.

The two are complementary. VQS SEE tells you how much wage uncertainty to expect; PVQ-TM SEM tells you how much scoring uncertainty to expect. When PVQ-TM is used to select occupations that then feed into VQS earning capacity analysis, both sources of error apply:

1. SEM determines whether an occupation is correctly included in the viable set
2. SEE determines the precision of the wage estimate for that occupation

## 9. Limitations

### What SEM Captures
- Random measurement error from data source reliability
- Vocabulary sensitivity in text matching (STQ)
- Trait rating imprecision from inter-rater disagreement and survey sampling
- Ordinal scale granularity in VAQ
- Statistical sampling error in BLS wage and employment data

### What SEM Does NOT Capture
- **Systematic bias**: If DOT ratings are systematically outdated for an occupation, SEM does not detect this. SEM measures precision (random error), not accuracy (systematic error).
- **Model specification error**: If the PVQ weighting formula (0.45/0.25/0.15/0.15) is suboptimal, SEM does not reflect this structural choice.
- **Data currency**: The DOT was last revised in 1991. SEM does not quantify how much occupational requirements have changed since then.
- **Gate decision errors**: The binary pass/fail gates (SVP, trait feasibility, advanced age) are not continuous measures and SEM does not fully capture gate sensitivity. The `criticalTraits` output provides partial gate sensitivity information.
- **Evaluator systematic differences**: If one evaluator consistently rates VAQ dimensions higher than another, this is a bias that SEM's reliability-based approach only partially addresses.
- **Selection bias**: The choice of which prior relevant work (PRW) entries to include, and which target occupations to evaluate, introduces error that is outside the SEM framework.

### Conservative Assumptions
- Independent component errors (likely conservative; real correlations would increase SEM)
- Lower-bound reliability for DOT (0.77) rather than mean or median
- Conservative default RSE values when occupation-specific RSE is unavailable
- Generic proxy reliability set to 0.60 (substantial uncertainty)
