/**
 * API: Unified Occupation data
 *
 * GET /api/unified-occupations — returns all unified occupations (summary)
 * GET /api/unified-occupations?code=XX-XXXX — lookup by SOC/ONET/DOT code
 * GET /api/unified-occupations?group=XX — filter by SOC major group
 * GET /api/unified-occupations?search=term — text search
 */

import { NextRequest, NextResponse } from "next/server";
import unifiedData from "@/data/unified-occupations.json";

interface UnifiedOcc {
  onetCode: string;
  socCode: string;
  title: string;
  description: string;
  traits: Record<string, { value: number; source: string; rawValue?: string }>;
  vqScore: number;
  vqBand: number;
  svp: number;
  svpRange: [number, number];
  jobZone: number | null;
  strengthLevel: string;
  strengthRange: string[];
  wages: {
    median: number | null;
    mean: number | null;
    p10: number | null;
    p25: number | null;
    p75: number | null;
    p90: number | null;
  };
  employment: number | null;
  projections: { growthPercent: number | null; annualOpenings: number | null } | null;
  dotTitles: Array<{ code: string; title: string; svp: number; strength: string }>;
  dotTitleCount: number;
  tasks: string[];
  dwas: string[];
  tools: string[];
  dataSources: string[];
  traitCoverage: number;
  hasORS: boolean;
  hasDOT: boolean;
  hasOEWS: boolean;
  hasBLSProjections: boolean;
}

const occupations = unifiedData as unknown as UnifiedOcc[];

// Build reverse lookup indexes
const byOnetCode = new Map<string, UnifiedOcc>();
const bySocCode = new Map<string, UnifiedOcc[]>();
const byDotCode = new Map<string, UnifiedOcc>();

for (const occ of occupations) {
  byOnetCode.set(occ.onetCode, occ);
  const socBase = occ.socCode;
  if (!bySocCode.has(socBase)) bySocCode.set(socBase, []);
  bySocCode.get(socBase)!.push(occ);

  for (const dot of occ.dotTitles) {
    byDotCode.set(dot.code, occ);
  }
}

// SOC major groups
const SOC_MAJOR_GROUPS: Record<string, string> = {
  "11": "Management",
  "13": "Business and Financial Operations",
  "15": "Computer and Mathematical",
  "17": "Architecture and Engineering",
  "19": "Life, Physical, and Social Science",
  "21": "Community and Social Service",
  "23": "Legal",
  "25": "Educational Instruction and Library",
  "27": "Arts, Design, Entertainment, Sports, and Media",
  "29": "Healthcare Practitioners and Technical",
  "31": "Healthcare Support",
  "33": "Protective Service",
  "35": "Food Preparation and Serving Related",
  "37": "Building and Grounds Cleaning and Maintenance",
  "39": "Personal Care and Service",
  "41": "Sales and Related",
  "43": "Office and Administrative Support",
  "45": "Farming, Fishing, and Forestry",
  "47": "Construction and Extraction",
  "49": "Installation, Maintenance, and Repair",
  "51": "Production",
  "53": "Transportation and Material Moving",
  "55": "Military Specific",
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const group = searchParams.get("group");
  const search = searchParams.get("search");
  const summary = searchParams.get("summary");

  // Lookup by any code type
  if (code) {
    const normalized = code.trim();

    // Try O*NET code (XX-XXXX.XX)
    let found = byOnetCode.get(normalized);
    if (found) return NextResponse.json(found);

    // Try adding .00 suffix
    found = byOnetCode.get(normalized + ".00");
    if (found) return NextResponse.json(found);

    // Try SOC code (XX-XXXX)
    const socMatches = bySocCode.get(normalized);
    if (socMatches && socMatches.length > 0) {
      return NextResponse.json(socMatches.length === 1 ? socMatches[0] : socMatches);
    }

    // Try DOT code (XXX.XXX-XXX)
    found = byDotCode.get(normalized);
    if (found) return NextResponse.json(found);

    return NextResponse.json({ error: "Code not found" }, { status: 404 });
  }

  // Filter by SOC major group
  if (group) {
    const filtered = occupations.filter(o => o.socCode.startsWith(group + "-"));
    return NextResponse.json({
      group: group,
      groupName: SOC_MAJOR_GROUPS[group] || "Unknown",
      count: filtered.length,
      occupations: filtered.map(summarize),
    });
  }

  // Text search
  if (search) {
    const q = search.toLowerCase();
    const matches = occupations.filter(o =>
      o.title.toLowerCase().includes(q) ||
      o.onetCode.includes(q) ||
      o.socCode.includes(q) ||
      o.dotTitles.some(d => d.title.toLowerCase().includes(q) || d.code.includes(q))
    ).slice(0, 50);
    return NextResponse.json(matches.map(summarize));
  }

  // Summary of all groups
  if (summary === "groups") {
    const groups = Object.entries(SOC_MAJOR_GROUPS).map(([code, name]) => {
      const members = occupations.filter(o => o.socCode.startsWith(code + "-"));
      const avgVQ = members.reduce((s, o) => s + o.vqScore, 0) / Math.max(1, members.length);
      const totalEmployment = members.reduce((s, o) => s + (o.employment || 0), 0);
      return {
        code,
        name,
        occupationCount: members.length,
        avgVQ: Math.round(avgVQ * 10) / 10,
        totalEmployment,
        strengthDistribution: getStrengthDistribution(members),
      };
    }).filter(g => g.occupationCount > 0);
    return NextResponse.json(groups);
  }

  // Default: return all summaries
  return NextResponse.json({
    total: occupations.length,
    groups: Object.entries(SOC_MAJOR_GROUPS).map(([code, name]) => ({
      code, name,
      count: occupations.filter(o => o.socCode.startsWith(code + "-")).length,
    })),
    occupations: occupations.map(summarize),
  });
}

function summarize(occ: UnifiedOcc) {
  return {
    onetCode: occ.onetCode,
    socCode: occ.socCode,
    title: occ.title,
    vqScore: occ.vqScore,
    vqBand: occ.vqBand,
    svp: occ.svp,
    strengthLevel: occ.strengthLevel,
    employment: occ.employment,
    medianWage: occ.wages.median,
    traitCoverage: occ.traitCoverage,
    dataSources: occ.dataSources,
    dotTitleCount: occ.dotTitleCount,
  };
}

function getStrengthDistribution(occs: UnifiedOcc[]) {
  const dist: Record<string, number> = { S: 0, L: 0, M: 0, H: 0, V: 0 };
  for (const o of occs) {
    const s = o.strengthLevel;
    if (s in dist) dist[s]++;
  }
  return dist;
}
