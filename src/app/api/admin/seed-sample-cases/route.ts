import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/admin/seed-sample-cases
 *
 * Generates 500 diverse sample cases with realistic vocational data
 * for demonstration purposes. Each case includes:
 *  - Client demographics
 *  - Past Relevant Work (PRW) with DOT/O*NET codes
 *  - Worker Profiles (pre-injury and post-injury 24-trait vectors)
 *  - Acquired Skills in SSA format
 *  - A completed analysis with target occupations and PVQ scores
 */

// ─── Names & Demographics ─────────────────────────────────────────────

const FIRST_NAMES_M = [
  "James","Robert","John","Michael","David","William","Richard","Joseph",
  "Thomas","Charles","Christopher","Daniel","Matthew","Anthony","Mark",
  "Donald","Steven","Paul","Andrew","Joshua","Kenneth","Kevin","Brian",
  "George","Timothy","Ronald","Edward","Jason","Jeffrey","Ryan","Jacob",
  "Gary","Nicholas","Eric","Jonathan","Stephen","Larry","Justin","Scott",
  "Brandon","Benjamin","Samuel","Raymond","Gregory","Frank","Alexander",
  "Patrick","Jack","Dennis","Jerry","Tyler","Aaron","Jose","Adam",
];

const FIRST_NAMES_F = [
  "Mary","Patricia","Jennifer","Linda","Barbara","Elizabeth","Susan",
  "Jessica","Sarah","Karen","Lisa","Nancy","Betty","Margaret","Sandra",
  "Ashley","Dorothy","Kimberly","Emily","Donna","Michelle","Carol",
  "Amanda","Melissa","Deborah","Stephanie","Rebecca","Sharon","Laura",
  "Cynthia","Kathleen","Amy","Angela","Shirley","Anna","Brenda","Pamela",
  "Emma","Nicole","Helen","Samantha","Katherine","Christine","Debra",
  "Rachel","Carolyn","Janet","Catherine","Maria","Heather","Diane",
];

const LAST_NAMES = [
  "Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis",
  "Rodriguez","Martinez","Hernandez","Lopez","Gonzalez","Wilson","Anderson",
  "Thomas","Taylor","Moore","Jackson","Martin","Lee","Perez","Thompson",
  "White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson","Walker",
  "Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores",
  "Green","Adams","Nelson","Baker","Hall","Rivera","Campbell","Mitchell",
  "Carter","Roberts","Sullivan","Murphy","Collins","Stewart","Morris",
  "Reed","Cook","Morgan","Bell","Bailey","Cooper","Richardson","Cox",
  "Howard","Ward","Brooks","Watson","Sanders","Price","Bennett","Wood",
];

const EVALUATOR_NAMES = [
  "Dr. Susan Miller, CRC, CVE",
  "Dr. Robert Chen, Ph.D., CVE",
  "Dr. Patricia Romero, CRC",
  "James Mitchell, M.S., CRC, CVE",
  "Dr. Karen Washington, CVE, CDMS",
  "Dr. Thomas Park, CRC, CLCP",
  "Angela Fitzgerald, M.Ed., CRC",
  "Dr. David Nakamura, CVE",
  "Dr. Laura Schmidt, CRC, CCM",
  "Michael Okafor, M.S., CVE",
];

const REFERRAL_SOURCES = [
  "Attorney Smith & Associates",
  "Law Offices of Johnson & Cooper",
  "Rivera Legal Group",
  "Williams & Thompson, P.A.",
  "State Workers' Compensation Board",
  "SSA Disability Determination Services",
  "Anderson Insurance Group",
  "Collins & Reed, Attorneys at Law",
  "Liberty Mutual Claims Division",
  "Hartford Insurance Group",
  "Plaintiffs Counsel - Brooks Law",
  "Defense Counsel - Ward & Price",
  "Nelson & Bailey, P.C.",
  "Bennett Law Firm",
  "Stewart & Associates",
];

// ─── Occupation Database ───────────────────────────────────────────────

interface OccupationDef {
  title: string;
  onet: string;
  svp: number;
  strength: string; // S L M H V
  /** Pre-injury trait profile (all 24 traits at normal levels for this work) */
  preTraits: number[];
  /** Typical acquired skills for this occupation */
  skills: Array<{ verb: string; object: string; context: string; tools?: string; materials?: string }>;
  typicalEarnings: [number, number]; // range [min, max]
  industry: string;
}

