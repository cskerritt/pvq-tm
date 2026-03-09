import { NextRequest, NextResponse } from "next/server";
import { generateDutiesDescription, isOpenAIConfigured } from "@/lib/ai/openai";

/**
 * POST /api/ai/duties
 * Generate a duties description for a PRW entry using OpenAI.
 */
export async function POST(req: NextRequest) {
  if (!isOpenAIConfigured()) {
    return NextResponse.json(
      { error: "OpenAI not configured", description: "" },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const description = await generateDutiesDescription({
      jobTitle: body.jobTitle,
      onetCode: body.onetCode,
      dotCode: body.dotCode,
      svp: body.svp,
      strength: body.strength,
      employer: body.employer,
    });
    return NextResponse.json({ description });
  } catch (error) {
    console.error("[POST /api/ai/duties]", error);
    return NextResponse.json(
      { error: "Failed to generate duties description", description: "" },
      { status: 500 }
    );
  }
}
