import { NextRequest, NextResponse } from "next/server";
import {
  buildFingerprintIndex,
  cosineSimilarity,
  analyzeComponentOverlap,
  type OccupationFingerprint,
} from "@/lib/engine/component-profile";

/**
 * CPC Lookup API
 *
 * Search occupations by title/code and return their Component Profile Code,
 * fingerprint data, ORS traits, and OEWS employment/wage data.
 *
 * Supports:
 * - ?q=KEYWORD — search by occupation title or O*NET code
 * - ?code=XX-XXXX.XX — lookup a specific O*NET code
 * - ?similar=XX-XXXX.XX — find occupations most similar to the given code
 * - ?compare=XX-XXXX.XX,YY-YYYY.YY — compare two occupations
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const code = searchParams.get("code")?.trim() ?? "";
    const similar = searchParams.get("similar")?.trim() ?? "";
    const compare = searchParams.get("compare")?.trim() ?? "";
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const pageSize = Math.min(parseInt(searchParams.get("pageSize") ?? "25", 10), 100);

    const index = await buildFingerprintIndex();

    // ── Mode 1: Compare two occupations ──────────────────────────
    if (compare) {
      const codes = compare.split(",").map((c) => c.trim());
      if (codes.length !== 2) {
        return NextResponse.json({ error: "Provide exactly two codes separated by comma" }, { status: 400 });
      }
      const fpA = index.get(codes[0]);
      const fpB = index.get(codes[1]);
      if (!fpA || !fpB) {
        return NextResponse.json({ error: `Occupation not found: ${!fpA ? codes[0] : codes[1]}` }, { status: 404 });
      }
      const sim = cosineSimilarity(fpA.vector, fpB.vector);
      const { matching, gaps } = analyzeComponentOverlap(fpA.vector, fpB.vector, 10);

      return NextResponse.json({
        comparison: {
          occupationA: formatFingerprint(fpA),
          occupationB: formatFingerprint(fpB),
          cosineSimilarity: Math.round(sim * 10000) / 10000,
          similarityPercent: Math.round(sim * 100),
          topMatchingComponents: matching,
          topGapComponents: gaps,
        },
      });
    }

    // ── Mode 2: Find similar occupations to a given code ─────────
    if (similar) {
      const fp = index.get(similar);
      if (!fp) {
        return NextResponse.json({ error: `Occupation not found: ${similar}` }, { status: 404 });
      }

      const results: Array<ReturnType<typeof formatFingerprint> & { cosineSimilarity: number }> = [];
      for (const [otherCode, otherFp] of index) {
        if (otherCode === similar) continue;
        const sim = cosineSimilarity(fp.vector, otherFp.vector);
        if (sim > 0.3) {
          results.push({
            ...formatFingerprint(otherFp),
            cosineSimilarity: Math.round(sim * 10000) / 10000,
          });
        }
      }
      results.sort((a, b) => b.cosineSimilarity - a.cosineSimilarity);

      const total = results.length;
      const paged = results.slice((page - 1) * pageSize, page * pageSize);

      return NextResponse.json({
        source: formatFingerprint(fp),
        results: paged,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      });
    }

    // ── Mode 3: Lookup a specific code ───────────────────────────
    if (code) {
      const fp = index.get(code);
      if (!fp) {
        return NextResponse.json({ error: `Occupation not found: ${code}` }, { status: 404 });
      }
      return NextResponse.json({ occupation: formatFingerprint(fp) });
    }

    // ── Mode 4: Search by keyword/title ──────────────────────────
    if (q.length < 2) {
      return NextResponse.json({ results: [], total: 0, query: q });
    }

    const queryLower = q.toLowerCase();
    const matches: Array<ReturnType<typeof formatFingerprint> & { matchScore: number }> = [];

    for (const [onetCode, fp] of index) {
      let score = 0;

      // Exact code match
      if (onetCode === q || onetCode.startsWith(q)) {
        score = 100;
      }
      // CPC code match
      else if (fp.cpc.code.toLowerCase().includes(queryLower)) {
        score = 80;
      }
      // Title match
      else if (fp.title.toLowerCase().includes(queryLower)) {
        score = 60;
        // Boost for title starting with query
        if (fp.title.toLowerCase().startsWith(queryLower)) score = 70;
      }
      // Top component match (knowledge, skills, abilities, work activities)
      else {
        const components = [
          ...fp.cpc.topKnowledge,
          ...fp.cpc.topSkills,
          ...fp.cpc.topAbilities,
          ...fp.cpc.topWorkActivities,
        ];
        for (const comp of components) {
          if (comp.toLowerCase().includes(queryLower)) {
            score = 40;
            break;
          }
        }
      }

      if (score > 0) {
        matches.push({ ...formatFingerprint(fp), matchScore: score });
      }
    }

    // Sort by match score descending, then title alphabetically
    matches.sort((a, b) => b.matchScore - a.matchScore || a.title.localeCompare(b.title));

    const total = matches.length;
    const paged = matches.slice((page - 1) * pageSize, page * pageSize);

    return NextResponse.json({
      results: paged,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      query: q,
    });
  } catch (error) {
    console.error("[GET /api/occupations/cpc-lookup]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function formatFingerprint(fp: OccupationFingerprint) {
  return {
    onetCode: fp.onetCode,
    title: fp.title,
    jobZone: fp.jobZone,
    cpcCode: fp.cpc.code,
    legacyCpcCode: fp.cpc.legacyCode,
    topKnowledge: fp.cpc.topKnowledge,
    topSkills: fp.cpc.topSkills,
    topAbilities: fp.cpc.topAbilities,
    topWorkActivities: fp.cpc.topWorkActivities,
    strength: fp.cpc.strength,
    strengthLevel: fp.cpc.strengthLevel,
    orsPhysicalDemands: fp.cpc.orsPhysicalDemands,
    segments: fp.cpc.segments,
    orsTraits: fp.orsTraits,
    employment: fp.oewsData?.employment ?? null,
    medianWage: fp.oewsData?.medianWage ?? null,
    meanWage: fp.oewsData?.meanWage ?? null,
  };
}