// 50 diverse occupations spanning all industries and physical demands
const OCCUPATIONS: OccupationDef[] = [
  // ── CONSTRUCTION / TRADES ──
  {
    title: "Carpenter",
    onet: "47-2031.00",
    svp: 7, strength: "M",
    preTraits: [3,2,3,3,3,2, 3,3,3,2,2, 2,3,3,3,3,3, 2,1,1,1,2,2,2],
    skills: [
      { verb: "Construct", object: "wooden frameworks", context: "residential building projects", tools: "power saws, nail guns, levels" },
      { verb: "Read", object: "blueprints and specifications", context: "commercial construction", tools: "measuring tape, architect's scale" },
      { verb: "Install", object: "doors, windows, and trim", context: "finish carpentry", tools: "router, miter saw, chisels" },
    ],
    typicalEarnings: [38000, 65000],
    industry: "Construction",
  },
  {
    title: "Electrician",
    onet: "47-2111.00",
    svp: 7, strength: "M",
    preTraits: [4,3,3,3,3,3, 3,4,3,2,3, 2,3,2,3,3,4, 2,1,1,1,2,3,1],
    skills: [
      { verb: "Install", object: "electrical wiring systems", context: "new construction", tools: "wire strippers, multimeter, conduit benders" },
      { verb: "Diagnose", object: "electrical faults", context: "troubleshooting service calls", tools: "voltage tester, oscilloscope" },
      { verb: "Read", object: "electrical schematics", context: "industrial control systems", tools: "AutoCAD, blueprints" },
    ],
    typicalEarnings: [45000, 78000],
    industry: "Construction",
  },
  {
    title: "Plumber",
    onet: "47-2152.00",
    svp: 7, strength: "H",
    preTraits: [3,2,3,3,3,2, 3,3,3,2,2, 3,3,3,3,3,3, 2,1,1,2,2,2,1],
    skills: [
      { verb: "Install", object: "pipe systems and fixtures", context: "residential plumbing", tools: "pipe wrenches, soldering torch, PVC cutters" },
      { verb: "Repair", object: "water and drainage systems", context: "emergency service calls", tools: "drain snake, pipe camera" },
    ],
    typicalEarnings: [42000, 72000],
    industry: "Construction",
  },
  {
    title: "Construction Laborer",
    onet: "47-2061.00",
    svp: 3, strength: "V",
    preTraits: [2,1,2,2,2,1, 2,2,2,2,1, 4,3,3,3,2,3, 3,2,2,2,3,3,3],
    skills: [
      { verb: "Operate", object: "hand and power tools", context: "site preparation", tools: "jackhammer, wheelbarrow, shovel" },
      { verb: "Load", object: "construction materials", context: "material handling", tools: "hand truck, pallet jack" },
    ],
    typicalEarnings: [28000, 45000],
    industry: "Construction",
  },
  {
    title: "Heavy Equipment Operator",
    onet: "47-2073.00",
    svp: 5, strength: "M",
    preTraits: [3,2,2,3,3,2, 3,2,3,3,2, 2,2,2,3,3,4, 3,1,1,1,3,3,3],
    skills: [
      { verb: "Operate", object: "excavators and bulldozers", context: "site grading and excavation", tools: "CAT excavator, GPS grading system" },
      { verb: "Perform", object: "daily equipment inspections", context: "preventive maintenance", tools: "grease gun, fluid gauges" },
    ],
    typicalEarnings: [38000, 62000],
    industry: "Construction",
  },
  // ── HEALTHCARE ──
  {
    title: "Registered Nurse",
    onet: "29-1141.00",
    svp: 7, strength: "M",
    preTraits: [4,3,4,2,3,3, 3,3,3,2,2, 2,2,2,3,4,4, 2,1,1,1,2,2,1],
    skills: [
      { verb: "Administer", object: "medications and treatments", context: "acute care nursing", tools: "IV pumps, electronic health records" },
      { verb: "Assess", object: "patient health status", context: "clinical evaluation", tools: "stethoscope, blood pressure cuff, pulse oximeter" },
      { verb: "Document", object: "patient care records", context: "HIPAA-compliant charting", tools: "Epic EMR, Cerner" },
    ],
    typicalEarnings: [55000, 95000],
    industry: "Healthcare",
  },
  {
    title: "Certified Nursing Assistant",
    onet: "31-1131.00",
    svp: 4, strength: "M",
    preTraits: [2,2,3,1,2,2, 2,2,2,2,1, 2,2,2,3,3,3, 2,1,1,1,1,1,1],
    skills: [
      { verb: "Assist", object: "patients with daily living activities", context: "long-term care facility", tools: "Hoyer lift, gait belt" },
      { verb: "Monitor", object: "vital signs", context: "routine patient assessment", tools: "blood pressure cuff, thermometer" },
    ],
    typicalEarnings: [25000, 38000],
    industry: "Healthcare",
  },
  {
    title: "Medical Assistant",
    onet: "31-9092.00",
    svp: 5, strength: "L",
    preTraits: [3,2,3,2,3,3, 3,3,3,2,2, 1,1,2,3,4,3, 1,1,1,1,1,1,1],
    skills: [
      { verb: "Perform", object: "phlebotomy and specimen collection", context: "outpatient clinic", tools: "vacutainer, centrifuge" },
      { verb: "Schedule", object: "patient appointments", context: "multi-provider practice", tools: "EHR scheduling module, multi-line phone" },
    ],
    typicalEarnings: [30000, 42000],
    industry: "Healthcare",
  },
  {
    title: "Physical Therapy Assistant",
    onet: "31-2021.00",
    svp: 6, strength: "M",
    preTraits: [3,2,3,2,3,2, 3,3,3,3,2, 2,2,2,3,4,3, 1,1,1,1,1,1,1],
    skills: [
      { verb: "Guide", object: "patients through therapeutic exercises", context: "outpatient rehabilitation", tools: "resistance bands, parallel bars, ultrasound" },
      { verb: "Apply", object: "modalities and manual techniques", context: "post-surgical recovery", tools: "electrical stimulation, hot/cold packs" },
    ],
    typicalEarnings: [40000, 62000],
    industry: "Healthcare",
  },
  // ── OFFICE / ADMINISTRATIVE ──
  {
    title: "Administrative Assistant",
    onet: "43-6014.00",
    svp: 5, strength: "S",
    preTraits: [3,2,3,2,3,4, 3,3,2,1,1, 0,1,1,3,3,3, 1,0,0,0,1,0,0],
    skills: [
      { verb: "Manage", object: "executive calendars and correspondence", context: "corporate office setting", tools: "Microsoft Outlook, Word, Excel" },
      { verb: "Coordinate", object: "travel arrangements and meetings", context: "multi-department scheduling", tools: "Concur, WebEx, Teams" },
      { verb: "Prepare", object: "reports and presentations", context: "quarterly business reviews", tools: "PowerPoint, Excel pivot tables" },
    ],
    typicalEarnings: [32000, 52000],
    industry: "Office/Administrative",
  },
  {
    title: "Bookkeeper",
    onet: "43-3031.00",
    svp: 5, strength: "S",
    preTraits: [3,4,3,2,3,4, 3,3,2,1,1, 0,1,1,3,3,3, 1,0,0,0,1,0,0],
    skills: [
      { verb: "Maintain", object: "general ledger accounts", context: "monthly close process", tools: "QuickBooks, Sage" },
      { verb: "Reconcile", object: "bank statements and accounts", context: "financial reporting", tools: "Excel, accounting software" },
      { verb: "Process", object: "accounts payable and receivable", context: "vendor payment cycles", tools: "QuickBooks, ACH systems" },
    ],
    typicalEarnings: [35000, 52000],
    industry: "Finance/Accounting",
  },
  {
    title: "Customer Service Representative",
    onet: "43-4051.00",
    svp: 4, strength: "S",
    preTraits: [3,2,3,1,2,3, 2,3,2,1,1, 0,1,1,3,4,3, 1,0,0,0,2,0,0],
    skills: [
      { verb: "Resolve", object: "customer complaints and inquiries", context: "inbound call center", tools: "CRM software, multi-line phone" },
      { verb: "Process", object: "orders and returns", context: "e-commerce support", tools: "Salesforce, Zendesk" },
    ],
    typicalEarnings: [28000, 42000],
    industry: "Customer Service",
  },
  {
    title: "Data Entry Clerk",
    onet: "43-9021.00",
    svp: 3, strength: "S",
    preTraits: [2,2,2,1,2,4, 2,4,2,1,1, 0,1,1,3,2,3, 1,0,0,0,1,0,0],
    skills: [
      { verb: "Enter", object: "alphanumeric data into databases", context: "high-volume processing", tools: "database software, 10-key pad" },
      { verb: "Verify", object: "data accuracy", context: "quality control review", tools: "spreadsheet software" },
    ],
    typicalEarnings: [26000, 38000],
    industry: "Office/Administrative",
  },
  {
    title: "Receptionist",
    onet: "43-4171.00",
    svp: 4, strength: "S",
    preTraits: [2,2,3,1,2,3, 2,3,2,1,1, 0,1,1,3,4,3, 1,0,0,0,1,0,0],
    skills: [
      { verb: "Greet", object: "visitors and direct calls", context: "front desk operations", tools: "multi-line phone, visitor log system" },
      { verb: "Schedule", object: "appointments", context: "busy professional office", tools: "Outlook calendar, scheduling software" },
    ],
    typicalEarnings: [25000, 36000],
    industry: "Office/Administrative",
  },
  // ── MANUFACTURING ──
  {
    title: "Machine Operator",
    onet: "51-9199.00",
    svp: 4, strength: "M",
    preTraits: [2,2,2,2,3,2, 3,3,3,2,2, 2,2,2,3,3,3, 2,1,1,1,3,2,2],
    skills: [
      { verb: "Operate", object: "CNC and manual machines", context: "production manufacturing", tools: "CNC lathe, milling machine, calipers" },
      { verb: "Inspect", object: "machined parts for defects", context: "quality assurance", tools: "micrometers, dial indicators, go/no-go gauges" },
    ],
    typicalEarnings: [30000, 48000],
    industry: "Manufacturing",
  },
  {
    title: "Welder",
    onet: "51-4121.00",
    svp: 6, strength: "M",
    preTraits: [3,2,2,3,3,2, 3,3,3,3,2, 2,2,2,3,2,4, 2,1,2,1,3,3,3],
    skills: [
      { verb: "Weld", object: "metal components using MIG/TIG processes", context: "structural fabrication", tools: "MIG welder, TIG welder, plasma cutter" },
      { verb: "Read", object: "welding blueprints and symbols", context: "certified weld procedures", tools: "AWS welding codes, weld gauges" },
    ],
    typicalEarnings: [35000, 60000],
    industry: "Manufacturing",
  },
  {
    title: "Assembler",
    onet: "51-2098.00",
    svp: 3, strength: "L",
    preTraits: [2,1,2,2,3,2, 3,3,3,2,2, 1,1,2,3,2,3, 2,1,1,1,2,1,1],
    skills: [
      { verb: "Assemble", object: "electronic components", context: "production line", tools: "soldering iron, hand tools, torque wrench" },
      { verb: "Follow", object: "assembly instructions", context: "standardized work procedures", tools: "work instructions, assembly fixtures" },
    ],
    typicalEarnings: [26000, 40000],
    industry: "Manufacturing",
  },
  {
    title: "Quality Control Inspector",
    onet: "51-9061.00",
    svp: 5, strength: "L",
    preTraits: [3,3,3,3,4,3, 3,3,3,2,3, 1,1,2,3,3,4, 2,1,1,1,2,1,1],
    skills: [
      { verb: "Inspect", object: "finished products against specifications", context: "statistical process control", tools: "CMM, optical comparator, calipers" },
      { verb: "Document", object: "quality deviations", context: "corrective action process", tools: "SAP QM module, inspection reports" },
    ],
    typicalEarnings: [35000, 55000],
    industry: "Manufacturing",
  },
  {
    title: "Maintenance Mechanic",
    onet: "49-9071.00",
    svp: 6, strength: "H",
    preTraits: [3,2,2,3,3,2, 3,3,3,3,2, 3,3,3,3,3,3, 2,1,2,1,3,3,2],
    skills: [
      { verb: "Troubleshoot", object: "mechanical breakdowns", context: "industrial plant maintenance", tools: "multimeter, hydraulic press, bearing puller" },
      { verb: "Perform", object: "preventive maintenance", context: "scheduled PM program", tools: "CMMS software, hand/power tools" },
      { verb: "Repair", object: "conveyor systems and motors", context: "minimizing production downtime", tools: "welding equipment, alignment tools" },
    ],
    typicalEarnings: [40000, 65000],
    industry: "Manufacturing",
  },
  // ── FOOD SERVICE ──
  {
    title: "Cook, Restaurant",
    onet: "35-2014.00",
    svp: 5, strength: "M",
    preTraits: [2,2,2,2,3,2, 3,3,3,2,2, 2,2,2,3,3,3, 2,1,2,2,2,2,1],
    skills: [
      { verb: "Prepare", object: "menu items to specification", context: "high-volume restaurant kitchen", tools: "commercial ovens, grills, knives" },
      { verb: "Manage", object: "food inventory and ordering", context: "kitchen management", tools: "POS system, inventory software" },
    ],
    typicalEarnings: [25000, 42000],
    industry: "Food Service",
  },
  {
    title: "Server / Waitstaff",
    onet: "35-3031.00",
    svp: 3, strength: "L",
    preTraits: [2,2,3,1,2,2, 2,3,2,2,1, 1,1,1,3,4,3, 1,0,0,0,2,0,0],
    skills: [
      { verb: "Take", object: "customer food and beverage orders", context: "fine dining service", tools: "POS terminal, handheld order device" },
      { verb: "Deliver", object: "food orders to tables", context: "multi-table section management", tools: "serving trays" },
    ],
    typicalEarnings: [22000, 38000],
    industry: "Food Service",
  },
  // ── TRANSPORTATION / LOGISTICS ──
  {
    title: "Truck Driver, Heavy",
    onet: "53-3032.00",
    svp: 4, strength: "M",
    preTraits: [2,2,2,3,3,2, 3,2,2,3,2, 2,2,2,3,3,4, 3,1,1,1,3,2,2],
    skills: [
      { verb: "Operate", object: "Class A commercial vehicles", context: "long-haul freight transport", tools: "tractor-trailer, GPS navigation, ELD" },
      { verb: "Inspect", object: "vehicle safety components", context: "DOT pre-trip inspection", tools: "tire gauge, inspection checklist" },
    ],
    typicalEarnings: [38000, 65000],
    industry: "Transportation",
  },
  {
    title: "Warehouse Worker",
    onet: "53-7062.00",
    svp: 3, strength: "H",
    preTraits: [2,1,2,2,2,2, 2,2,3,2,1, 3,3,3,3,2,3, 2,1,1,1,2,2,2],
    skills: [
      { verb: "Pick", object: "orders using RF scanner", context: "distribution center operations", tools: "RF scanner, pallet jack, forklift" },
      { verb: "Load", object: "pallets onto trucks", context: "shipping dock operations", tools: "forklift, stretch wrap machine" },
    ],
    typicalEarnings: [28000, 42000],
    industry: "Logistics/Warehousing",
  },
  {
    title: "Delivery Driver",
    onet: "53-3031.00",
    svp: 3, strength: "M",
    preTraits: [2,2,2,2,2,2, 2,2,3,3,2, 2,2,2,3,3,4, 2,1,1,1,2,1,1],
    skills: [
      { verb: "Deliver", object: "packages to residential addresses", context: "route-based delivery", tools: "delivery van, handheld scanner, GPS" },
      { verb: "Load", object: "vehicle with sorted packages", context: "morning dispatch operations", tools: "hand truck, cargo straps" },
    ],
    typicalEarnings: [30000, 48000],
    industry: "Transportation",
  },
  {
    title: "Forklift Operator",
    onet: "53-7051.00",
    svp: 3, strength: "M",
    preTraits: [2,1,2,3,3,2, 3,2,3,3,2, 2,2,2,3,2,3, 2,1,1,1,2,2,2],
    skills: [
      { verb: "Operate", object: "sit-down and stand-up forklifts", context: "warehouse material handling", tools: "forklift, pallet racking system" },
      { verb: "Maintain", object: "inventory placement accuracy", context: "warehouse management", tools: "WMS system, RF scanner" },
    ],
    typicalEarnings: [30000, 44000],
    industry: "Logistics/Warehousing",
  },
  // ── IT / TECHNOLOGY ──
  {
    title: "Software Developer",
    onet: "15-1252.00",
    svp: 8, strength: "S",
    preTraits: [4,4,4,3,3,3, 3,4,2,1,1, 0,1,1,3,3,4, 1,0,0,0,1,0,0],
    skills: [
      { verb: "Develop", object: "software applications", context: "agile development team", tools: "VS Code, Git, Docker, AWS" },
      { verb: "Debug", object: "code defects", context: "production incident response", tools: "debuggers, log analysis tools" },
      { verb: "Design", object: "database schemas", context: "system architecture", tools: "PostgreSQL, MongoDB, ERD tools" },
    ],
    typicalEarnings: [70000, 130000],
    industry: "Technology",
  },
  {
    title: "IT Support Specialist",
    onet: "15-1232.00",
    svp: 5, strength: "L",
    preTraits: [3,3,3,2,3,3, 3,3,3,2,2, 1,1,1,3,4,3, 1,0,0,0,1,0,0],
    skills: [
      { verb: "Troubleshoot", object: "hardware and software issues", context: "help desk support", tools: "Active Directory, remote desktop, ticketing system" },
      { verb: "Install", object: "computer systems and peripherals", context: "desktop deployment", tools: "imaging software, network cables" },
    ],
    typicalEarnings: [35000, 58000],
    industry: "Technology",
  },
  {
    title: "Network Administrator",
    onet: "15-1244.00",
    svp: 7, strength: "L",
    preTraits: [4,3,3,3,3,3, 3,3,3,2,2, 1,1,1,3,4,4, 1,0,0,0,1,0,0],
    skills: [
      { verb: "Configure", object: "network switches and routers", context: "enterprise network management", tools: "Cisco IOS, Wireshark, SolarWinds" },
      { verb: "Monitor", object: "network performance", context: "24/7 uptime requirements", tools: "Nagios, SNMP, packet analyzers" },
    ],
    typicalEarnings: [55000, 90000],
    industry: "Technology",
  },
  // ── RETAIL ──
  {
    title: "Retail Sales Associate",
    onet: "41-2031.00",
    svp: 3, strength: "L",
    preTraits: [2,2,3,1,2,2, 2,3,2,2,1, 1,1,1,3,4,3, 1,0,0,0,1,0,0],
    skills: [
      { verb: "Assist", object: "customers with product selection", context: "retail floor sales", tools: "POS system, product catalog" },
      { verb: "Process", object: "sales transactions", context: "checkout operations", tools: "cash register, credit card terminal" },
    ],
    typicalEarnings: [22000, 35000],
    industry: "Retail",
  },
  {
    title: "Store Manager",
    onet: "41-1011.00",
    svp: 7, strength: "L",
    preTraits: [3,3,4,2,3,3, 3,3,2,2,1, 1,1,1,3,4,3, 1,0,0,0,1,0,0],
    skills: [
      { verb: "Manage", object: "store operations and staff", context: "multi-department retail management", tools: "POS system, scheduling software, P&L reports" },
      { verb: "Analyze", object: "sales metrics and inventory", context: "monthly business reviews", tools: "Excel, retail analytics software" },
      { verb: "Train", object: "new employees", context: "onboarding program", tools: "training manuals, e-learning platform" },
    ],
    typicalEarnings: [38000, 62000],
    industry: "Retail",
  },
  {
    title: "Cashier",
    onet: "41-2011.00",
    svp: 2, strength: "L",
    preTraits: [2,2,2,1,2,3, 2,3,2,1,1, 1,1,1,3,3,3, 1,0,0,0,1,0,0],
    skills: [
      { verb: "Process", object: "customer transactions", context: "high-volume checkout", tools: "barcode scanner, cash register" },
    ],
    typicalEarnings: [20000, 30000],
    industry: "Retail",
  },
  // ── SKILLED TRADES ──
  {
    title: "Auto Mechanic",
    onet: "49-3023.00",
    svp: 6, strength: "M",
    preTraits: [3,2,2,3,3,2, 3,3,3,3,2, 2,2,3,3,3,4, 2,1,1,1,2,2,2],
    skills: [
      { verb: "Diagnose", object: "engine and transmission problems", context: "automotive repair shop", tools: "OBD-II scanner, oscilloscope, compression tester" },
      { verb: "Repair", object: "brake systems", context: "safety-critical service", tools: "brake lathe, hydraulic lift, torque wrench" },
      { verb: "Perform", object: "routine maintenance services", context: "manufacturer-scheduled service", tools: "oil drain, tire changer, alignment machine" },
    ],
    typicalEarnings: [35000, 58000],
    industry: "Automotive",
  },
  {
    title: "HVAC Technician",
    onet: "49-9021.00",
    svp: 6, strength: "M",
    preTraits: [3,3,3,3,3,2, 3,3,3,3,2, 2,3,2,3,3,3, 2,2,2,1,2,2,2],
    skills: [
      { verb: "Install", object: "heating and cooling systems", context: "residential and commercial HVAC", tools: "refrigerant gauges, recovery machine, brazers" },
      { verb: "Diagnose", object: "HVAC system malfunctions", context: "service troubleshooting", tools: "multimeter, manometer, thermostat tools" },
    ],
    typicalEarnings: [38000, 65000],
    industry: "HVAC/Mechanical",
  },
  // ── PROFESSIONAL / MANAGEMENT ──
  {
    title: "Accountant",
    onet: "13-2011.00",
    svp: 7, strength: "S",
    preTraits: [4,4,4,2,3,4, 3,3,2,1,1, 0,1,1,3,3,3, 1,0,0,0,1,0,0],
    skills: [
      { verb: "Prepare", object: "financial statements and tax returns", context: "CPA firm practice", tools: "QuickBooks, Lacerte, Excel" },
      { verb: "Audit", object: "client financial records", context: "annual audit engagement", tools: "audit software, GAAP standards" },
      { verb: "Analyze", object: "financial performance metrics", context: "management reporting", tools: "Excel, Tableau, SAP" },
    ],
    typicalEarnings: [52000, 85000],
    industry: "Finance/Accounting",
  },
  {
    title: "Human Resources Specialist",
    onet: "13-1071.00",
    svp: 6, strength: "S",
    preTraits: [4,3,4,2,3,3, 3,3,2,1,1, 0,1,1,3,4,3, 1,0,0,0,1,0,0],
    skills: [
      { verb: "Conduct", object: "employee interviews and screenings", context: "talent acquisition", tools: "ATS software, LinkedIn Recruiter" },
      { verb: "Administer", object: "benefits and compensation programs", context: "HR operations", tools: "HRIS, payroll software" },
    ],
    typicalEarnings: [45000, 72000],
    industry: "Human Resources",
  },
  {
    title: "Project Manager",
    onet: "11-9199.00",
    svp: 7, strength: "S",
    preTraits: [4,3,4,2,3,3, 3,3,2,1,1, 0,1,1,3,4,3, 1,0,0,0,1,0,0],
    skills: [
      { verb: "Plan", object: "project schedules and budgets", context: "multi-stakeholder projects", tools: "MS Project, Jira, Smartsheet" },
      { verb: "Lead", object: "cross-functional teams", context: "agile/waterfall methodologies", tools: "Confluence, Teams, Slack" },
      { verb: "Report", object: "project status to stakeholders", context: "executive steering committees", tools: "PowerPoint, dashboards" },
    ],
    typicalEarnings: [60000, 100000],
    industry: "Management",
  },
  // ── EDUCATION ──
  {
    title: "Teacher, Elementary",
    onet: "25-2021.00",
    svp: 7, strength: "L",
    preTraits: [4,3,4,2,3,3, 3,3,2,2,2, 1,1,1,3,4,3, 1,0,0,0,2,0,0],
    skills: [
      { verb: "Develop", object: "lesson plans and curriculum", context: "state standards alignment", tools: "Google Classroom, SmartBoard" },
      { verb: "Assess", object: "student performance", context: "formative and summative evaluation", tools: "assessment rubrics, grading software" },
    ],
    typicalEarnings: [38000, 65000],
    industry: "Education",
  },
  {
    title: "Teacher's Aide",
    onet: "25-9042.00",
    svp: 4, strength: "L",
    preTraits: [3,2,3,2,2,2, 2,2,2,2,1, 1,1,1,3,4,3, 1,0,0,0,1,0,0],
    skills: [
      { verb: "Support", object: "classroom instruction", context: "K-12 educational setting", tools: "educational software, laminator" },
      { verb: "Supervise", object: "students during activities", context: "recess and lunch periods", tools: "walkie-talkie" },
    ],
    typicalEarnings: [22000, 32000],
    industry: "Education",
  },
  // ── SECURITY / PROTECTIVE ──
  {
    title: "Security Guard",
    onet: "33-9032.00",
    svp: 3, strength: "L",
    preTraits: [2,2,3,2,2,2, 2,2,2,2,2, 1,2,1,3,4,4, 2,1,1,1,2,1,0],
    skills: [
      { verb: "Monitor", object: "security cameras and access points", context: "building security", tools: "CCTV system, access control panel" },
      { verb: "Patrol", object: "assigned areas", context: "facility protection", tools: "radio, flashlight, incident report forms" },
    ],
    typicalEarnings: [26000, 40000],
    industry: "Security",
  },
  // ── AGRICULTURE / LANDSCAPING ──
  {
    title: "Landscaper",
    onet: "37-3011.00",
    svp: 3, strength: "H",
    preTraits: [2,1,2,2,2,1, 2,2,3,2,2, 3,3,3,3,2,3, 3,2,2,2,2,2,2],
    skills: [
      { verb: "Maintain", object: "lawns and garden beds", context: "commercial landscaping", tools: "mower, trimmer, blower, edger" },
      { verb: "Install", object: "irrigation systems", context: "landscape installation", tools: "trencher, PVC fittings, sprinkler heads" },
    ],
    typicalEarnings: [25000, 40000],
    industry: "Landscaping",
  },
  // ── CLEANING / JANITORIAL ──
  {
    title: "Janitor / Custodian",
    onet: "37-2011.00",
    svp: 2, strength: "M",
    preTraits: [1,1,2,1,2,1, 2,2,2,2,1, 2,2,2,3,2,3, 2,1,1,1,1,1,2],
    skills: [
      { verb: "Clean", object: "building interiors", context: "commercial janitorial service", tools: "floor buffer, vacuum, chemical dispensers" },
      { verb: "Maintain", object: "supply inventory", context: "facility management", tools: "supply closet, order forms" },
    ],
    typicalEarnings: [22000, 35000],
    industry: "Facility Services",
  },
  // ── LEGAL ──
  {
    title: "Paralegal",
    onet: "23-2011.00",
    svp: 6, strength: "S",
    preTraits: [4,3,4,2,3,4, 3,3,2,1,1, 0,1,1,3,3,3, 1,0,0,0,1,0,0],
    skills: [
      { verb: "Research", object: "legal precedents and statutes", context: "litigation support", tools: "Westlaw, LexisNexis" },
      { verb: "Draft", object: "legal documents and pleadings", context: "civil litigation", tools: "Word, legal templates, e-filing systems" },
      { verb: "Organize", object: "case files and discovery materials", context: "trial preparation", tools: "document management system" },
    ],
    typicalEarnings: [40000, 62000],
    industry: "Legal",
  },
  // ── FINANCIAL ──
  {
    title: "Bank Teller",
    onet: "43-3071.00",
    svp: 4, strength: "S",
    preTraits: [3,3,3,1,3,4, 3,3,2,1,1, 0,1,1,3,4,3, 1,0,0,0,1,0,0],
    skills: [
      { verb: "Process", object: "deposits and withdrawals", context: "retail banking", tools: "currency counter, teller system, check scanner" },
      { verb: "Balance", object: "cash drawer", context: "end-of-day reconciliation", tools: "teller terminal" },
    ],
    typicalEarnings: [28000, 38000],
    industry: "Finance/Banking",
  },
  // ── PERSONAL CARE ──
  {
    title: "Hairdresser / Cosmetologist",
    onet: "39-5012.00",
    svp: 5, strength: "L",
    preTraits: [2,2,3,2,3,2, 3,4,3,2,3, 1,1,1,3,4,4, 1,0,0,0,1,0,1],
    skills: [
      { verb: "Style", object: "hair using cutting and coloring techniques", context: "salon services", tools: "shears, blow dryer, color brushes, flat iron" },
      { verb: "Consult", object: "with clients on desired looks", context: "customer service", tools: "style books, consultation forms" },
    ],
    typicalEarnings: [24000, 42000],
    industry: "Personal Care",
  },
  // ── AUTOMOTIVE ──
  {
    title: "Auto Body Repairer",
    onet: "49-3021.00",
    svp: 6, strength: "M",
    preTraits: [3,2,2,3,3,2, 3,3,3,3,3, 2,2,2,3,2,4, 2,1,1,1,2,2,3],
    skills: [
      { verb: "Repair", object: "collision damage on vehicles", context: "auto body shop", tools: "frame straightener, MIG welder, body filler" },
      { verb: "Match", object: "paint colors", context: "refinishing", tools: "paint mixing system, spray gun, paint booth" },
    ],
    typicalEarnings: [32000, 55000],
    industry: "Automotive",
  },
  // ── SOCIAL SERVICES ──
  {
    title: "Social Worker",
    onet: "21-1021.00",
    svp: 7, strength: "L",
    preTraits: [4,3,4,2,3,3, 2,3,2,1,1, 1,1,1,3,4,3, 2,0,0,0,1,0,0],
    skills: [
      { verb: "Assess", object: "client needs and develop service plans", context: "case management", tools: "assessment tools, EHR, DSM-5" },
      { verb: "Coordinate", object: "community resources", context: "client advocacy", tools: "referral databases, case management software" },
    ],
    typicalEarnings: [38000, 58000],
    industry: "Social Services",
  },
];

