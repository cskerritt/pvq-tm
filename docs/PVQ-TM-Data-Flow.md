# PVQ-TM Analysis Pipeline — Data Flow Diagram

## High-Level Architecture

```
 WIZARD (Steps 1-4)                    ANALYSIS PIPELINE (Steps 1-5)
 ═══════════════════                   ════════════════════════════════

 ┌─────────────┐    ┌─────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
 │  Step 1:    │    │  Step 2:    │   │  Step 3:     │   │  Step 4:     │   │  Step 5:     │
 │  Case Setup │───▶│  PRW &      │──▶│  Worker      │──▶│  CREATE      │──▶│  RUN         │
 │             │    │  Skills     │   │  Profiles    │   │  ANALYSIS    │   │  ANALYSIS    │
 └─────────────┘    └─────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
       │                  │                  │                  │                  │
       ▼                  ▼                  ▼                  ▼                  ▼
  ┌─────────┐     ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
  │  Case   │     │ PastRelevant │   │ WorkerProfile│   │  Analysis    │   │  5-Step      │
  │  record │     │ Work (1+)    │   │ POST (req'd) │   │  record      │   │  Pipeline    │
  │         │     │              │   │ PRE (opt'l)  │   │  (draft)     │   │  (below)     │
  │clientName│    │ AcquiredSkill│   │              │   │              │   │              │
  │clientDOB │    │ (1+ w/SVP≥4) │   │ 24 traits    │   │ ageRule      │   │              │
  │dateOfInj │    │              │   │ filled       │   │ priorEarnings│   │              │
  │zipCode   │    │              │   │              │   │ targetArea   │   │              │
  └─────────┘     └──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
```

## The 5-Step Analysis Pipeline (Detail)

```
  STEP 1               STEP 2                STEP 3              STEP 4            STEP 5
  Review PRW       Generate Candidates      Trait Filter      VAQ Review         Compute PVQ
  & Skills         (/generate-candidates)   (/filter-traits)  (Manual)           (/compute)
  ─────────────    ─────────────────────    ────────────────  ──────────────     ──────────────

  ┌───────────┐    ┌───────────────────┐   ┌──────────────┐  ┌────────────┐    ┌────────────┐
  │ Validate: │    │ For each PRW:     │   │ For each     │  │ Evaluator  │    │ For each   │
  │           │    │                   │   │ candidate:   │  │ reviews    │    │ surviving  │
  │ • PRW ≥ 1 │    │ 1. Look up DOT   │   │              │  │ VAQ dims:  │    │ target:    │
  │ • Skills  │    │    occupation     │   │ 1. Build     │  │            │    │            │
  │   ≥ 1 w/  │    │ 2. Look up O*NET │   │    demand    │  │ • Tools    │    │ 1. STQ     │
  │   SVP≥4   │    │    occupation     │   │    vector    │  │ • Work     │    │ 2. TFQ     │
  │ • POST    │    │ 3. Find related   │   │    (24 DOT   │  │   Process  │    │ 3. VAQ     │
  │   profile │    │    SOC codes      │   │    traits)   │  │ • Work     │    │ 4. LMQ     │
  │   exists  │    │ 4. Cross-walk to  │   │              │  │   Setting  │    │ 5. PVQ =   │
  │           │    │    DOT titles     │   │ 2. Compare   │  │ • Industry │    │    weighted │
  │ If all ✅: │   │ 5. CPC component  │   │    POST      │  │            │    │    composite│
  │ enable    │    │    matching       │   │    profile   │  │ Score each │    │            │
  │ "Continue"│    │                   │   │    vs demand │  │ 0/33/67/100│    │ + VQ, TSP  │
  └─────┬─────┘    │ Creates:          │   │              │  │            │    │ + EC, ECLR │
        │          │ TargetOccupation  │   │ 3. Gate:     │  │ Advanced   │    │ + JOLTS    │
        ▼          │ records (50-200+) │   │    strength, │  │ Age rule:  │    │ + Near-miss│
  [Manual step]    │                   │   │    climb,    │  │ ALL must   │    │ + RFC      │
                   └─────────┬─────────┘   │    stoop,    │  │ be 100     │    │            │
                             │             │    reach     │  │ (or pending│    │ Updates:   │
                             ▼             │              │  │  review if │    │ analysis   │
                    ┌─────────────────┐    │ 4. EXCLUDE   │  │  auto-est) │    │ status =   │
                    │ Target Sources: │    │    if any    │  │            │    │ "completed"│
                    │                 │    │    trait     │  └────────────┘    │            │
                    │ • DOT crosswalk │    │    fails     │                    │ Stores all │
                    │ • O*NET related │    │              │                    │ results in │
                    │ • CPC component │    │ 5. Clinical  │                    │ Target     │
                    │   profile match │    │    mode:     │                    │ Occupation │
                    │ • Same industry │    │    tolerate  │                    │ records    │
                    └─────────────────┘    │    1 marginal│                    └────────────┘
                                           │    failure   │
                                           │              │
                                           │ SURVIVORS    │
                                           │ advance →    │
                                           └──────────────┘
```

