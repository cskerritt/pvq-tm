import { NextRequest, NextResponse } from "next/server";
import { generateVocationalNarrative, isOpenAIConfigured } from "@/lib/ai/openai";

/**
 * POST /api/ai/narrative
 * Generate a vocational opinion narrative for analysis results.
 */
export async function POST(req: NextRequest) {
  if (!isOpenAIConfigured()) {
    return NextResponse.json(
      { error: "OpenAI not configured", narrative: "" },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const narrative = await generateVocationalNarrative({
      clientName: body.clientName,
      ageRule: body.ageRule,
      priorEarnings: body.priorEarnings,
      prwSummary: body.prwSummary,
      viableCount: body.viableCount,
      excludedCount: body.excludedCount,
      topOccupations: body.topOccupations,
      injuryDescription: body.injuryDescription,
    });
    return NextResponse.json({ narrative });
  } catch (error) {
    console.error("[POST /api/ai/narrative]", error);
    return NextResponse.json(
      { error: "Failed to generate narrative", narrative: "" },
      { status: 500 }
    );
  }
}