// ─── Injury Types ──────────────────────────────────────────────────────

interface InjuryPattern {
  name: string;
  description: string;
  /** Which trait indices (0-23) are affected, and by how much they drop (negative) */
  traitDeltas: Array<{ idx: number; drop: number }>;
  /** What strength ceiling after injury: 0=S, 1=L, 2=M */
  maxStrength: number;
}

const INJURIES: InjuryPattern[] = [
  {
    name: "Lumbar disc herniation",
    description: "L4-L5 disc herniation with radiculopathy, status post discectomy",
    traitDeltas: [
      { idx: 11, drop: -2 }, // strength
      { idx: 12, drop: -2 }, // climbBalance
      { idx: 13, drop: -2 }, // stoopKneel
      { idx: 14, drop: -1 }, // reachHandle
    ],
    maxStrength: 1,
  },
  {
    name: "Cervical spine injury",
    description: "C5-C6 cervical disc disease with neck and upper extremity pain",
    traitDeltas: [
      { idx: 11, drop: -1 }, // strength
      { idx: 14, drop: -2 }, // reachHandle (overhead)
      { idx: 12, drop: -1 }, // climbBalance
    ],
    maxStrength: 1,
  },
  {
    name: "Rotator cuff tear",
    description: "Full-thickness rotator cuff tear, right dominant shoulder, post-surgical repair",
    traitDeltas: [
      { idx: 14, drop: -2 }, // reachHandle
      { idx: 11, drop: -1 }, // strength
      { idx: 12, drop: -1 }, // climbBalance
      { idx: 8, drop: -1 },  // manualDexterity
    ],
    maxStrength: 1,
  },
  {
    name: "Carpal tunnel syndrome bilateral",
    description: "Bilateral carpal tunnel syndrome with median nerve compression, post-release surgery",
    traitDeltas: [
      { idx: 7, drop: -2 },  // fingerDexterity
      { idx: 8, drop: -2 },  // manualDexterity
      { idx: 6, drop: -1 },  // motorCoordination
      { idx: 14, drop: -1 }, // reachHandle
    ],
    maxStrength: 1,
  },
  {
    name: "Knee injury, ACL/meniscus",
    description: "Right knee ACL tear with meniscus damage, post-reconstruction",
    traitDeltas: [
      { idx: 12, drop: -2 }, // climbBalance
      { idx: 13, drop: -2 }, // stoopKneel
      { idx: 11, drop: -1 }, // strength
      { idx: 9, drop: -1 },  // eyeHandFoot
    ],
    maxStrength: 1,
  },
  {
    name: "Hip fracture / replacement",
    description: "Left hip fracture status post total hip arthroplasty",
    traitDeltas: [
      { idx: 11, drop: -2 }, // strength
      { idx: 12, drop: -2 }, // climbBalance
      { idx: 13, drop: -2 }, // stoopKneel
    ],
    maxStrength: 0,
  },
  {
    name: "Traumatic brain injury (mild-moderate)",
    description: "Mild-to-moderate TBI with persistent cognitive deficits",
    traitDeltas: [
      { idx: 0, drop: -2 },  // reasoning
      { idx: 1, drop: -1 },  // math
      { idx: 2, drop: -1 },  // language
      { idx: 6, drop: -1 },  // motorCoordination
    ],
    maxStrength: 1,
  },
  {
    name: "Vision impairment",
    description: "Significant bilateral visual acuity loss, corrected to 20/70",
    traitDeltas: [
      { idx: 16, drop: -2 }, // see
      { idx: 10, drop: -2 }, // colorDiscrimination
      { idx: 3, drop: -1 },  // spatialPerception
      { idx: 4, drop: -1 },  // formPerception
    ],
    maxStrength: 1,
  },
  {
    name: "Hearing loss",
    description: "Bilateral sensorineural hearing loss, moderate-to-severe",
    traitDeltas: [
      { idx: 15, drop: -2 }, // talkHear
      { idx: 21, drop: -1 }, // noiseVibration
    ],
    maxStrength: 2,
  },
  {
    name: "PTSD and major depression",
    description: "Post-traumatic stress disorder with comorbid major depressive disorder",
    traitDeltas: [
      { idx: 0, drop: -1 },  // reasoning (concentration)
      { idx: 17, drop: -2 }, // workLocation (stress tolerance)
      { idx: 15, drop: -1 }, // talkHear (social interaction)
    ],
    maxStrength: 1,
  },
  {
    name: "Multiple fractures upper extremity",
    description: "Comminuted fractures of radius and ulna, dominant hand, with ORIF",
    traitDeltas: [
      { idx: 7, drop: -2 },  // fingerDexterity
      { idx: 8, drop: -2 },  // manualDexterity
      { idx: 14, drop: -2 }, // reachHandle
      { idx: 6, drop: -1 },  // motorCoordination
      { idx: 11, drop: -1 }, // strength
    ],
    maxStrength: 0,
  },
  {
    name: "Cardiac event",
    description: "Myocardial infarction with subsequent reduced ejection fraction and activity limitations",
    traitDeltas: [
      { idx: 11, drop: -2 }, // strength
      { idx: 12, drop: -2 }, // climbBalance
      { idx: 18, drop: -1 }, // extremeCold
      { idx: 19, drop: -1 }, // extremeHeat
    ],
    maxStrength: 0,
  },
  {
    name: "COPD / respiratory",
    description: "Chronic obstructive pulmonary disease, moderate stage",
    traitDeltas: [
      { idx: 11, drop: -1 }, // strength
      { idx: 12, drop: -1 }, // climbBalance
      { idx: 23, drop: -3 }, // dustsFumes
      { idx: 22, drop: -1 }, // hazards
    ],
    maxStrength: 1,
  },
  {
    name: "Lower back strain with chronic pain",
    description: "Chronic low back pain syndrome with functional limitations",
    traitDeltas: [
      { idx: 11, drop: -1 }, // strength
      { idx: 13, drop: -2 }, // stoopKneel
      { idx: 12, drop: -1 }, // climbBalance
    ],
    maxStrength: 1,
  },
  {
    name: "Ankle fracture with chronic instability",
    description: "Bimalleolar ankle fracture with residual chronic instability",
    traitDeltas: [
      { idx: 12, drop: -2 }, // climbBalance
      { idx: 9, drop: -1 },  // eyeHandFoot
      { idx: 11, drop: -1 }, // strength
    ],
    maxStrength: 1,
  },
];

