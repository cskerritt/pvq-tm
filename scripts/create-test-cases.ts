/**
 * create-test-cases.ts
 *
 * Creates 50 specific, documented test cases and runs the full analysis pipeline.
 *
 * Usage:
 *   source .env.local && export DATABASE_URL && npx tsx scripts/create-test-cases.ts
 *
 * Requires the dev server running on http://localhost:3000
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = "http://localhost:3000";

// ─── Trait key order (24 traits) ────────────────────────────────────────
const TRAIT_KEYS = [
  "reasoning","math","language","spatialPerception","formPerception","clericalPerception",
  "motorCoordination","fingerDexterity","manualDexterity","eyeHandFoot","colorDiscrimination",
  "strength","climbBalance","stoopKneel","reachHandle","talkHear","see",
  "workLocation","extremeCold","extremeHeat","wetnessHumidity","noiseVibration","hazards","dustsFumes",
] as const;

function traitsToRecord(traits: number[]): Record<string, number> {
  const record: Record<string, number> = {};
  for (let i = 0; i < TRAIT_KEYS.length; i++) {
    record[TRAIT_KEYS[i]] = traits[i] ?? 0;
  }
  return record;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

// ─── Injury patterns (trait index deltas) ──────────────────────────────
interface InjuryDef {
  label: string;
  description: string;
  bodyParts: string[];
  deltas: [number, number][]; // [traitIndex, drop]
}

const INJURIES: Record<string, InjuryDef> = {
  lumbar: {
    label: "Lumbar disc herniation at L4-L5",
    description: "Lumbar disc herniation at L4-L5 with radiculopathy",
    bodyParts: ["lower back", "lumbar spine"],
    deltas: [[11,-2],[13,-2],[12,-1],[14,-1]],
  },
  shoulder: {
    label: "Rotator cuff tear, right dominant shoulder",
    description: "Full-thickness rotator cuff tear, right dominant shoulder, post-surgical repair",
    bodyParts: ["right shoulder", "rotator cuff"],
    deltas: [[11,-1],[14,-2],[12,-1]],
  },
  knee: {
    label: "ACL tear with meniscus damage",
    description: "Right knee ACL tear with meniscus damage, post-reconstruction",
    bodyParts: ["right knee", "ACL", "meniscus"],
    deltas: [[11,-1],[12,-2],[13,-2]],
  },
  cervical: {
    label: "Cervical spine injury at C5-C6",
    description: "C5-C6 cervical disc disease with neck and upper extremity pain",
    bodyParts: ["cervical spine", "neck", "upper extremities"],
    deltas: [[11,-1],[14,-2],[12,-1],[15,-1]],
  },
  hip: {
    label: "Hip fracture requiring total hip arthroplasty",
    description: "Left hip fracture status post total hip arthroplasty",
    bodyParts: ["left hip", "pelvis"],
    deltas: [[11,-1],[12,-2],[13,-2]],
  },
  back_lifting: {
    label: "Back injury from patient lifting",
    description: "Lumbar strain/sprain from patient lifting with chronic pain syndrome",
    bodyParts: ["lower back", "lumbar spine"],
    deltas: [[11,-2],[13,-2],[12,-1],[14,-1]],
  },
  carpal_tunnel: {
    label: "Bilateral carpal tunnel syndrome",
    description: "Bilateral carpal tunnel syndrome with median nerve compression, post-release surgery",
    bodyParts: ["both wrists", "hands", "median nerves"],
    deltas: [[7,-2],[8,-2],[14,-1]],
  },
  ankle_fracture: {
    label: "Ankle fracture from slip and fall",
    description: "Bimalleolar ankle fracture with residual chronic instability from slip and fall",
    bodyParts: ["right ankle", "lower leg"],
    deltas: [[12,-2],[9,-1],[11,-1]],
  },
  tbi: {
    label: "Traumatic brain injury",
    description: "Mild-to-moderate traumatic brain injury with persistent cognitive deficits",
    bodyParts: ["brain", "head"],
    deltas: [[0,-1],[1,-1],[2,-1],[3,-1]],
  },
  ptsd: {
    label: "PTSD with comorbid depression",
    description: "Post-traumatic stress disorder with comorbid major depressive disorder",
    bodyParts: ["psychological", "mental health"],
    deltas: [[0,-1],[15,-1],[17,-1]],
  },
  vision: {
    label: "Vision impairment from chemical exposure",
    description: "Significant bilateral visual acuity loss from chemical exposure, corrected to 20/70",
    bodyParts: ["both eyes", "visual system"],
    deltas: [[16,-2],[10,-2],[3,-1]],
  },
  hearing: {
    label: "Industrial hearing loss",
    description: "Bilateral sensorineural hearing loss, moderate-to-severe, from industrial noise exposure",
    bodyParts: ["both ears", "auditory system"],
    deltas: [[15,-2],[21,-1]],
  },
  cardiac: {
    label: "Cardiac event with reduced ejection fraction",
    description: "Myocardial infarction with subsequent reduced ejection fraction and activity limitations",
    bodyParts: ["heart", "cardiovascular system"],
    deltas: [[11,-2],[12,-2],[19,-1],[22,-1]],
  },
  respiratory: {
    label: "COPD/chronic respiratory disease",
    description: "Chronic obstructive pulmonary disease from occupational exposure",
    bodyParts: ["lungs", "respiratory system"],
    deltas: [[11,-1],[23,-2],[19,-1],[18,-1]],
  },
  burn: {
    label: "Burn injuries",
    description: "Second and third degree burn injuries with scarring and functional limitations",
    bodyParts: ["hands", "forearms", "skin"],
    deltas: [[7,-1],[8,-1],[19,-2]],
  },
  stroke: {
    label: "Cerebrovascular accident (stroke)",
    description: "Ischemic stroke with residual cognitive and motor deficits",
    bodyParts: ["brain", "left side"],
    deltas: [[0,-2],[1,-2],[2,-2],[7,-1],[11,-1]],
  },
  hand_crush: {
    label: "Hand crush injury",
    description: "Crush injury to dominant hand with multiple metacarpal fractures",
    bodyParts: ["right hand", "metacarpals", "fingers"],
    deltas: [[7,-2],[8,-2],[14,-1],[6,-1]],
  },
  lumbar_fusion: {
    label: "Lumbar fusion surgery",
    description: "L4-L5-S1 lumbar fusion with hardware, residual pain and limited ROM",
    bodyParts: ["lower back", "lumbar spine"],
    deltas: [[11,-2],[13,-2],[12,-1],[14,-1]],
  },
  electrical_burn: {
    label: "Electrical burn injury",
    description: "High-voltage electrical burn with nerve damage to upper extremities",
    bodyParts: ["both arms", "hands", "nervous system"],
    deltas: [[7,-2],[8,-1],[19,-2],[22,-1]],
  },
  tbi_fall: {
    label: "TBI from fall",
    description: "Moderate traumatic brain injury from fall from height with persistent cognitive deficits",
    bodyParts: ["brain", "head", "skull"],
    deltas: [[0,-2],[1,-1],[2,-1],[3,-1],[6,-1]],
  },
  grease_burn: {
    label: "Burn injuries from grease fire",
    description: "Second and third degree burns to hands and forearms from grease fire",
    bodyParts: ["both hands", "forearms"],
    deltas: [[7,-1],[8,-1],[19,-2]],
  },
  broken_wrist: {
    label: "Broken wrist",
    description: "Distal radius fracture (Colles fracture) with residual stiffness",
    bodyParts: ["right wrist", "hand"],
    deltas: [[7,-1],[8,-1],[14,-1]],
  },
  shoulder_dislocation: {
    label: "Shoulder dislocation with Bankart repair",
    description: "Recurrent anterior shoulder dislocation with Bankart repair",
    bodyParts: ["right shoulder", "glenohumeral joint"],
    deltas: [[11,-1],[14,-2],[12,-1]],
  },
  rsi: {
    label: "Repetitive strain injury",
    description: "Bilateral repetitive strain injury with chronic tendinitis",
    bodyParts: ["both wrists", "forearms", "hands"],
    deltas: [[7,-2],[8,-2],[14,-1]],
  },
  cardiac_arrest: {
    label: "Cardiac arrest with anoxic brain injury",
    description: "Sudden cardiac arrest with brief anoxic brain injury and reduced cardiac function",
    bodyParts: ["heart", "brain", "cardiovascular system"],
    deltas: [[11,-2],[12,-2],[0,-1],[19,-1],[22,-1]],
  },
  lumbar_disc: {
    label: "Lumbar disc herniation",
    description: "Multi-level lumbar disc herniation with chronic radiculopathy",
    bodyParts: ["lower back", "lumbar spine", "sciatic nerve"],
    deltas: [[11,-2],[13,-2],[12,-1],[14,-1]],
  },
  knee_replacement: {
    label: "Total knee replacement",
    description: "Total knee arthroplasty with residual limitations",
    bodyParts: ["right knee"],
    deltas: [[11,-1],[12,-2],[13,-2]],
  },
  vision_loss: {
    label: "Vision loss in one eye",
    description: "Complete vision loss in left eye from traumatic injury",
    bodyParts: ["left eye"],
    deltas: [[16,-2],[10,-1],[3,-1]],
  },
  cervical_radiculopathy: {
    label: "Cervical radiculopathy",
    description: "C6-C7 cervical radiculopathy with upper extremity weakness",
    bodyParts: ["cervical spine", "right arm"],
    deltas: [[11,-1],[14,-2],[12,-1]],
  },
  herniated_disc: {
    label: "Herniated disc",
    description: "L5-S1 herniated disc with radiculopathy and chronic pain",
    bodyParts: ["lower back", "lumbar spine"],
    deltas: [[11,-2],[13,-2],[12,-1],[14,-1]],
  },
  chronic_back: {
    label: "Chronic back pain",
    description: "Chronic mechanical low back pain with functional limitations",
    bodyParts: ["lower back"],
    deltas: [[11,-1],[13,-2],[12,-1]],
  },
  back_slip_fall: {
    label: "Back injury from slip and fall",
    description: "Lumbar strain from slip and fall with persistent pain",
    bodyParts: ["lower back", "lumbar spine"],
    deltas: [[11,-2],[13,-2],[12,-1],[14,-1]],
  },
  knee_injury: {
    label: "Knee injury",
    description: "Medial meniscus tear with partial ACL sprain",
    bodyParts: ["left knee", "meniscus"],
    deltas: [[11,-1],[12,-2],[13,-2]],
  },
  heart_attack: {
    label: "Heart attack (myocardial infarction)",
    description: "Acute myocardial infarction with stent placement and reduced activity tolerance",
    bodyParts: ["heart", "cardiovascular system"],
    deltas: [[11,-2],[12,-2],[19,-1],[22,-1]],
  },
  mva_multiple: {
    label: "Motor vehicle accident with multiple injuries",
    description: "MVA with cervical strain, lumbar disc bulge, and right shoulder impingement",
    bodyParts: ["cervical spine", "lumbar spine", "right shoulder"],
    deltas: [[11,-1],[14,-2],[13,-1],[12,-1]],
  },
  shoulder_surgery: {
    label: "Shoulder surgery (labral repair)",
    description: "Arthroscopic labral repair of right shoulder with residual limitations",
    bodyParts: ["right shoulder"],
    deltas: [[11,-1],[14,-2],[12,-1]],
  },
  fibromyalgia: {
    label: "Fibromyalgia",
    description: "Fibromyalgia with widespread chronic pain and fatigue",
    bodyParts: ["whole body", "musculoskeletal system"],
    deltas: [[11,-1],[13,-1],[12,-1],[14,-1],[19,-1],[18,-1]],
  },
  crps: {
    label: "Complex Regional Pain Syndrome (CRPS)",
    description: "CRPS Type I affecting right upper extremity with allodynia and motor dysfunction",
    bodyParts: ["right arm", "right hand"],
    deltas: [[7,-2],[8,-2],[14,-2],[11,-1]],
  },
  mva_whiplash: {
    label: "MVA - whiplash and concussion",
    description: "Motor vehicle accident causing cervical whiplash and mild concussion",
    bodyParts: ["cervical spine", "head", "neck"],
    deltas: [[0,-1],[14,-1],[12,-1],[11,-1]],
  },
  ptsd_workplace: {
    label: "PTSD from workplace violence",
    description: "PTSD resulting from workplace violence incident with hypervigilance and avoidance",
    bodyParts: ["psychological", "mental health"],
    deltas: [[0,-1],[15,-1],[17,-2]],
  },
  vocal_cord: {
    label: "Vocal cord paralysis",
    description: "Unilateral vocal cord paralysis with dysphonia and voice fatigue",
    bodyParts: ["vocal cords", "larynx"],
    deltas: [[15,-2],[2,-1]],
  },
  gunshot_leg: {
    label: "Gunshot wound to leg",
    description: "Gunshot wound to right lower extremity with femoral fracture and nerve damage",
    bodyParts: ["right leg", "femur", "nerves"],
    deltas: [[11,-2],[12,-2],[13,-1],[9,-1]],
  },
  chemical_burns: {
    label: "Chemical burns to both hands",
    description: "Chemical burns to both hands with scarring and reduced grip strength",
    bodyParts: ["both hands", "fingers"],
    deltas: [[7,-2],[8,-2],[19,-1]],
  },
  heat_stroke: {
    label: "Heat stroke with neurological damage",
    description: "Exertional heat stroke with residual neurological deficits and heat intolerance",
    bodyParts: ["brain", "central nervous system"],
    deltas: [[0,-1],[1,-1],[19,-3],[6,-1]],
  },
  hand_arthritis: {
    label: "Bilateral hand arthritis",
    description: "Advanced osteoarthritis affecting both hands with reduced grip and pinch strength",
    bodyParts: ["both hands", "finger joints"],
    deltas: [[7,-2],[8,-2],[14,-1]],
  },
  chronic_lung: {
    label: "Chronic lung disease from occupational exposure",
    description: "Occupational chronic lung disease from paint fume exposure with reduced pulmonary function",
    bodyParts: ["lungs", "respiratory system"],
    deltas: [[11,-1],[23,-2],[19,-1],[18,-1]],
  },
  anxiety_depression: {
    label: "Generalized anxiety and major depression",
    description: "Generalized anxiety disorder with comorbid major depressive disorder",
    bodyParts: ["psychological", "mental health"],
    deltas: [[0,-1],[15,-1],[17,-1]],
  },
  chronic_pain: {
    label: "Chronic pain syndrome",
    description: "Chronic widespread pain syndrome with central sensitization",
    bodyParts: ["whole body", "central nervous system"],
    deltas: [[11,-1],[13,-1],[12,-1],[0,-1]],
  },
};

// ─── Test case definitions ──────────────────────────────────────────────

interface TestCaseDef {
  caseNumber: number;
  category: string;
  jobTitle: string;
  onetCode: string;
  svp: number;
  strength: string; // S L M H V
  injury: string; // key into INJURIES
  age: number;
  zip: string;
  metro: string;
  preTraits: number[];
  employer: string;
  durationMonths: number;
  priorEarnings: number;
  skills: Array<{ verb: string; object: string; context?: string; tools?: string }>;
  ageRule: string;
}

// Helper to determine age rule
function getAgeRule(age: number): string {
  if (age >= 55) return "advanced_age";
  if (age >= 50) return "closely_approaching";
  return "standard";
}

const TEST_CASES: TestCaseDef[] = [
  // ── Category 1: Construction/Heavy Physical (1-5) ──
  {
    caseNumber: 1, category: "Construction/Heavy Physical",
    jobTitle: "Carpenter", onetCode: "47-2031.00", svp: 7, strength: "H",
    injury: "lumbar", age: 45, zip: "90210",
    metro: "Los Angeles-Long Beach-Anaheim, CA",
    preTraits: [3,2,3,3,3,2, 3,3,3,2,2, 3,3,3,3,3,3, 2,1,1,1,2,2,2],
    employer: "Pacific Coast Builders", durationMonths: 120, priorEarnings: 52000,
    skills: [
      { verb: "Construct", object: "wooden frameworks and structures", context: "residential construction", tools: "power saws, nail guns, levels" },
      { verb: "Read", object: "blueprints and specifications", context: "commercial building projects", tools: "measuring tape, architect's scale" },
    ],
    ageRule: "standard",
  },
  {
    caseNumber: 2, category: "Construction/Heavy Physical",
    jobTitle: "Electrician", onetCode: "47-2111.00", svp: 7, strength: "M",
    injury: "shoulder", age: 38, zip: "10001",
    metro: "New York-Newark-Jersey City, NY-NJ-PA",
    preTraits: [4,3,3,3,3,3, 3,4,3,2,3, 2,3,2,3,3,4, 2,1,1,1,2,3,1],
    employer: "Metro Electric Corp", durationMonths: 96, priorEarnings: 68000,
    skills: [
      { verb: "Install", object: "electrical wiring systems", context: "new construction", tools: "wire strippers, multimeter, conduit benders" },
      { verb: "Diagnose", object: "electrical faults", context: "troubleshooting service calls", tools: "voltage tester, oscilloscope" },
    ],
    ageRule: "standard",
  },
  {
    caseNumber: 3, category: "Construction/Heavy Physical",
    jobTitle: "Plumber", onetCode: "47-2152.00", svp: 7, strength: "H",
    injury: "knee", age: 52, zip: "60601",
    metro: "Chicago-Naperville-Elgin, IL-IN-WI",
    preTraits: [3,2,3,3,3,2, 3,3,3,2,2, 3,3,3,3,3,3, 2,1,1,2,2,2,1],
    employer: "Windy City Plumbing", durationMonths: 180, priorEarnings: 62000,
    skills: [
      { verb: "Install", object: "pipe systems and fixtures", context: "residential plumbing", tools: "pipe wrenches, soldering torch, PVC cutters" },
      { verb: "Repair", object: "water and drainage systems", context: "emergency service calls", tools: "drain snake, pipe camera" },
    ],
    ageRule: "closely_approaching",
  },
  {
    caseNumber: 4, category: "Construction/Heavy Physical",
    jobTitle: "Heavy Equipment Operator", onetCode: "47-2073.00", svp: 6, strength: "H",
    injury: "cervical", age: 41, zip: "77001",
    metro: "Houston-The Woodlands-Sugar Land, TX",
    preTraits: [3,2,2,3,3,2, 3,2,3,3,2, 3,2,2,3,3,4, 3,1,1,1,3,3,3],
    employer: "Gulf Coast Earthworks", durationMonths: 108, priorEarnings: 55000,
    skills: [
      { verb: "Operate", object: "excavators and bulldozers", context: "site grading and excavation", tools: "CAT excavator, GPS grading system" },
      { verb: "Perform", object: "daily equipment inspections", context: "preventive maintenance", tools: "grease gun, fluid gauges" },
    ],
    ageRule: "standard",
  },
  {
    caseNumber: 5, category: "Construction/Heavy Physical",
    jobTitle: "Construction Laborer", onetCode: "47-2061.00", svp: 3, strength: "V",
    injury: "hip", age: 55, zip: "85001",
    metro: "Phoenix-Mesa-Chandler, AZ",
    preTraits: [2,1,2,2,2,1, 2,2,2,2,1, 4,3,3,3,2,3, 3,2,2,2,3,3,3],
    employer: "Desert Sun Construction", durationMonths: 144, priorEarnings: 38000,
    skills: [
      { verb: "Operate", object: "hand and power tools", context: "site preparation", tools: "jackhammer, wheelbarrow, shovel" },
      { verb: "Load", object: "construction materials", context: "material handling", tools: "hand truck, pallet jack" },
    ],
    ageRule: "advanced_age",
  },

  // ── Category 2: Healthcare (6-10) ──
  {
    caseNumber: 6, category: "Healthcare",
    jobTitle: "Registered Nurse", onetCode: "29-1141.00", svp: 7, strength: "M",
    injury: "back_lifting", age: 42, zip: "02101",
    metro: "Boston-Cambridge-Newton, MA-NH",
    preTraits: [4,3,4,2,3,3, 3,3,3,2,2, 2,2,2,3,4,4, 2,1,1,1,2,2,1],
    employer: "Massachusetts General Hospital", durationMonths: 132, priorEarnings: 78000,
    skills: [
      { verb: "Administer", object: "medications and treatments", context: "acute care nursing", tools: "IV pumps, electronic health records" },
      { verb: "Assess", object: "patient health status", context: "clinical evaluation", tools: "stethoscope, blood pressure cuff" },
      { verb: "Document", object: "patient care records", context: "HIPAA-compliant charting", tools: "Epic EMR" },
    ],
    ageRule: "standard",
  },
  {
    caseNumber: 7, category: "Healthcare",
    jobTitle: "CNA/Nursing Aide", onetCode: "31-1131.00", svp: 4, strength: "H",
    injury: "carpal_tunnel", age: 35, zip: "30301",
    metro: "Atlanta-Sandy Springs-Alpharetta, GA",
    preTraits: [2,2,3,1,2,2, 2,3,3,2,1, 3,2,2,3,3,3, 2,1,1,1,1,1,1],
    employer: "Peachtree Senior Living", durationMonths: 60, priorEarnings: 30000,
    skills: [
      { verb: "Assist", object: "patients with daily living activities", context: "long-term care facility", tools: "Hoyer lift, gait belt" },
      { verb: "Monitor", object: "vital signs", context: "routine patient assessment", tools: "blood pressure cuff, thermometer" },
    ],
    ageRule: "standard",
  },
  {
    caseNumber: 8, category: "Healthcare",
    jobTitle: "Medical Assistant", onetCode: "31-9092.00", svp: 5, strength: "M",
    injury: "ankle_fracture", age: 29, zip: "98101",
    metro: "Seattle-Tacoma-Bellevue, WA",
    preTraits: [3,2,3,2,3,3, 3,3,3,2,2, 2,2,2,3,4,3, 1,1,1,1,1,1,1],
    employer: "Northwest Medical Group", durationMonths: 48, priorEarnings: 36000,
    skills: [
      { verb: "Perform", object: "phlebotomy and specimen collection", context: "outpatient clinic", tools: "vacutainer, centrifuge" },
      { verb: "Schedule", object: "patient appointments", context: "multi-provider practice", tools: "EHR scheduling module" },
    ],
    ageRule: "standard",
  },
  {
    caseNumber: 9, category: "Healthcare",
    jobTitle: "Physical Therapy Assistant", onetCode: "31-2021.00", svp: 6, strength: "M",
    injury: "tbi", age: 47, zip: "80201",
    metro: "Denver-Aurora-Lakewood, CO",
    preTraits: [3,2,3,2,3,2, 3,3,3,3,2, 2,2,2,3,4,3, 1,1,1,1,1,1,1],
    employer: "Rocky Mountain Rehab Center", durationMonths: 96, priorEarnings: 48000,
    skills: [
      { verb: "Guide", object: "patients through therapeutic exercises", context: "outpatient rehabilitation", tools: "resistance bands, parallel bars" },
      { verb: "Apply", object: "modalities and manual techniques", context: "post-surgical recovery", tools: "electrical stimulation, hot/cold packs" },
    ],
    ageRule: "standard",
  },
  {
    caseNumber: 10, category: "Healthcare",
    jobTitle: "Home Health Aide", onetCode: "31-1122.00", svp: 3, strength: "M",
    injury: "ptsd", age: 39, zip: "33101",
    metro: "Miami-Fort Lauderdale-Pompano Beach, FL",
    preTraits: [2,1,2,1,2,2, 2,2,2,2,1, 2,2,2,3,3,3, 2,1,1,1,1,1,1],
    employer: "Sunshine Home Care Services", durationMonths: 72, priorEarnings: 26000,
    skills: [
      { verb: "Assist", object: "elderly patients with personal care", context: "home health setting", tools: "medical supplies, mobility aids" },
      { verb: "Prepare", object: "meals and manage medications", context: "in-home patient care", tools: "pill organizer, kitchen equipment" },
    ],
    ageRule: "standard",
  },

  // ── Category 3: Office/Administrative (11-15) ──
  {
    caseNumber: 11, category: "Office/Administrative",
    jobTitle: "Administrative Assistant", onetCode: "43-6014.00", svp: 6, strength: "S",
    injury: "carpal_tunnel", age: 44, zip: "94101",
    metro: "San Francisco-Oakland-Berkeley, CA",
    preTraits: [3,2,3,2,3,4, 3,3,2,1,1, 0,1,1,3,3,3, 1,0,0,0,1,0,0],
    employer: "Bay Area Financial Services", durationMonths: 108, priorEarnings: 48000,
    skills: [
      { verb: "Manage", object: "executive calendars and correspondence", context: "corporate office", tools: "Microsoft Outlook, Word, Excel" },
      { verb: "Coordinate", object: "travel arrangements and meetings", context: "multi-department scheduling", tools: "Concur, WebEx, Teams" },
      { verb: "Prepare", object: "reports and presentations", context: "quarterly business reviews", tools: "PowerPoint, Excel" },
    ],
    ageRule: "standard",
  },
  {
    caseNumber: 12, category: "Office/Administrative",
    jobTitle: "Bookkeeper", onetCode: "43-3031.00", svp: 6, strength: "S",
    injury: "vision", age: 50, zip: "19101",
    metro: "Philadelphia-Camden-Wilmington, PA-NJ-DE-MD",
    preTraits: [3,4,3,2,3,4, 3,3,2,1,1, 0,1,1,3,3,4, 1,0,0,0,1,0,0],
    employer: "Liberty Accounting Group", durationMonths: 144, priorEarnings: 45000,
    skills: [
      { verb: "Maintain", object: "general ledger accounts", context: "monthly close process", tools: "QuickBooks, Sage" },
      { verb: "Reconcile", object: "bank statements and accounts", context: "financial reporting", tools: "Excel, accounting software" },
    ],
    ageRule: "closely_approaching",
  },
  {
    caseNumber: 13, category: "Office/Administrative",
    jobTitle: "Data Entry Clerk", onetCode: "43-9021.00", svp: 3, strength: "S",
    injury: "chronic_back", age: 33, zip: "48201",
    metro: "Detroit-Warren-Dearborn, MI",
    preTraits: [2,2,2,1,2,4, 3,4,3,1,1, 0,0,1,2,3,3, 1,0,0,0,1,0,0],
    employer: "Motor City Data Solutions", durationMonths: 36, priorEarnings: 30000,
    skills: [
      { verb: "Enter", object: "alphanumeric data", context: "database management", tools: "proprietary database, 10-key calculator" },
      { verb: "Verify", object: "data accuracy", context: "quality assurance", tools: "Excel, data validation tools" },
    ],
    ageRule: "standard",
  },
  {
    caseNumber: 14, category: "Office/Administrative",
    jobTitle: "Receptionist", onetCode: "43-4171.00", svp: 4, strength: "S",
    injury: "hearing", age: 46, zip: "55401",
    metro: "Minneapolis-St. Paul-Bloomington, MN-WI",
    preTraits: [2,2,3,1,2,3, 2,3,2,1,1, 0,1,1,3,4,3, 1,0,0,0,1,0,0],
    employer: "Twin Cities Medical Center", durationMonths: 84, priorEarnings: 32000,
    skills: [
      { verb: "Greet", object: "visitors and direct inquiries", context: "front desk operations", tools: "multi-line phone, scheduling software" },
      { verb: "Process", object: "incoming mail and deliveries", context: "office administration", tools: "postage meter, filing systems" },
    ],
    ageRule: "standard",
  },
  {
    caseNumber: 15, category: "Office/Administrative",
    jobTitle: "Office Manager", onetCode: "11-3012.00", svp: 7, strength: "S",
    injury: "cardiac", age: 58, zip: "97201",
    metro: "Portland-Vancouver-Hillsboro, OR-WA",
    preTraits: [4,3,4,2,3,3, 3,3,2,1,1, 0,1,1,3,4,3, 1,0,0,0,1,0,0],
    employer: "Rose City Professional Services", durationMonths: 168, priorEarnings: 58000,
    skills: [
      { verb: "Supervise", object: "administrative staff operations", context: "multi-department office", tools: "MS Office Suite, project management software" },
      { verb: "Manage", object: "office budgets and procurement", context: "fiscal planning", tools: "QuickBooks, purchase order systems" },
    ],
    ageRule: "advanced_age",
  },

  // ── Category 4: Manufacturing/Skilled Trades (16-20) ──
  {
    caseNumber: 16, category: "Manufacturing/Skilled Trades",
    jobTitle: "Welder", onetCode: "51-4121.00", svp: 7, strength: "H",
    injury: "respiratory", age: 48, zip: "15201",
    metro: "Pittsburgh, PA",
    preTraits: [3,2,2,3,3,2, 3,3,3,3,2, 3,2,2,3,2,4, 3,1,2,1,3,3,3],
    employer: "Steel City Fabrication", durationMonths: 156, priorEarnings: 56000,
    skills: [
      { verb: "Perform", object: "MIG and TIG welding operations", context: "structural steel fabrication", tools: "MIG welder, TIG welder, plasma cutter" },
      { verb: "Read", object: "welding blueprints and symbols", context: "fabrication shop", tools: "welding gauges, calipers" },
    ],
    ageRule: "standard",
  },
  {
    caseNumber: 17, category: "Manufacturing/Skilled Trades",
    jobTitle: "CNC Machine Operator", onetCode: "51-4011.00", svp: 5, strength: "M",
    injury: "hand_crush", age: 36, zip: "44101",
    metro: "Cleveland-Elyria, OH",
    preTraits: [3,3,2,3,3,2, 3,4,3,2,2, 2,2,2,3,3,3, 2,1,1,1,2,2,1],
    employer: "Great Lakes Precision Machining", durationMonths: 72, priorEarnings: 42000,
    skills: [
      { verb: "Set up", object: "CNC lathes and milling machines", context: "precision parts manufacturing", tools: "CNC controls, micrometers, calipers" },
      { verb: "Program", object: "G-code for machining operations", context: "production runs", tools: "CAM software, CNC controller" },
    ],
    ageRule: "standard",
  },
  {
    caseNumber: 18, category: "Manufacturing/Skilled Trades",
    jobTitle: "Auto Mechanic", onetCode: "49-3023.00", svp: 7, strength: "H",
    injury: "lumbar_fusion", age: 43, zip: "75201",
    metro: "Dallas-Fort Worth-Arlington, TX",
    preTraits: [3,2,2,3,3,2, 3,3,3,2,2, 3,2,3,3,3,3, 2,1,1,1,2,2,1],
    employer: "Lone Star Auto Repair", durationMonths: 132, priorEarnings: 48000,
    skills: [
      { verb: "Diagnose", object: "automotive mechanical problems", context: "full-service repair shop", tools: "OBD-II scanner, lift, hand tools" },
      { verb: "Repair", object: "engine and transmission components", context: "preventive maintenance", tools: "torque wrench, air compressor" },
    ],
    ageRule: "standard",
  },
  {
    caseNumber: 19, category: "Manufacturing/Skilled Trades",
    jobTitle: "Maintenance Technician", onetCode: "49-9071.00", svp: 6, strength: "M",
    injury: "electrical_burn", age: 40, zip: "63101",
    metro: "St. Louis, MO-IL",
    preTraits: [3,2,2,3,3,2, 3,3,3,2,2, 2,2,2,3,3,3, 2,1,1,1,2,3,1],
    employer: "Gateway Manufacturing Inc", durationMonths: 84, priorEarnings: 44000,
    skills: [
      { verb: "Troubleshoot", object: "industrial machinery and equipment", context: "manufacturing facility", tools: "multimeter, hand tools, PLC controllers" },
      { verb: "Perform", object: "preventive maintenance tasks", context: "scheduled plant maintenance", tools: "lubrication equipment, alignment tools" },
    ],
    ageRule: "standard",
  },
  {
    caseNumber: 20, category: "Manufacturing/Skilled Trades",
    jobTitle: "Quality Inspector", onetCode: "51-9061.00", svp: 5, strength: "L",
    injury: "tbi_fall", age: 51, zip: "46201",
    metro: "Indianapolis-Carmel-Anderson, IN",
    preTraits: [3,3,3,3,3,3, 3,3,3,2,2, 1,1,2,3,3,4, 2,1,1,1,2,1,1],
    employer: "Hoosier Quality Systems", durationMonths: 108, priorEarnings: 40000,
    skills: [
      { verb: "Inspect", object: "manufactured parts for defects", context: "quality assurance", tools: "calipers, micrometers, CMM" },
      { verb: "Document", object: "quality control findings", context: "ISO compliance", tools: "quality management software, gauges" },
    ],
    ageRule: "closely_approaching",
  },

  // ── Category 5: Food Service/Hospitality (21-25) ──
  {
    caseNumber: 21, category: "Food Service/Hospitality",
    jobTitle: "Restaurant Cook", onetCode: "35-2014.00", svp: 5, strength: "M",
    injury: "grease_burn", age: 32, zip: "70112",
    metro: "New Orleans-Metairie, LA",
    preTraits: [2,2,2,2,2,2, 3,3,3,2,2, 2,2,2,3,3,3, 2,1,2,1,2,2,1],
    employer: "Bayou Kitchen Restaurant", durationMonths: 60, priorEarnings: 32000,
    skills: [
      { verb: "Prepare", object: "menu items to specification", context: "high-volume restaurant kitchen", tools: "commercial ovens, grills, fryers" },
      { verb: "Maintain", object: "food safety and sanitation standards", context: "health code compliance", tools: "thermometers, sanitizing equipment" },
    ],
    ageRule: "standard",
  },
  {
    caseNumber: 22, category: "Food Service/Hospitality",
    jobTitle: "Server/Waitress", onetCode: "35-3031.00", svp: 3, strength: "L",
    injury: "broken_wrist", age: 27, zip: "89101",
    metro: "Las Vegas-Henderson-Paradise, NV",
    preTraits: [2,2,3,1,2,2, 2,3,2,2,1, 1,1,1,3,4,3, 1,0,0,0,1,0,0],
    employer: "The Grand Bistro", durationMonths: 36, priorEarnings: 28000,
    skills: [
      { verb: "Serve", object: "food and beverages to guests", context: "fine dining restaurant", tools: "POS system, serving trays" },
      { verb: "Process", object: "customer payments and tips", context: "table service", tools: "credit card terminal, cash register" },
    ],
    ageRule: "standard",
  },
  {
    caseNumber: 23, category: "Food Service/Hospitality",
    jobTitle: "Bartender", onetCode: "35-3011.00", svp: 4, strength: "L",
    injury: "shoulder_dislocation", age: 34, zip: "37201",
    metro: "Nashville-Davidson-Murfreesboro-Franklin, TN",
    preTraits: [2,2,3,1,2,2, 3,3,3,2,1, 1,1,1,3,4,3, 1,0,0,0,2,0,0],
    employer: "Music City Tavern", durationMonths: 48, priorEarnings: 35000,
    skills: [
      { verb: "Mix", object: "cocktails and serve beverages", context: "high-volume bar", tools: "bar equipment, POS system" },
      { verb: "Manage", object: "bar inventory and supplies", context: "beverage management", tools: "inventory tracking software" },
    ],
    ageRule: "standard",
  },
  {
    caseNumber: 24, category: "Food Service/Hospitality",
    jobTitle: "Baker", onetCode: "51-3011.00", svp: 6, strength: "M",
    injury: "rsi", age: 45, zip: "53201",
    metro: "Milwaukee-Waukesha, WI",
    preTraits: [2,2,2,2,3,2, 3,3,3,2,1, 2,1,2,3,3,3, 1,1,1,1,1,1,1],
    employer: "Cream City Bakery", durationMonths: 120, priorEarnings: 35000,
    skills: [
      { verb: "Prepare", object: "bread, pastries, and baked goods", context: "commercial bakery", tools: "commercial mixer, ovens, proofing cabinet" },
      { verb: "Measure", object: "ingredients and follow recipes", context: "production baking", tools: "scales, measuring equipment" },
    ],
    ageRule: "standard",
  },
  {
    caseNumber: 25, category: "Food Service/Hospitality",
    jobTitle: "Kitchen Manager", onetCode: "11-9051.00", svp: 7, strength: "L",
    injury: "cardiac_arrest", age: 56, zip: "21201",
    metro: "Baltimore-Columbia-Towson, MD",
    preTraits: [3,3,3,2,2,3, 3,3,2,2,1, 1,1,1,3,4,3, 1,0,1,0,1,1,0],
    employer: "Harbor View Restaurant Group", durationMonths: 168, priorEarnings: 52000,
    skills: [
      { verb: "Supervise", object: "kitchen staff and operations", context: "full-service restaurant", tools: "scheduling software, inventory management" },
      { verb: "Control", object: "food costs and inventory", context: "restaurant management", tools: "POS reports, vendor ordering systems" },
    ],
    ageRule: "advanced_age",
  },

  // ── Category 6: Transportation (26-30) ──
  {
    caseNumber: 26, category: "Transportation",
    jobTitle: "Truck Driver (CDL)", onetCode: "53-3032.00", svp: 4, strength: "M",
    injury: "lumbar_disc", age: 49, zip: "84101",
    metro: "Salt Lake City, UT",
    preTraits: [2,2,2,3,2,2, 3,2,2,3,2, 2,2,2,3,3,4, 3,1,1,1,3,2,1],
    employer: "Mountain West Trucking", durationMonths: 120, priorEarnings: 50000,
    skills: [
      { verb: "Operate", object: "Class A commercial vehicles", context: "long-haul freight transport", tools: "tractor-trailer, GPS navigation, ELD" },
      { verb: "Perform", object: "pre-trip and post-trip inspections", context: "DOT compliance", tools: "inspection checklist, tire gauge" },
    ],
    ageRule: "standard",
  },
  {
    caseNumber: 27, category: "Transportation",
    jobTitle: "Delivery Driver", onetCode: "53-3031.00", svp: 3, strength: "M",
    injury: "knee_replacement", age: 44, zip: "23219",
    metro: "Richmond, VA",
    preTraits: [2,2,2,2,2,2, 3,2,2,3,1, 2,2,2,3,3,4, 3,1,1,1,2,2,1],
    employer: "Old Dominion Delivery Service", durationMonths: 60, priorEarnings: 34000,
    skills: [
      { verb: "Deliver", object: "packages and freight", context: "residential and commercial routes", tools: "delivery van, hand truck, scanner" },
      { verb: "Maintain", object: "delivery logs and manifests", context: "route management", tools: "electronic manifest, GPS" },
    ],
    ageRule: "standard",
  },
  {
    caseNumber: 28, category: "Transportation",
    jobTitle: "Bus Driver", onetCode: "53-3052.00", svp: 4, strength: "M",
    injury: "vision_loss", age: 53, zip: "32801",
    metro: "Orlando-Kissimmee-Sanford, FL",
    preTraits: [2,2,2,3,2,2, 3,2,2,3,2, 2,2,1,3,4,4, 3,1,1,1,2,2,1],
    employer: "Central Florida Transit", durationMonths: 96, priorEarnings: 38000,
    skills: [
      { verb: "Operate", object: "transit buses on assigned routes", context: "public transportation", tools: "transit bus, fare collection system" },
      { verb: "Ensure", object: "passenger safety and compliance", context: "ADA accessible transport", tools: "wheelchair ramp, PA system" },
    ],
    ageRule: "closely_approaching",
  },
  {
    caseNumber: 29, category: "Transportation",
    jobTitle: "Forklift Operator", onetCode: "53-7051.00", svp: 3, strength: "M",
    injury: "cervical_radiculopathy", age: 37, zip: "28201",
    metro: "Charlotte-Concord-Gastonia, NC-SC",
    preTraits: [2,2,2,3,2,2, 3,2,3,3,1, 2,2,2,3,3,3, 3,1,1,1,3,3,1],
    employer: "Carolina Distribution Center", durationMonths: 48, priorEarnings: 34000,
    skills: [
      { verb: "Operate", object: "sit-down and stand-up forklifts", context: "warehouse distribution", tools: "forklift, pallet jack, RF scanner" },
      { verb: "Load", object: "trucks and organize inventory", context: "shipping and receiving", tools: "forklift, shrink wrap machine" },
    ],
    ageRule: "standard",
  },
  {
    caseNumber: 30, category: "Transportation",
    jobTitle: "Warehouse Worker", onetCode: "53-7062.00", svp: 2, strength: "H",
    injury: "herniated_disc", age: 41, zip: "45201",
    metro: "Cincinnati, OH-KY-IN",
    preTraits: [2,1,2,2,2,1, 2,2,2,2,1, 3,2,2,3,3,3, 3,1,1,1,2,2,1],
    employer: "Ohio Valley Logistics", durationMonths: 72, priorEarnings: 36000,
    skills: [
      { verb: "Pick", object: "orders and stock inventory", context: "warehouse operations", tools: "RF scanner, pallet jack, hand truck" },
      { verb: "Load", object: "outbound shipments", context: "shipping dock", tools: "conveyor belt, stretch wrap" },
    ],
    ageRule: "standard",
  },

  // ── Category 7: IT/Technology (31-35) ──
  {
    caseNumber: 31, category: "IT/Technology",
    jobTitle: "IT Support Specialist", onetCode: "15-1232.00", svp: 6, strength: "S",
    injury: "carpal_tunnel", age: 30, zip: "78201",
    metro: "San Antonio-New Braunfels, TX",
    preTraits: [4,3,3,2,3,3, 3,3,2,1,1, 0,1,1,3,4,3, 1,0,0,0,1,0,0],
    employer: "Alamo Tech Solutions", durationMonths: 48, priorEarnings: 45000,
    skills: [
      { verb: "Troubleshoot", object: "hardware and software issues", context: "help desk support", tools: "Active Directory, ticketing system, remote desktop" },
      { verb: "Configure", object: "workstations and network equipment", context: "IT infrastructure", tools: "Windows Server, Cisco switches" },
    ],
    ageRule: "standard",
  },
  {
    caseNumber: 32, category: "IT/Technology",
    jobTitle: "Computer Programmer", onetCode: "15-1251.00", svp: 7, strength: "S",
    injury: "tbi", age: 35, zip: "27601",
    metro: "Raleigh-Cary, NC",
    preTraits: [5,4,4,3,3,3, 3,4,2,1,1, 0,0,0,2,3,3, 1,0,0,0,1,0,0],
    employer: "Triangle Software Inc", durationMonths: 72, priorEarnings: 85000,
    skills: [
      { verb: "Develop", object: "software applications", context: "full-stack development", tools: "Python, JavaScript, React, PostgreSQL" },
      { verb: "Debug", object: "code and resolve defects", context: "agile software development", tools: "Git, VS Code, Jira" },
      { verb: "Design", object: "database schemas and APIs", context: "backend architecture", tools: "PostgreSQL, REST APIs, Docker" },
    ],
    ageRule: "standard",
  },
  {
    caseNumber: 33, category: "IT/Technology",
    jobTitle: "Network Administrator", onetCode: "15-1244.00", svp: 7, strength: "S",
    injury: "chronic_pain", age: 42, zip: "40201",
    metro: "Louisville/Jefferson County, KY-IN",
    preTraits: [4,3,3,3,3,3, 3,3,2,1,1, 0,1,1,3,3,3, 1,0,0,0,1,0,0],
    employer: "Bluegrass Network Services", durationMonths: 96, priorEarnings: 62000,
    skills: [
      { verb: "Manage", object: "enterprise network infrastructure", context: "corporate IT", tools: "Cisco routers, firewalls, SNMP monitoring" },
      { verb: "Implement", object: "network security protocols", context: "cybersecurity", tools: "VPN, firewall rules, IDS/IPS" },
    ],
    ageRule: "standard",
  },
  {
    caseNumber: 34, category: "IT/Technology",
    jobTitle: "Help Desk Analyst", onetCode: "15-1232.00", svp: 5, strength: "S",
    injury: "anxiety_depression", age: 28, zip: "73101",
    metro: "Oklahoma City, OK",
    preTraits: [3,2,3,2,3,3, 3,3,2,1,1, 0,0,0,2,4,3, 1,0,0,0,1,0,0],
    employer: "Prairie Tech Support", durationMonths: 36, priorEarnings: 36000,
    skills: [
      { verb: "Resolve", object: "IT support tickets", context: "tier 1 help desk", tools: "ServiceNow, remote desktop, Active Directory" },
      { verb: "Document", object: "technical solutions", context: "knowledge base management", tools: "Confluence, SharePoint" },
    ],
    ageRule: "standard",
  },
  {
    caseNumber: 35, category: "IT/Technology",
    jobTitle: "Database Administrator", onetCode: "15-1242.00", svp: 7, strength: "S",
    injury: "stroke", age: 54, zip: "37901",
    metro: "Knoxville, TN",
    preTraits: [5,4,4,3,3,3, 3,4,2,1,1, 0,0,0,2,3,3, 1,0,0,0,1,0,0],
    employer: "Smoky Mountain Data Systems", durationMonths: 156, priorEarnings: 78000,
    skills: [
      { verb: "Administer", object: "Oracle and SQL Server databases", context: "enterprise data management", tools: "Oracle RDBMS, SQL Server, TOAD" },
      { verb: "Optimize", object: "database performance and queries", context: "production systems", tools: "execution plans, indexing, partitioning" },
    ],
    ageRule: "closely_approaching",
  },

  // ── Category 8: Retail/Sales (36-40) ──
  {
    caseNumber: 36, category: "Retail/Sales",
    jobTitle: "Cashier", onetCode: "41-2011.00", svp: 2, strength: "L",
    injury: "back_slip_fall", age: 25, zip: "04101",
    metro: "Portland-South Portland, ME",
    preTraits: [2,2,2,1,2,2, 2,2,2,2,1, 1,1,1,3,3,3, 1,0,0,0,1,0,0],
    employer: "Pine Tree Market", durationMonths: 24, priorEarnings: 24000,
    skills: [
      { verb: "Process", object: "customer transactions", context: "retail checkout", tools: "POS system, barcode scanner, cash register" },
      { verb: "Handle", object: "cash, credit, and return transactions", context: "customer service", tools: "cash drawer, credit card terminal" },
    ],
    ageRule: "standard",
  },
  {
    caseNumber: 37, category: "Retail/Sales",
    jobTitle: "Retail Sales Associate", onetCode: "41-2031.00", svp: 4, strength: "L",
    injury: "knee_injury", age: 31, zip: "50301",
    metro: "Des Moines-West Des Moines, IA",
    preTraits: [2,2,3,1,2,2, 2,2,2,2,1, 1,1,1,3,4,3, 1,0,0,0,1,0,0],
    employer: "Heartland Home Furnishings", durationMonths: 48, priorEarnings: 28000,
    skills: [
      { verb: "Assist", object: "customers with product selection", context: "retail sales floor", tools: "POS system, product catalog" },
      { verb: "Maintain", object: "merchandise displays", context: "visual merchandising", tools: "planogram, display fixtures" },
    ],
    ageRule: "standard",
  },
  {
    caseNumber: 38, category: "Retail/Sales",
    jobTitle: "Store Manager", onetCode: "41-1011.00", svp: 7, strength: "L",
    injury: "heart_attack", age: 57, zip: "29201",
    metro: "Columbia, SC",
    preTraits: [4,3,4,2,2,3, 3,3,2,1,1, 1,1,1,3,4,3, 1,0,0,0,1,0,0],
    employer: "Palmetto Retail Group", durationMonths: 180, priorEarnings: 55000,
    skills: [
      { verb: "Manage", object: "retail store operations", context: "multi-department retail", tools: "POS system, inventory management, scheduling software" },
      { verb: "Train", object: "sales staff and supervisors", context: "employee development", tools: "training modules, performance reviews" },
    ],
    ageRule: "advanced_age",
  },
  {
    caseNumber: 39, category: "Retail/Sales",
    jobTitle: "Sales Representative", onetCode: "41-4012.00", svp: 6, strength: "L",
    injury: "mva_multiple", age: 40, zip: "87101",
    metro: "Albuquerque, NM",
    preTraits: [3,3,4,2,2,2, 2,2,2,2,1, 1,1,1,3,4,3, 2,0,0,0,1,0,0],
    employer: "Southwest Medical Supplies", durationMonths: 72, priorEarnings: 60000,
    skills: [
      { verb: "Sell", object: "medical supplies to healthcare facilities", context: "B2B sales territory", tools: "CRM software, presentation tools" },
      { verb: "Manage", object: "client accounts and relationships", context: "territory management", tools: "Salesforce, Excel, vehicle" },
    ],
    ageRule: "standard",
  },
  {
    caseNumber: 40, category: "Retail/Sales",
    jobTitle: "Warehouse Associate", onetCode: "53-7062.00", svp: 2, strength: "H",
    injury: "shoulder_surgery", age: 33, zip: "68101",
    metro: "Omaha-Council Bluffs, NE-IA",
    preTraits: [2,1,2,2,2,1, 2,2,2,2,1, 3,2,2,3,3,3, 3,1,1,1,2,2,1],
    employer: "Cornhusker Distribution", durationMonths: 48, priorEarnings: 34000,
    skills: [
      { verb: "Pick", object: "orders from warehouse shelves", context: "order fulfillment", tools: "RF scanner, pallet jack" },
      { verb: "Pack", object: "items for shipment", context: "shipping operations", tools: "packing materials, conveyor, tape machine" },
    ],
    ageRule: "standard",
  },

  // ── Category 9: Professional/Skilled (41-45) ──
  {
    caseNumber: 41, category: "Professional/Skilled",
    jobTitle: "Accountant", onetCode: "13-2011.00", svp: 7, strength: "S",
    injury: "fibromyalgia", age: 48, zip: "06101",
    metro: "Hartford-East Hartford-Middletown, CT",
    preTraits: [4,5,4,2,3,4, 3,3,2,1,1, 0,0,0,2,3,3, 1,0,0,0,1,0,0],
    employer: "New England Accounting Partners", durationMonths: 132, priorEarnings: 65000,
    skills: [
      { verb: "Prepare", object: "financial statements and tax returns", context: "public accounting", tools: "QuickBooks, tax software, Excel" },
      { verb: "Audit", object: "financial records for compliance", context: "regulatory compliance", tools: "audit software, Excel, GAAP references" },
    ],
    ageRule: "standard",
  },
  {
    caseNumber: 42, category: "Professional/Skilled",
    jobTitle: "Paralegal", onetCode: "23-2011.00", svp: 6, strength: "S",
    injury: "crps", age: 37, zip: "20001",
    metro: "Washington-Arlington-Alexandria, DC-VA-MD-WV",
    preTraits: [4,3,4,2,3,4, 3,3,2,1,1, 0,0,0,3,3,3, 1,0,0,0,1,0,0],
    employer: "Capitol Law Associates", durationMonths: 72, priorEarnings: 55000,
    skills: [
      { verb: "Research", object: "case law and legal precedents", context: "litigation support", tools: "Westlaw, LexisNexis, PACER" },
      { verb: "Draft", object: "legal documents and briefs", context: "civil litigation", tools: "MS Word, document management system" },
    ],
    ageRule: "standard",
  },
  {
    caseNumber: 43, category: "Professional/Skilled",
    jobTitle: "Insurance Claims Adjuster", onetCode: "13-1031.00", svp: 6, strength: "L",
    injury: "mva_whiplash", age: 45, zip: "43201",
    metro: "Columbus, OH",
    preTraits: [4,3,4,2,3,3, 3,3,2,2,1, 1,1,1,3,4,3, 2,0,0,0,1,0,0],
    employer: "Buckeye Insurance Group", durationMonths: 96, priorEarnings: 52000,
    skills: [
      { verb: "Investigate", object: "insurance claims", context: "property and casualty", tools: "claims management software, digital camera" },
      { verb: "Negotiate", object: "claim settlements", context: "policyholder and claimant interactions", tools: "estimating software, policy documents" },
    ],
    ageRule: "standard",
  },
  {
    caseNumber: 44, category: "Professional/Skilled",
    jobTitle: "Social Worker", onetCode: "21-1021.00", svp: 7, strength: "L",
    injury: "ptsd_workplace", age: 39, zip: "61601",
    metro: "Peoria, IL",
    preTraits: [4,2,4,2,2,3, 2,2,2,1,1, 1,1,1,2,4,3, 2,0,0,0,1,0,0],
    employer: "Prairie State Family Services", durationMonths: 84, priorEarnings: 42000,
    skills: [
      { verb: "Conduct", object: "client assessments and case planning", context: "child welfare services", tools: "assessment tools, case management software" },
      { verb: "Coordinate", object: "community resources and referrals", context: "social services", tools: "resource directories, electronic case files" },
    ],
    ageRule: "standard",
  },
  {
    caseNumber: 45, category: "Professional/Skilled",
    jobTitle: "Teacher (Elementary)", onetCode: "25-2021.00", svp: 7, strength: "L",
    injury: "vocal_cord", age: 52, zip: "35201",
    metro: "Birmingham-Hoover, AL",
    preTraits: [4,3,4,2,2,3, 2,2,2,1,1, 1,1,1,2,4,3, 1,0,0,0,2,0,0],
    employer: "Jefferson County Schools", durationMonths: 180, priorEarnings: 50000,
    skills: [
      { verb: "Instruct", object: "elementary students in core subjects", context: "K-5 classroom", tools: "interactive whiteboard, educational software" },
      { verb: "Develop", object: "lesson plans and assessments", context: "curriculum development", tools: "Google Classroom, learning management system" },
    ],
    ageRule: "closely_approaching",
  },

  // ── Category 10: Miscellaneous/Edge Cases (46-50) ──
  {
    caseNumber: 46, category: "Miscellaneous/Edge Cases",
    jobTitle: "Security Guard", onetCode: "33-9032.00", svp: 3, strength: "M",
    injury: "gunshot_leg", age: 36, zip: "92101",
    metro: "San Diego-Chula Vista-Carlsbad, CA",
    preTraits: [2,2,2,2,2,2, 2,2,2,2,1, 2,2,2,3,3,4, 3,1,1,1,2,2,1],
    employer: "Pacific Security Services", durationMonths: 60, priorEarnings: 32000,
    skills: [
      { verb: "Monitor", object: "premises and access points", context: "commercial property security", tools: "surveillance cameras, access control system" },
      { verb: "Patrol", object: "assigned areas", context: "security rounds", tools: "two-way radio, flashlight, patrol vehicle" },
    ],
    ageRule: "standard",
  },
  {
    caseNumber: 47, category: "Miscellaneous/Edge Cases",
    jobTitle: "Janitor/Custodian", onetCode: "37-2011.00", svp: 2, strength: "M",
    injury: "chemical_burns", age: 43, zip: "99501",
    metro: "Anchorage, AK",
    preTraits: [1,1,1,1,1,1, 2,2,2,2,1, 2,2,2,3,2,3, 3,1,1,1,2,2,2],
    employer: "Northern Lights Facility Services", durationMonths: 84, priorEarnings: 30000,
    skills: [
      { verb: "Clean", object: "commercial building spaces", context: "janitorial maintenance", tools: "floor buffer, vacuum, cleaning chemicals" },
      { verb: "Maintain", object: "building and grounds", context: "facility maintenance", tools: "hand tools, snow removal equipment" },
    ],
    ageRule: "standard",
  },
  {
    caseNumber: 48, category: "Miscellaneous/Edge Cases",
    jobTitle: "Landscaper", onetCode: "37-3011.00", svp: 3, strength: "H",
    injury: "heat_stroke", age: 30, zip: "85201",
    metro: "Phoenix-Mesa-Chandler, AZ",
    preTraits: [2,1,1,2,2,1, 2,2,2,2,1, 3,2,2,3,2,3, 3,1,2,1,2,2,2],
    employer: "Desert Bloom Landscaping", durationMonths: 48, priorEarnings: 28000,
    skills: [
      { verb: "Install", object: "landscape plants and irrigation", context: "residential landscaping", tools: "shovel, wheelbarrow, irrigation parts" },
      { verb: "Operate", object: "power landscaping equipment", context: "commercial grounds maintenance", tools: "mower, trimmer, leaf blower" },
    ],
    ageRule: "standard",
  },
  {
    caseNumber: 49, category: "Miscellaneous/Edge Cases",
    jobTitle: "Hair Stylist", onetCode: "39-5012.00", svp: 6, strength: "L",
    injury: "hand_arthritis", age: 55, zip: "02901",
    metro: "Providence-Warwick, RI-MA",
    preTraits: [2,2,2,2,3,2, 3,4,4,2,2, 1,1,1,3,4,3, 1,0,0,0,1,0,0],
    employer: "Ocean State Salon", durationMonths: 180, priorEarnings: 32000,
    skills: [
      { verb: "Cut", object: "and style hair", context: "full-service salon", tools: "shears, clippers, blow dryer, flat iron" },
      { verb: "Apply", object: "color treatments and chemical services", context: "hair color services", tools: "color applicator, mixing bowls, timer" },
    ],
    ageRule: "advanced_age",
  },
  {
    caseNumber: 50, category: "Miscellaneous/Edge Cases",
    jobTitle: "Automotive Painter", onetCode: "51-9122.00", svp: 6, strength: "M",
    injury: "chronic_lung", age: 47, zip: "14201",
    metro: "Buffalo-Cheektowaga, NY",
    preTraits: [2,2,2,3,3,2, 3,3,3,2,3, 2,2,2,3,2,3, 2,1,1,1,2,2,3],
    employer: "Lake Erie Auto Body", durationMonths: 120, priorEarnings: 40000,
    skills: [
      { verb: "Apply", object: "automotive paint and finishes", context: "collision repair", tools: "spray gun, paint booth, compressor" },
      { verb: "Prepare", object: "vehicle surfaces for painting", context: "body shop", tools: "sandpaper, primer, masking tape" },
    ],
    ageRule: "standard",
  },
];


// ─── Apply injury to pre-traits ─────────────────────────────────────────
function applyInjury(pre: number[], injuryKey: string): number[] {
  const inj = INJURIES[injuryKey];
  if (!inj) return [...pre];
  const post = [...pre];
  for (const [idx, drop] of inj.deltas) {
    post[idx] = clamp(post[idx] + drop, 0, 5);
  }
  return post;
}


// ─── API helpers ────────────────────────────────────────────────────────

async function apiPost(path: string, body: unknown): Promise<unknown> {
  const resp = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`POST ${path} failed (${resp.status}): ${text}`);
  }
  return resp.json();
}

async function apiGet(path: string): Promise<unknown> {
  const resp = await fetch(`${BASE_URL}${path}`);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GET ${path} failed (${resp.status}): ${text}`);
  }
  return resp.json();
}

// ─── Resolve ZIP to metro area ──────────────────────────────────────────
async function resolveZip(zip: string): Promise<{ areaCode: string; areaName: string }> {
  const data = await apiGet(`/api/geo/zip-to-metro?zip=${zip}`) as Record<string, string>;
  return { areaCode: data.areaCode || "0000000", areaName: data.areaName || "National" };
}


// ─── Main ───────────────────────────────────────────────────────────────

async function main() {
  // Check server is running
  try {
    await fetch(`${BASE_URL}/api/health`);
    console.log("[OK] Dev server is running on port 3000");
  } catch {
    console.error("[ERROR] Dev server is not running on http://localhost:3000");
    console.error("Start it first with: npm run dev");
    process.exit(1);
  }

  // Connect to DB for results collection
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  const results: Array<Record<string, unknown>> = [];
  const errors: Array<{ caseNumber: number; error: string }> = [];

  console.log(`\n${"=".repeat(70)}`);
  console.log("  Creating 50 test cases with full analysis pipeline");
  console.log(`${"=".repeat(70)}\n`);

  for (const tc of TEST_CASES) {
    const startTime = Date.now();
    try {
      console.log(`[${tc.caseNumber}/50] ${tc.category} - ${tc.jobTitle} (age ${tc.age}, ZIP ${tc.zip})`);

      // 1. Resolve ZIP to metro
      const metro = await resolveZip(tc.zip);

      // 2. Compute DOB from age
      const dob = new Date(2026 - tc.age, 5, 15); // June 15 of birth year

      // 3. Create case
      const caseData = await apiPost("/api/cases", {
        clientName: `Test Case ${tc.caseNumber} - ${tc.jobTitle}`,
        clientDOB: dob.toISOString(),
        evaluatorName: "Dr. Test Evaluator, CRC, CVE",
        referralSource: "Automated Test Script",
        dateOfInjury: "2024-06-15T00:00:00.000Z",
        dateOfEval: "2025-01-15T00:00:00.000Z",
        zipCode: tc.zip,
        metroAreaCode: metro.areaCode,
        metroAreaName: metro.areaName,
        injuryDescription: INJURIES[tc.injury]?.description || tc.injury,
        bodyPartsAffected: INJURIES[tc.injury]?.bodyParts || [],
        treatingPhysician: "Dr. Medical Provider",
        physicianSpecialty: "Orthopedic Surgery",
        notes: `Category: ${tc.category} | Injury: ${INJURIES[tc.injury]?.label || tc.injury}`,
      }) as { id: string };
      const caseId = caseData.id;

      // 4. Create PRW
      const prw = await apiPost(`/api/cases/${caseId}/prw`, {
        jobTitle: tc.jobTitle,
        employer: tc.employer,
        onetSocCode: tc.onetCode,
        svp: tc.svp,
        strengthLevel: tc.strength,
        durationMonths: tc.durationMonths,
        startDate: new Date(2024 - Math.ceil(tc.durationMonths / 12), 0, 1).toISOString(),
        endDate: "2024-06-15T00:00:00.000Z",
        dutiesDescription: tc.skills.map(s => `${s.verb} ${s.object}`).join("; "),
        isSubstantialGainful: true,
        actualWageAnnual: tc.priorEarnings,
        wageYear: 2024,
        hoursPerWeek: 40,
      }) as { id: string };

      // 5. Create acquired skills
      for (const skill of tc.skills) {
        await apiPost(`/api/cases/${caseId}/skills`, {
          prwId: prw.id,
          actionVerb: skill.verb,
          object: skill.object,
          context: skill.context || "",
          toolsSoftware: skill.tools || "",
          svpLevel: tc.svp,
          isTransferable: true,
        });
      }

      // 6. Create profiles (WORK_HISTORY, EVALUATIVE, PRE, POST)
      const preTraits = traitsToRecord(tc.preTraits);
      const postTraitsArr = applyInjury(tc.preTraits, tc.injury);
      const postTraits = traitsToRecord(postTraitsArr);

      // PRE profile
      await apiPost(`/api/cases/${caseId}/profiles`, {
        profileType: "PRE",
        ...preTraits,
        sources: "Pre-injury occupational demands",
      });

      // POST profile
      await apiPost(`/api/cases/${caseId}/profiles`, {
        profileType: "POST",
        ...postTraits,
        sources: "Post-injury functional capacity evaluation",
      });

      // WORK_HISTORY profile (same as PRE)
      await apiPost(`/api/cases/${caseId}/profiles`, {
        profileType: "WORK_HISTORY",
        ...preTraits,
        sources: "Work history records",
      });

      // EVALUATIVE profile (same as POST)
      await apiPost(`/api/cases/${caseId}/profiles`, {
        profileType: "EVALUATIVE",
        ...postTraits,
        sources: "Evaluator assessment",
      });

      // 7. Create analysis
      const analysis = await apiPost(`/api/cases/${caseId}/analysis`, {
        name: `Test Analysis - ${tc.jobTitle}`,
        ageRule: tc.ageRule,
        priorEarnings: tc.priorEarnings,
        targetArea: metro.areaCode,
        targetAreaName: metro.areaName,
      }) as { id: string };
      const analysisId = analysis.id;

      // 8. Run pipeline: generate candidates
      console.log(`   [Step 1/3] Generating candidates...`);
      const genResult = await apiPost(`/api/cases/${caseId}/analysis/${analysisId}/generate-candidates`, {}) as { count: number };
      console.log(`   -> ${genResult.count} candidates generated`);

      // 9. Filter traits
      console.log(`   [Step 2/3] Filtering traits...`);
      const filterResult = await apiPost(`/api/cases/${caseId}/analysis/${analysisId}/filter-traits`, {}) as { passed: number; excluded: number };
      console.log(`   -> ${filterResult.passed} passed, ${filterResult.excluded} excluded`);

      // 10. Compute scores
      console.log(`   [Step 3/3] Computing PVQ scores...`);
      const computeResult = await apiPost(`/api/cases/${caseId}/analysis/${analysisId}/compute`, {}) as { computed: number };
      console.log(`   -> ${computeResult.computed} occupations scored`);

      // 11. Fetch results
      const analysisResult = await apiGet(`/api/cases/${caseId}/analysis/${analysisId}/results`) as Record<string, unknown>;

      // Build trait changes
      const traitChanges: Array<{ trait: string; pre: number; post: number; change: number }> = [];
      for (const key of TRAIT_KEYS) {
        const pre = preTraits[key];
        const post = postTraits[key];
        if (pre !== post) {
          traitChanges.push({ trait: key, pre, post, change: post - pre });
        }
      }

      // Collect target occupations
      const targetOccs = (analysisResult.targetOccupations as Array<Record<string, unknown>>) || [];
      const viable = targetOccs.filter((t) => !t.excluded);
      const excluded = targetOccs.filter((t) => t.excluded);

      const topOccupations = viable.slice(0, 10).map((t) => ({
        title: t.title,
        onetCode: t.onetSocCode,
        pvq: t.pvq,
        stq: t.stq,
        tfq: t.tfq,
        vaq: t.vaq,
        lmq: t.lmq,
        vqScore: t.vqScore,
        vqBand: t.vqBand,
        ecMedian: t.ecMedian,
        confidenceGrade: t.confidenceGrade,
      }));

      const excludedOccupations = excluded.slice(0, 5).map((t) => ({
        title: t.title,
        onetCode: t.onetSocCode,
        exclusionReason: t.exclusionReason,
      }));

      const avgEc = viable.length > 0
        ? Math.round((viable.reduce((s, t) => s + ((t.ecMedian as number) || 0), 0) / viable.length) * 100) / 100
        : 0;

      const result = {
        caseNumber: tc.caseNumber,
        category: tc.category,
        clientName: `Test Case ${tc.caseNumber} - ${tc.jobTitle}`,
        age: tc.age,
        zipCode: tc.zip,
        metroArea: metro.areaName,
        prw: [{
          title: tc.jobTitle,
          onetCode: tc.onetCode,
          svp: tc.svp,
          strength: tc.strength,
          employer: tc.employer,
          durationMonths: tc.durationMonths,
        }],
        injury: {
          description: INJURIES[tc.injury]?.description || tc.injury,
          bodyParts: INJURIES[tc.injury]?.bodyParts || [],
          date: "2024-06-15",
        },
        ageRule: tc.ageRule,
        priorEarnings: tc.priorEarnings,
        preProfile: preTraits,
        postProfile: postTraits,
        traitChanges,
        results: {
          totalCandidates: targetOccs.length,
          viableCount: viable.length,
          excludedCount: excluded.length,
          topOccupations,
          excludedOccupations,
          preInjuryViable: analysisResult.preInjuryViableCount ?? null,
          postInjuryViable: analysisResult.postInjuryViableCount ?? viable.length,
          occupationsLost: (analysisResult.preInjuryViableCount != null)
            ? (analysisResult.preInjuryViableCount as number) - viable.length
            : null,
          lossPercentage: (analysisResult.preInjuryViableCount != null && (analysisResult.preInjuryViableCount as number) > 0)
            ? Math.round(((analysisResult.preInjuryViableCount as number) - viable.length) / (analysisResult.preInjuryViableCount as number) * 10000) / 100
            : null,
          avgEarningCapacity: avgEc,
          preEarningCapacity: analysisResult.vqsPreEcMedian ?? null,
          ecLoss: analysisResult.vqsEcLoss ?? null,
          ecLossPercent: analysisResult.vqsEcLossPct ?? null,
        },
      };

      results.push(result);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`   [DONE] ${viable.length} viable, ${excluded.length} excluded (${elapsed}s)\n`);

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`   [ERROR] Case ${tc.caseNumber}: ${msg}\n`);
      errors.push({ caseNumber: tc.caseNumber, error: msg });
    }
  }

  // ─── Write results to JSON ────────────────────────────────────────────
  const outputDir = path.join(__dirname, "..", "data");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const output = {
    generatedAt: new Date().toISOString(),
    totalCases: results.length,
    errors: errors.length,
    cases: results,
  };

  const outputPath = path.join(outputDir, "test-case-results.json");
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nResults written to: ${outputPath}`);

  // ─── Summary table ────────────────────────────────────────────────────
  console.log(`\n${"=".repeat(90)}`);
  console.log("  SUMMARY");
  console.log(`${"=".repeat(90)}`);
  console.log(`  Total cases: ${results.length} / 50`);
  console.log(`  Errors: ${errors.length}`);
  console.log(`${"─".repeat(90)}`);
  console.log(
    "  #".padEnd(5) +
    "Category".padEnd(28) +
    "Job Title".padEnd(22) +
    "Age".padEnd(5) +
    "Viable".padEnd(8) +
    "Excl".padEnd(6) +
    "EC $/hr".padEnd(10) +
    "Grade"
  );
  console.log(`${"─".repeat(90)}`);

  for (const r of results) {
    const res = r.results as Record<string, unknown>;
    const top = ((res.topOccupations as unknown[]) || []) as Array<Record<string, unknown>>;
    const bestGrade = top.length > 0 ? top[0].confidenceGrade || "N/A" : "N/A";
    console.log(
      `  ${String(r.caseNumber).padEnd(4)}` +
      `${String(r.category).padEnd(28)}` +
      `${String(((r.prw as unknown[]) as Array<Record<string, string>>)[0]?.title || "").substring(0, 20).padEnd(22)}` +
      `${String(r.age).padEnd(5)}` +
      `${String(res.viableCount).padEnd(8)}` +
      `${String(res.excludedCount).padEnd(6)}` +
      `${String(res.avgEarningCapacity ? `$${(res.avgEarningCapacity as number).toFixed(2)}` : "N/A").padEnd(10)}` +
      `${bestGrade}`
    );
  }

  console.log(`${"─".repeat(90)}`);

  if (errors.length > 0) {
    console.log(`\n  ERRORS:`);
    for (const e of errors) {
      console.log(`    Case ${e.caseNumber}: ${e.error}`);
    }
  }

  console.log(`\n${"=".repeat(90)}\n`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
