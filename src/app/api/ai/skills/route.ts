import { NextRequest, NextResponse } from "next/server";
import { generateAcquiredSkills, isOpenAIConfigured } from "@/lib/ai/openai";

/**
 * POST /api/ai/skills
 * Generate acquired skills for a PRW entry using OpenAI.
 */
export async function POST(req: NextRequest) {
  if (!isOpenAIConfigured()) {
    return NextResponse.json(
      { error: "OpenAI not configured", skills: [] },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const skills = await generateAcquiredSkills({
      jobTitle: body.jobTitle,
      onetCode: body.onetCode,
      svp: body.svp,
      strength: body.strength,
      dutiesDescription: body.dutiesDescription,
    });
    return NextResponse.json({ skills });
  } catch (error) {
    console.error("[POST /api/ai/skills]", error);
    return NextResponse.json(
      { error: "Failed to generate skills", skills: [] },
      { status: 500 }
    );
  }
}