// ─── Helper Functions ──────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randDate(startYear: number, endYear: number): Date {
  const start = new Date(startYear, 0, 1).getTime();
  const end = new Date(endYear, 11, 31).getTime();
  return new Date(start + Math.random() * (end - start));
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

const TRAIT_KEYS = [
  "reasoning","math","language","spatialPerception","formPerception","clericalPerception",
  "motorCoordination","fingerDexterity","manualDexterity","eyeHandFoot","colorDiscrimination",
  "strength","climbBalance","stoopKneel","reachHandle","talkHear","see",
  "workLocation","extremeCold","extremeHeat","wetnessHumidity","noiseVibration","hazards","dustsFumes",
] as const;

function traitsToRecord(traits: number[]): Record<string, number | null> {
  const record: Record<string, number | null> = {};
  for (let i = 0; i < TRAIT_KEYS.length; i++) {
    record[TRAIT_KEYS[i]] = traits[i] ?? null;
  }
  return record;
}

/** Apply injury deltas to a pre-injury profile to create a post-injury profile */
function applyInjury(pre: number[], injury: InjuryPattern, severity: number): number[] {
  const post = [...pre];
  for (const delta of injury.traitDeltas) {
    const drop = Math.round(delta.drop * severity);
    post[delta.idx] = clamp(post[delta.idx] + drop, 0, 4);
  }
  // Cap strength based on injury maxStrength
  post[11] = Math.min(post[11], injury.maxStrength);
  return post;
}