## Scoring Engine Detail

```
                          ┌─────────────────────────────────────────┐
                          │           PVQ COMPOSITOR                │
                          │  PVQ = 0.30×STQ + 0.30×TFQ             │
                          │      + 0.20×VAQ + 0.20×LMQ             │
                          └──────────┬──────────────────────────────┘
                                     │
              ┌──────────────────────┬┴────────────────────┬────────────────────┐
              ▼                      ▼                     ▼                    ▼
   ┌──────────────────┐   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
   │    STQ (30%)     │   │    TFQ (30%)     │  │    VAQ (20%)     │  │    LMQ (20%)     │
   │ Skill Transfer   │   │ Trait Feasibility│  │ Vocational Adj   │  │ Labor Market     │
   ├──────────────────┤   ├──────────────────┤  ├──────────────────┤  ├──────────────────┤
   │                  │   │                  │  │                  │  │                  │
   │ INPUTS:          │   │ INPUTS:          │  │ INPUTS:          │  │ INPUTS:          │
   │ • PRW tasks/DWAs │   │ • POST profile   │  │ • Source GOE     │  │ • BLS employment │
   │ • PRW tools      │   │   (24 traits)    │  │ • Target GOE     │  │ • Median wage    │
   │ • PRW work fields│   │ • DOT demand     │  │ • Tool overlap   │  │ • Prior earnings │
   │ • PRW materials  │   │   vector         │  │ • Industry match │  │ • BLS projections│
   │ • PRW knowledge  │   │ • Analysis mode  │  │ • Age rule       │  │ • Area employment│
   │ • Source SVP     │   │                  │  │ • Auto-estimated │  │ • JOLTS trends   │
   │ • Target SVP     │   │ PROCESS:         │  │                  │  │                  │
   │                  │   │ 1. Compare each  │  │ PROCESS:         │  │ PROCESS:         │
   │ PROCESS:         │   │    of 24 traits  │  │ 1. Score tools   │  │ 1. Score employ- │
   │ 1. SVP gate      │   │ 2. Gate failures │  │    adjustment    │  │    ment (log)    │
   │    (target ≤     │   │ 3. Reserve margin│  │ 2. Score work    │  │ 2. Score wage    │
   │    source + 1)   │   │ 4. Coverage      │  │    processes     │  │    ratio         │
   │ 2. Task/DWA      │   │    penalty       │  │ 3. Score setting │  │ 3. Score growth  │
   │    overlap        │   │                  │  │ 4. Score industry│  │    projections   │
   │   (Jaccard +     │   │ MODES:           │  │ 5. Average = VAQ │  │ 4. Score area    │
   │    Dice +        │   │ strict: 0 fails  │  │                  │  │    demand        │
   │    stemmed       │   │ clinical: 1      │  │ ADV AGE RULE:    │  │ 5. Weighted avg  │
   │    tokens)       │   │   marginal OK    │  │ All 4 must = 100 │  │                  │
   │ 3. Tool overlap  │   │   (15pt penalty) │  │ or excluded      │  │ ALL CONTINUOUS   │
   │ 4. Material      │   │                  │  │ (auto-est →      │  │ (no cliff        │
   │    overlap       │   │                  │  │  pending review)  │  │  effects)        │
   │ 5. Credential    │   │                  │  │                  │  │                  │
   │    overlap       │   │                  │  │                  │  │                  │
   │ 6. Weighted avg  │   │                  │  │                  │  │                  │
   │                  │   │                  │  │                  │  │                  │
   │ UNSKILLED PATH:  │   │                  │  │                  │  │                  │
   │ SVP<4 → task     │   │                  │  │                  │  │                  │
   │ familiarity      │   │                  │  │                  │  │                  │
   │ scoring instead  │   │                  │  │                  │  │                  │
   └──────────────────┘   └──────────────────┘  └──────────────────┘  └──────────────────┘
```