/** Generate typical target O*NET codes for a given source occupation category */
function getTargetONETCodes(sourceOcc: OccupationDef): string[] {
  // Pool of common target O*NET codes across transferability categories
  const COMMON_TARGETS: Record<string, string[]> = {
    "Construction": [
      "47-1011.00","47-2031.00","47-2061.00","47-2073.00","47-2111.00",
      "47-2152.00","47-2181.00","47-4011.00","47-4051.00","47-4071.00",
      "49-9071.00","51-4121.00","43-5071.00","43-9061.00","53-7062.00",
    ],
    "Healthcare": [
      "29-1141.00","29-2061.00","31-1131.00","31-2021.00","31-9092.00",
      "31-9097.00","29-2052.00","43-6013.00","43-4171.00","43-6014.00",
      "43-9061.00","29-9099.00","21-1093.00","39-9011.00","21-1094.00",
    ],
    "Office/Administrative": [
      "43-6014.00","43-3031.00","43-4051.00","43-9021.00","43-4171.00",
      "43-9061.00","43-3021.00","43-3051.00","43-4071.00","43-4131.00",
      "43-5071.00","43-9041.00","43-3071.00","43-4041.00","43-9022.00",
    ],
    "Finance/Accounting": [
      "13-2011.00","43-3031.00","43-3021.00","43-3051.00","43-3071.00",
      "43-4041.00","43-4011.00","43-4131.00","43-4141.00","43-9061.00",
      "13-2082.00","13-1199.00","43-9041.00","43-6014.00","43-4051.00",
    ],
    "Manufacturing": [
      "51-9199.00","51-4121.00","51-2098.00","51-9061.00","51-1011.00",
      "49-9071.00","53-7062.00","43-5071.00","43-5061.00","43-9061.00",
      "51-4041.00","51-7041.00","53-7051.00","17-3026.00","51-9198.00",
    ],
    "Food Service": [
      "35-2014.00","35-3031.00","35-1012.00","35-2021.00","35-9011.00",
      "35-9031.00","41-2011.00","41-2021.00","43-4051.00","43-9061.00",
      "53-7062.00","37-2011.00","43-4171.00","35-3023.00","35-2015.00",
    ],
    "Transportation": [
      "53-3032.00","53-3031.00","53-7062.00","53-7051.00","53-3033.00",
      "43-5071.00","43-5061.00","43-9061.00","53-1042.00","53-6031.00",
      "49-3031.00","49-3023.00","43-5011.00","53-7064.00","53-3058.00",
    ],
    "Logistics/Warehousing": [
      "53-7062.00","53-7051.00","43-5071.00","43-5061.00","43-9061.00",
      "53-1042.00","43-5011.00","53-7064.00","41-2031.00","43-4051.00",
      "43-3031.00","53-3031.00","53-3032.00","51-9199.00","37-2011.00",
    ],
    "Technology": [
      "15-1252.00","15-1232.00","15-1244.00","15-1256.00","15-1299.00",
      "15-2051.00","15-1231.00","15-1211.00","43-9011.00","43-9061.00",
      "43-6014.00","13-1199.00","13-1161.00","11-3021.00","43-4051.00",
    ],
    "Retail": [
      "41-2031.00","41-2011.00","41-1011.00","41-2021.00","43-4051.00",
      "43-4171.00","43-9061.00","43-5071.00","53-7062.00","41-3091.00",
      "41-9022.00","41-3021.00","43-3071.00","37-2011.00","43-9021.00",
    ],
    "Automotive": [
      "49-3023.00","49-3021.00","49-3031.00","49-9071.00","49-2022.00",
      "41-2031.00","43-4051.00","43-9061.00","43-5071.00","53-7062.00",
      "51-4121.00","51-2098.00","49-9041.00","43-6014.00","53-7051.00",
    ],
  };

  const key = sourceOcc.industry;
  const pool = COMMON_TARGETS[key] || COMMON_TARGETS["Office/Administrative"];
  // Return 12-18 random targets from the pool
  const count = randInt(12, Math.min(18, pool.length));
  return pickN(pool, count);
}

/** Determine if a target occupation's physical demands conflict with post-injury traits.
 *  Maps O*NET SOC prefix to typical strength/physical demands for more realistic TFQ. */
function getTargetStrengthLevel(targetOnet: string): number {
  const prefix = targetOnet.substring(0, 2);
  // Typical strength levels by SOC major group (0=S, 1=L, 2=M, 3=H, 4=V)
  const strengthByGroup: Record<string, number> = {
    "11": 0, // Management → Sedentary
    "13": 0, // Business/Financial → Sedentary
    "15": 0, // Computer/Math → Sedentary
    "17": 0, // Architecture/Engineering → Sedentary
    "21": 0, // Community/Social → Sedentary
    "23": 0, // Legal → Sedentary
    "25": 0, // Education → Light
    "27": 1, // Arts/Media → Light
    "29": 1, // Healthcare Practitioners → Light
    "31": 2, // Healthcare Support → Medium
    "33": 2, // Protective Service → Medium
    "35": 1, // Food Preparation → Light-Medium
    "37": 2, // Cleaning/Maintenance → Medium
    "39": 1, // Personal Care → Light
    "41": 1, // Sales → Light
    "43": 0, // Office/Admin → Sedentary
    "45": 3, // Farming/Fishing → Heavy
    "47": 3, // Construction → Heavy
    "49": 2, // Installation/Maintenance → Medium
    "51": 2, // Production → Medium
    "53": 2, // Transportation/Material Moving → Medium
  };
  return strengthByGroup[prefix] ?? 1;
}

/** Wage ranges by SOC major group prefix (annual $) — based on BLS OEWS data */
const WAGE_RANGES_BY_SOC: Record<string, { median: [number, number]; spread: number }> = {
  "11": { median: [80000, 150000], spread: 0.55 }, // Management
  "13": { median: [55000, 95000],  spread: 0.50 }, // Business & Financial
  "15": { median: [65000, 130000], spread: 0.45 }, // Computer & Math
  "17": { median: [60000, 110000], spread: 0.45 }, // Architecture & Engineering
  "19": { median: [55000, 100000], spread: 0.50 }, // Life/Physical/Social Science
  "21": { median: [35000, 60000],  spread: 0.40 }, // Community & Social Service
  "23": { median: [55000, 130000], spread: 0.55 }, // Legal
  "25": { median: [40000, 70000],  spread: 0.35 }, // Education
  "27": { median: [35000, 75000],  spread: 0.55 }, // Arts/Design/Entertainment
  "29": { median: [45000, 90000],  spread: 0.45 }, // Healthcare Practitioners
  "31": { median: [25000, 40000],  spread: 0.30 }, // Healthcare Support
  "33": { median: [35000, 65000],  spread: 0.35 }, // Protective Service
  "35": { median: [22000, 35000],  spread: 0.30 }, // Food Preparation
  "37": { median: [24000, 38000],  spread: 0.30 }, // Cleaning & Maintenance
  "39": { median: [24000, 40000],  spread: 0.35 }, // Personal Care
  "41": { median: [25000, 65000],  spread: 0.55 }, // Sales
  "43": { median: [30000, 50000],  spread: 0.35 }, // Office & Admin
  "45": { median: [25000, 40000],  spread: 0.35 }, // Farming/Fishing/Forestry
  "47": { median: [35000, 65000],  spread: 0.35 }, // Construction
  "49": { median: [38000, 62000],  spread: 0.35 }, // Installation/Maintenance/Repair
  "51": { median: [28000, 50000],  spread: 0.35 }, // Production
  "53": { median: [28000, 50000],  spread: 0.40 }, // Transportation/Material Moving
};

/** Generate realistic OEWS wage data for a target occupation */
function generateOEWSWageData(targetOnet: string): {
  employment: number;
  medianWage: number;
  meanWage: number;
  pct10: number;
  pct25: number;
  pct75: number;
  pct90: number;
  openingsAnnual: number;
  changePct: number;
} {
  const prefix = targetOnet.substring(0, 2);
  const range = WAGE_RANGES_BY_SOC[prefix] ?? { median: [30000, 55000], spread: 0.40 };

  // Generate median wage within the SOC group's typical range
  const medianWage = randInt(range.median[0], range.median[1]);

  // Mean is typically 5-15% higher than median (right-skewed distribution)
  const meanWage = Math.round(medianWage * (1 + Math.random() * 0.10 + 0.05));

  // Percentiles based on spread factor
  const spread = range.spread;
  const pct10 = Math.round(medianWage * (1 - spread * 0.8));
  const pct25 = Math.round(medianWage * (1 - spread * 0.4));
  const pct75 = Math.round(medianWage * (1 + spread * 0.4));
  const pct90 = Math.round(medianWage * (1 + spread * 0.8));

  // Employment: varies widely — office/healthcare large, niche trades small
  const empBase: Record<string, [number, number]> = {
    "11": [15000, 80000], "13": [20000, 120000], "15": [30000, 200000],
    "25": [50000, 200000], "29": [30000, 150000], "31": [40000, 200000],
    "35": [100000, 400000], "41": [50000, 300000], "43": [80000, 400000],
    "47": [20000, 100000], "49": [15000, 80000], "51": [20000, 120000],
    "53": [30000, 200000],
  };
  const empRange = empBase[prefix] ?? [10000, 80000];
  const employment = randInt(empRange[0], empRange[1]);

  // Projected openings: roughly 3-8% of employment annually
  const openingsAnnual = Math.round(employment * (0.03 + Math.random() * 0.05));

  // Projected growth: -2% to +12% (most occupations grow slowly)
  const changePct = Math.round((Math.random() * 14 - 2) * 10) / 10;

  return { employment, medianWage, meanWage, pct10, pct25, pct75, pct90, openingsAnnual, changePct };
}

/** Compute a realistic PVQ score based on case characteristics.
 *  Follows VE methodology: SVP gate → TFQ hard gate → composite scoring */
function computeRealisticPVQ(
  sourceOcc: OccupationDef,
  targetOnet: string,
  postTraits: number[],
  injury: InjuryPattern,
  priorEarnings: number,
): { stq: number; tfq: number; vaq: number; lmq: number; pvq: number; excluded: boolean; exclusionReason: string | null; grade: string } {
  const targetStrength = getTargetStrengthLevel(targetOnet);

  // ── SVP Gate ──────────────────────────────────────────────────────
  // Per SSR 82-41: skills are only transferable if source SVP ≥ 4
  const hasTransferableSkills = sourceOcc.svp >= 4;

  // ── STQ: Skill Transfer Quotient (0-100) ──────────────────────────
  // SVP < 4 → no transferable skills → STQ near 0
  // SVP 4-5 → some skills, moderate transfer potential
  // SVP 6+ → strong skill base, higher transfer potential
  let stq: number;
  if (!hasTransferableSkills) {
    stq = Math.round(Math.random() * 5 * 10) / 10; // 0-5: minimal/no transferable skills
  } else {
    // Same industry = higher STQ (more skill overlap)
    const sameIndustry = Math.random() > 0.5;
    const svpBonus = Math.min((sourceOcc.svp - 3) * 8, 32); // SVP 4→8, 5→16, 6→24, 7→32
    if (sameIndustry) {
      stq = Math.round((randInt(30, 65) + svpBonus) * 10) / 10;
    } else {
      stq = Math.round((randInt(10, 35) + svpBonus / 2) * 10) / 10;
    }
    stq = Math.min(stq, 100);
  }

  // ── TFQ: Trait Feasibility Quotient (0-100, hard gate) ────────────
  // Check if post-injury capacity meets target demands
  // Strength is the most critical check for physically demanding jobs
  const postStrength = postTraits[11]; // strength trait index
  const strengthFails = postStrength < targetStrength;

  // Check critical traits based on target occupation type
  // Trait indices: 0-5=aptitude, 6-10=dexterity, 11=strength, 12-16=physical, 17-23=environmental
  // For sedentary/light (office) targets: only aptitude + dexterity traits are critical
  // For medium+ targets: physical demands traits also matter
  const isPhysicalTarget = targetStrength >= 2; // Medium or higher
  const criticalTraitFails = postTraits.some((val, idx) => {
    if (idx >= 17) return false; // environmental traits never hard-gate
    if (idx <= 5 && val === 0) return true; // zero aptitude = always fails
    if (idx >= 6 && idx <= 10 && val === 0) return true; // zero dexterity = fails
    // Physical traits (12-16) only matter for medium+ occupations
    if (idx >= 12 && idx <= 16 && isPhysicalTarget && val === 0) return true;
    return false;
  });

  const tfqFails = strengthFails || criticalTraitFails;
  let tfq: number;
  if (tfqFails) {
    tfq = 0;
  } else {
    // Reserve margin: how much capacity exceeds demands
    const margin = postStrength - targetStrength;
    const baseReserve = margin >= 2 ? randInt(70, 95) : margin >= 1 ? randInt(45, 75) : randInt(25, 55);
    tfq = Math.round(baseReserve * 10) / 10;
  }

  // TFQ = 0 is a HARD GATE — always excluded (VE standard practice)
  const tfqExcluded = tfq === 0;

  // ── VAQ: Vocational Adjustment Quotient (0-100) ───────────────────
  // Based on industry/occupational similarity between source and target
  const sourcePrefix = sourceOcc.onet.substring(0, 2);
  const targetPrefix = targetOnet.substring(0, 2);
  const sameSOCGroup = sourcePrefix === targetPrefix;
  const relatedSOCGroup = Math.abs(parseInt(sourcePrefix) - parseInt(targetPrefix)) <= 4;

  let vaq: number;
  if (sameSOCGroup) {
    vaq = Math.round(randInt(75, 100) * 10) / 10;
  } else if (relatedSOCGroup) {
    vaq = Math.round(randInt(45, 75) * 10) / 10;
  } else {
    vaq = Math.round(randInt(20, 50) * 10) / 10;
  }

  // ── LMQ: Labor Market Quotient (0-100) ────────────────────────────
  const lmq = Math.round(randInt(40, 95) * 10) / 10;

  // ── Composite PVQ ─────────────────────────────────────────────────
  const excluded = tfqExcluded;
  let exclusionReason: string | null = null;
  if (excluded) {
    if (strengthFails) {
      exclusionReason = `Strength deficit: post-injury ${["Sedentary","Light","Medium","Heavy","Very Heavy"][postStrength]} capacity below ${["Sedentary","Light","Medium","Heavy","Very Heavy"][targetStrength]} demands`;
    } else {
      exclusionReason = "Trait deficit: post-injury capacity below occupation demands";
    }
  }

  const pvq = excluded ? 0 : Math.round((0.45 * stq + 0.25 * tfq + 0.15 * vaq + 0.15 * lmq) * 10) / 10;

  // Confidence grade: A(80+), B(60-79), C(30-59), D(<30 or excluded)
  let grade: string;
  if (excluded) {
    grade = "D";
  } else if (pvq >= 80) {
    grade = "A";
  } else if (pvq >= 60) {
    grade = "B";
  } else if (pvq >= 30) {
    grade = "C";
  } else {
    grade = "D";
  }

  return {
    stq, tfq, vaq, lmq, pvq, excluded,
    exclusionReason,
    grade,
  };
}