## Database Entity Relationships

```
  ┌─────────────────┐
  │      Case       │
  │─────────────────│
  │ id              │
  │ clientName      │
  │ clientDOB       │
  │ dateOfInjury    │
  │ zipCode         │
  │ caseType        │
  └────────┬────────┘
           │ 1
           │
     ┌─────┼──────────────┬─────────────────┐
     │     │              │                 │
     ▼ N   ▼ N            ▼ 2 (POST/PRE)   ▼ N
  ┌──────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │ PRW      │  │ AcquiredSkill│  │ WorkerProfile │  │  Analysis    │
  │──────────│  │──────────────│  │──────────────│  │──────────────│
  │ jobTitle │  │ actionVerb   │  │ profileType  │  │ ageRule      │
  │ dotCode  │  │ object       │  │ strength     │  │ analysisMode │
  │ onetCode │  │ svpLevel     │  │ reasoning    │  │ priorEarnings│
  │ svp      │  │ isTransferable│ │ ... (24)     │  │ targetArea   │
  │ wage     │  │ toolsSoftware│  │ notes        │  │ status       │
  └──────────┘  └──────────────┘  └──────────────┘  └──────┬───────┘
                                                           │ 1
                                                           │
                                                           ▼ N
                                                    ┌──────────────┐
                                                    │ Target       │
                                                    │ Occupation   │
                                                    │──────────────│
                                                    │ onetSocCode  │
                                                    │ dotCode      │
                                                    │ title        │
                                                    │ svp          │
                                                    │ stq          │
                                                    │ tfq          │
                                                    │ vaq          │
                                                    │ lmq          │
                                                    │ pvq          │
                                                    │ excluded     │
                                                    │ hasTolerations│
                                                    │ pendingReview│
                                                    └──────────────┘
```

## Gate/Exclusion Logic

```
  Target Occupation enters pipeline
           │
           ▼
  ┌────────────────┐     FAIL
  │ SVP Gate:      │────────────▶ EXCLUDED: "SVP too high for PRW"
  │ target ≤       │
  │ source SVP + 1 │
  └───────┬────────┘
          │ PASS
          ▼
  ┌────────────────┐     FAIL (strict mode)
  │ Trait Gate:    │────────────▶ EXCLUDED: "Trait failure: strength, ..."
  │ POST profile   │
  │ ≥ demand for   │     1 MARGINAL (clinical mode)
  │ all 24 traits  │────────────▶ SURVIVES with -15pt TFQ penalty
  └───────┬────────┘
          │ PASS
          ▼
  ┌────────────────┐     FAIL (evaluator-confirmed)
  │ VAQ Gate:      │────────────▶ EXCLUDED: "Advanced age: adjustment in tools"
  │ (advanced age  │
  │  only: all 4   │     FAIL (auto-estimated)
  │  dims = 100)   │────────────▶ SURVIVES: "Pending evaluator review"
  └───────┬────────┘
          │ PASS
          ▼
  ┌────────────────┐
  │ VIABLE         │
  │ PVQ computed   │
  │ = 0.30×STQ     │
  │ + 0.30×TFQ     │
  │ + 0.20×VAQ     │
  │ + 0.20×LMQ     │
  └────────────────┘
```