// ─── O*NET Code → Title mapping for target occupations ─────────────────

const TARGET_ONET_TITLES: Record<string, string> = {
  "47-1011.00": "First-Line Supervisors of Construction Trades",
  "47-2031.00": "Carpenters",
  "47-2061.00": "Construction Laborers",
  "47-2073.00": "Operating Engineers",
  "47-2111.00": "Electricians",
  "47-2152.00": "Plumbers, Pipefitters, and Steamfitters",
  "47-2181.00": "Roofers",
  "47-4011.00": "Construction and Building Inspectors",
  "47-4051.00": "Highway Maintenance Workers",
  "47-4071.00": "Septic Tank Servicers",
  "49-9071.00": "Maintenance and Repair Workers, General",
  "51-4121.00": "Welders, Cutters, Solderers, and Brazers",
  "43-5071.00": "Shipping, Receiving, and Inventory Clerks",
  "43-9061.00": "Office Clerks, General",
  "53-7062.00": "Laborers and Material Movers, Hand",
  "29-1141.00": "Registered Nurses",
  "29-2061.00": "Licensed Practical and Licensed Vocational Nurses",
  "31-1131.00": "Nursing Assistants",
  "31-2021.00": "Physical Therapist Assistants",
  "31-9092.00": "Medical Assistants",
  "31-9097.00": "Phlebotomists",
  "29-2052.00": "Pharmacy Technicians",
  "43-6013.00": "Medical Secretaries and Administrative Assistants",
  "43-4171.00": "Receptionists and Information Clerks",
  "43-6014.00": "Secretaries and Administrative Assistants",
  "29-9099.00": "Healthcare Practitioners, All Other",
  "21-1093.00": "Social Workers, All Other",
  "39-9011.00": "Childcare Workers",
  "21-1094.00": "Community Health Workers",
  "43-3031.00": "Bookkeeping, Accounting, and Auditing Clerks",
  "43-4051.00": "Customer Service Representatives",
  "43-9021.00": "Data Entry Keyers",
  "43-3021.00": "Billing and Posting Clerks",
  "43-3051.00": "Payroll and Timekeeping Clerks",
  "43-4071.00": "File Clerks",
  "43-4131.00": "Loan Interviewers and Clerks",
  "43-9041.00": "Insurance Claims and Policy Processing Clerks",
  "43-3071.00": "Tellers",
  "43-4041.00": "Credit Authorizers, Checkers, and Clerks",
  "43-9022.00": "Word Processors and Typists",
  "13-2011.00": "Accountants and Auditors",
  "43-4011.00": "Brokerage Clerks",
  "43-4141.00": "New Accounts Clerks",
  "13-2082.00": "Tax Preparers",
  "13-1199.00": "Business Operations Specialists, All Other",
  "51-9199.00": "Production Workers, All Other",
  "51-2098.00": "Assemblers and Fabricators, All Other",
  "51-9061.00": "Inspectors, Testers, Sorters, Samplers, and Weighers",
  "51-1011.00": "First-Line Supervisors of Production Workers",
  "43-5061.00": "Production, Planning, and Expediting Clerks",
  "51-4041.00": "Machinists",
  "51-7041.00": "Sawing Machine Operators",
  "53-7051.00": "Industrial Truck and Tractor Operators",
  "17-3026.00": "Industrial Engineering Technologists and Technicians",
  "51-9198.00": "Helpers--Production Workers",
  "35-2014.00": "Cooks, Restaurant",
  "35-3031.00": "Waiters and Waitresses",
  "35-1012.00": "First-Line Supervisors of Food Preparation Workers",
  "35-2021.00": "Food Preparation Workers",
  "35-9011.00": "Dining Room and Cafeteria Attendants",
  "35-9031.00": "Hosts and Hostesses, Restaurant, Lounge, and Coffee Shop",
  "41-2011.00": "Cashiers",
  "41-2021.00": "Counter and Rental Clerks",
  "35-3023.00": "Fast Food and Counter Workers",
  "35-2015.00": "Cooks, Short Order",
  "53-3032.00": "Heavy and Tractor-Trailer Truck Drivers",
  "53-3031.00": "Driver/Sales Workers",
  "53-3033.00": "Light Truck Drivers",
  "53-1042.00": "First-Line Supervisors of Helpers and Laborers",
  "53-6031.00": "Automotive and Watercraft Service Attendants",
  "49-3031.00": "Bus and Truck Mechanics and Diesel Engine Specialists",
  "49-3023.00": "Automotive Service Technicians and Mechanics",
  "43-5011.00": "Cargo and Freight Agents",
  "53-7064.00": "Packers and Packagers, Hand",
  "53-3058.00": "Passenger Vehicle Drivers",
  "41-2031.00": "Retail Salespersons",
  "15-1252.00": "Software Developers",
  "15-1232.00": "Computer User Support Specialists",
  "15-1244.00": "Network and Computer Systems Administrators",
  "15-1256.00": "Software Quality Assurance Analysts and Testers",
  "15-1299.00": "Computer Occupations, All Other",
  "15-2051.00": "Data Scientists",
  "15-1231.00": "Computer Network Support Specialists",
  "15-1211.00": "Computer Systems Analysts",
  "43-9011.00": "Computer Operators",
  "13-1161.00": "Market Research Analysts and Marketing Specialists",
  "11-3021.00": "Computer and Information Systems Managers",
  "41-1011.00": "First-Line Supervisors of Retail Sales Workers",
  "41-3091.00": "Sales Representatives of Services",
  "41-9022.00": "Real Estate Sales Agents",
  "41-3021.00": "Insurance Sales Agents",
  "37-2011.00": "Janitors and Cleaners",
  "49-3021.00": "Automotive Body and Related Repairers",
  "49-2022.00": "Telecommunications Equipment Installers",
  "49-9041.00": "Industrial Machinery Mechanics",
};

// ─── Main Route Handler ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { count = 500 } = await req.json().catch(() => ({ count: 500 }));
  const total = Math.min(count, 500);
  const results: string[] = [];

  // Pre-populate OccupationONET records for all target codes to satisfy FK constraints
  console.log("Pre-populating OccupationONET records for target codes...");
  const targetCodesToEnsure = Object.keys(TARGET_ONET_TITLES);
  for (const code of targetCodesToEnsure) {
    await prisma.occupationONET.upsert({
      where: { id: code },
      update: {}, // Don't overwrite existing data
      create: {
        id: code,
        title: TARGET_ONET_TITLES[code],
        description: `${TARGET_ONET_TITLES[code]} — placeholder created by seed script`,
      },
    });
  }
  console.log(`Ensured ${targetCodesToEnsure.length} OccupationONET records exist.`);

  for (let i = 0; i < total; i++) {
    try {
      // 1. Generate demographics
      const isMale = Math.random() > 0.45;
      const firstName = isMale ? pick(FIRST_NAMES_M) : pick(FIRST_NAMES_F);
      const lastName = pick(LAST_NAMES);
      const clientName = `${firstName} ${lastName}`;
      const dob = randDate(1960, 1998);
      const doi = randDate(2019, 2025);
      const doe = new Date(doi.getTime() + randInt(90, 365) * 86400000);
      const evaluator = pick(EVALUATOR_NAMES);
      const referral = pick(REFERRAL_SOURCES);

      // 2. Pick 1-3 PRW occupations
      const numPRW = randInt(1, 3);
      const prwOccs = pickN(OCCUPATIONS, numPRW);

      // 3. Pick injury
      const injury = pick(INJURIES);
      const severity = 0.7 + Math.random() * 0.6; // 0.7-1.3 severity multiplier

      // 4. Age rule
      const ageAtInjury = (doi.getTime() - dob.getTime()) / (365.25 * 86400000);
      let ageRule = "standard";
      if (ageAtInjury >= 55) ageRule = "advanced_age";
      else if (ageAtInjury >= 50) ageRule = "closely_approaching";

      // 5. Determine prior earnings from primary PRW
      const primaryOcc = prwOccs[0];
      const priorEarnings = randInt(primaryOcc.typicalEarnings[0], primaryOcc.typicalEarnings[1]);

      // 6. Create case
      const caseRecord = await prisma.case.create({
        data: {
          clientName,
          clientDOB: dob,
          dateOfInjury: doi,
          dateOfEval: doe,
          evaluatorName: evaluator,
          referralSource: referral,
          notes: `${injury.name}. ${injury.description}. Sample case #${i + 1} for demonstration.`,
          status: "active",
        },
      });

      // 7. Create PRW entries
      const prwRecords = [];
      for (let p = 0; p < prwOccs.length; p++) {
        const occ = prwOccs[p];
        const endDate = p === 0 ? doi : new Date(doi.getTime() - randInt(30, 1800) * 86400000);
        const duration = randInt(18, 96);
        const startDate = new Date(endDate.getTime() - duration * 30 * 86400000);

        const prw = await prisma.pastRelevantWork.create({
          data: {
            caseId: caseRecord.id,
            jobTitle: occ.title,
            employer: `${pick(["ABC","XYZ","National","Pacific","Central","Metro","Allied","United","American","Premier"])} ${pick(["Corp","Inc","LLC","Co","Services","Group","Industries","Solutions","Associates","Partners"])}`,
            onetSocCode: occ.onet,
            svp: occ.svp,
            strengthLevel: occ.strength,
            skillLevel: occ.svp >= 5 ? "Skilled" : occ.svp >= 3 ? "Semi-skilled" : "Unskilled",
            startDate,
            endDate,
            durationMonths: duration,
            dutiesDescription: occ.skills.map(s => `${s.verb} ${s.object} ${s.context}`).join(". "),
            isSubstantialGainful: true,
          },
        });
        prwRecords.push({ prw, occ });
      }

      // 8. Create acquired skills from PRW
      for (const { prw, occ } of prwRecords) {
        for (const skill of occ.skills) {
          await prisma.acquiredSkill.create({
            data: {
              caseId: caseRecord.id,
              prwId: prw.id,
              actionVerb: skill.verb,
              object: skill.object,
              context: skill.context,
              toolsSoftware: skill.tools,
              materialsServices: skill.materials,
              svpLevel: occ.svp,
              isTransferable: occ.svp >= 4,
            },
          });
        }
      }

      // 9. Create worker profiles
      // Pre-injury = MAXIMUM demonstrated capacity across ALL PRW occupations
      // A VE considers the highest level of function the claimant demonstrated in any job
      const preTraits = new Array(24).fill(0);
      for (const { occ } of prwRecords) {
        for (let t = 0; t < 24; t++) {
          preTraits[t] = Math.max(preTraits[t], occ.preTraits[t]);
        }
      }
      // Add slight natural variation (±1 on ~20% of aptitude/environmental traits only)
      // NEVER reduce strength below demonstrated capacity — that's documented work history
      for (let t = 0; t < preTraits.length; t++) {
        if (t === 11) continue; // Skip strength — preserve demonstrated capacity
        const variation = Math.random() > 0.8 ? (Math.random() > 0.5 ? 1 : -1) : 0;
        preTraits[t] = clamp(preTraits[t] + variation, 0, 4);
      }

      // Post-injury = apply injury pattern to max-capacity pre-injury profile
      const postTraits = applyInjury(preTraits, injury, severity);

      // Work History profile (demands of the PRIMARY occupation per DOT/O*NET)
      await prisma.workerProfile.create({
        data: {
          caseId: caseRecord.id,
          profileType: "WORK_HISTORY",
          ...traitsToRecord(primaryOcc.preTraits),
          sources: "DOT/O*NET",
        },
      });

      // Pre-injury profile (max capacity demonstrated across all PRW)
      await prisma.workerProfile.create({
        data: {
          caseId: caseRecord.id,
          profileType: "PRE",
          ...traitsToRecord(preTraits),
          sources: "Self-report, employment records, FCE (pre-injury)",
        },
      });

      // Post-injury profile
      await prisma.workerProfile.create({
        data: {
          caseId: caseRecord.id,
          profileType: "POST",
          ...traitsToRecord(postTraits),
          notes: `${injury.name}: ${injury.description}`,
          sources: "FCE, treating physician, IME",
        },
      });

      // 10. Create analysis with target occupations and scores
      const analysis = await prisma.analysis.create({
        data: {
          caseId: caseRecord.id,
          name: "Initial Vocational Analysis",
          status: "completed",
          step: 5,
          ageRule,
          priorEarnings,
        },
      });

      // Generate target occupations
      const targetCodes = getTargetONETCodes(primaryOcc);
      for (let t = 0; t < targetCodes.length; t++) {
        const scores = computeRealisticPVQ(primaryOcc, targetCodes[t], postTraits, injury, priorEarnings);
        // Find a title for this O*NET code — prefer OCCUPATIONS match, then TARGET_ONET_TITLES
        const matchOcc = OCCUPATIONS.find(o => o.onet === targetCodes[t]);
        const targetTitle = matchOcc?.title || TARGET_ONET_TITLES[targetCodes[t]] || `Occupation ${targetCodes[t]}`;
        const targetSvp = matchOcc?.svp || randInt(3, 6);

        await prisma.targetOccupation.create({
          data: {
            analysisId: analysis.id,
            onetSocCode: targetCodes[t],
            title: targetTitle,
            svp: targetSvp,
            stq: scores.stq,
            stqDetails: {
              components: {
                taskDwaOverlap: Math.round(scores.stq * 0.35 * 100) / 100,
                wfMpsmsOverlap: Math.round(scores.stq * 0.25 * 100) / 100,
                toolsOverlap: Math.round(scores.stq * 0.20 * 100) / 100,
                materialsOverlap: Math.round(scores.stq * 0.10 * 100) / 100,
                credentialOverlap: Math.round(scores.stq * 0.10 * 100) / 100,
              },
            },
            tfq: scores.tfq,
            tfqDetails: {
              reserveMargin: Math.round((scores.tfq / 100) * 1000) / 1000,
              traitsPassing: scores.tfq > 0 ? 24 : randInt(16, 22),
              traitsFailing: scores.tfq > 0 ? 0 : randInt(1, 4),
              traitsTotal: 24,
              strengthCheck: scores.excluded && scores.exclusionReason?.includes("Strength") ? "FAIL" : "PASS",
            },
            vaq: scores.vaq,
            vaqDetails: {
              adjustment: {
                tools: Math.round(scores.vaq + randInt(-15, 15)),
                workProcesses: Math.round(scores.vaq + randInt(-10, 10)),
                workSetting: Math.round(scores.vaq + randInt(-20, 20)),
                industry: Math.round(scores.vaq + randInt(-15, 15)),
              },
              autoEstimated: true,
            },
            lmq: scores.lmq,
            lmqDetails: (() => {
              const oewsData = generateOEWSWageData(targetCodes[t]);
              return {
                score: scores.lmq,
                employmentScore: randInt(50, 100),
                wageScore: randInt(30, 100),
                projectionsScore: randInt(35, 85),
                details: oewsData,
              };
            })(),
            pvq: scores.pvq,
            excluded: scores.excluded,
            exclusionReason: scores.exclusionReason,
            confidenceGrade: scores.grade,
          },
        });
      }

      results.push(`Case ${i + 1}: ${clientName} (${primaryOcc.title}, ${injury.name})`);

      // Log progress every 50 cases
      if ((i + 1) % 50 === 0) {
        console.log(`Seeded ${i + 1}/${total} cases...`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push(`Case ${i + 1}: ERROR - ${msg}`);
      console.error(`Error seeding case ${i + 1}:`, msg);
    }
  }

  return NextResponse.json({
    seeded: results.length,
    summary: {
      totalCases: total,
      occupationTypes: OCCUPATIONS.length,
      injuryTypes: INJURIES.length,
    },
    results: results.slice(0, 20), // First 20 for preview
  });
}

// DELETE handler to clean up seeded sample cases
export async function DELETE() {
  // Delete all cases whose notes contain "Sample case #"
  // Use raw SQL for cascade efficiency
  const seededCases = await prisma.case.findMany({
    where: { notes: { contains: "Sample case" } },
    select: { id: true },
  });

  const caseIds = seededCases.map(c => c.id);
  if (caseIds.length === 0) {
    return NextResponse.json({ deleted: 0, message: "No seeded cases found" });
  }

  // Delete in dependency order
  const analyses = await prisma.analysis.findMany({
    where: { caseId: { in: caseIds } },
    select: { id: true },
  });
  const analysisIds = analyses.map(a => a.id);

  if (analysisIds.length > 0) {
    await prisma.targetOccupation.deleteMany({ where: { analysisId: { in: analysisIds } } });
    await prisma.analysis.deleteMany({ where: { id: { in: analysisIds } } });
  }

  const prws = await prisma.pastRelevantWork.findMany({
    where: { caseId: { in: caseIds } },
    select: { id: true },
  });
  const prwIds = prws.map(p => p.id);

  if (prwIds.length > 0) {
    await prisma.acquiredSkill.deleteMany({ where: { prwId: { in: prwIds } } });
    await prisma.pastRelevantWork.deleteMany({ where: { id: { in: prwIds } } });
  }

  await prisma.workerProfile.deleteMany({ where: { caseId: { in: caseIds } } });
  await prisma.case.deleteMany({ where: { id: { in: caseIds } } });

  return NextResponse.json({ deleted: caseIds.length, message: `Deleted ${caseIds.length} seeded cases and all related data` });
}
