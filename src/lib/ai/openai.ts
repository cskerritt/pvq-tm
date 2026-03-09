import OpenAI from "openai";

// Lazy singleton — only created when first called
let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

/**
 * Generate a detailed duties description for a past relevant work entry.
 * Uses the O*NET occupation title, DOT data, and any user context.
 */
export async function generateDutiesDescription(params: {
  jobTitle: string;
  onetCode?: string;
  dotCode?: string;
  svp?: number;
  strength?: string;
  employer?: string;
}): Promise<string> {
  const client = getClient();

  const svpLabel = params.svp
    ? params.svp <= 3 ? "unskilled" : params.svp <= 6 ? "semi-skilled" : "skilled"
    : "unknown skill level";

  const strengthLabel: Record<string, string> = {
    S: "Sedentary", L: "Light", M: "Medium", H: "Heavy", V: "Very Heavy",
  };

  const prompt = `You are a Certified Vocational Evaluator (CVE) writing a Past Relevant Work duties description for a Social Security disability case.

Job Title: ${params.jobTitle}
${params.onetCode ? `O*NET Code: ${params.onetCode}` : ""}
${params.dotCode ? `DOT Code: ${params.dotCode}` : ""}
SVP: ${params.svp ?? "unknown"} (${svpLabel})
Strength: ${params.strength ? strengthLabel[params.strength] ?? params.strength : "unknown"}
${params.employer ? `Employer Type: ${params.employer}` : ""}

Write a concise, professional duties description (3-5 sentences) that:
- Uses action verbs in past tense
- Describes the primary tasks, tools/equipment used, and work environment
- References the physical demands relevant to the strength level
- Is appropriate for a vocational evaluation report
- Does NOT include any headings, bullet points, or labels — just flowing prose`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 300,
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content?.trim() ?? "";
}

/**
 * Generate a professional vocational opinion narrative for an analysis.
 * Summarizes findings, viable occupations, wage data, and transferability.
 */
export async function generateVocationalNarrative(params: {
  clientName: string;
  ageRule: string;
  priorEarnings: number | null;
  prwSummary: string; // Brief description of past work
  viableCount: number;
  excludedCount: number;
  topOccupations: Array<{
    title: string;
    pvq: number;
    medianWage: number | null;
    grade: string;
  }>;
  injuryDescription?: string;
}): Promise<string> {
  const client = getClient();

  const ageLabel = params.ageRule === "advanced_age"
    ? "advanced age (55+)"
    : params.ageRule === "closely_approaching"
      ? "closely approaching advanced age (50-54)"
      : "younger individual (under 50)";

  const topOccs = params.topOccupations
    .slice(0, 5)
    .map((o) => `${o.title} (PVQ: ${o.pvq.toFixed(1)}, Grade: ${o.grade}${o.medianWage ? `, Median Wage: $${o.medianWage.toLocaleString()}` : ""})`)
    .join("\n  ");

  const prompt = `You are a Certified Vocational Evaluator (CVE) writing a vocational opinion for a forensic vocational analysis report.

Client: ${params.clientName}
Age Category: ${ageLabel}
${params.priorEarnings ? `Prior Earnings: $${params.priorEarnings.toLocaleString()}/year` : ""}
Past Relevant Work: ${params.prwSummary}
${params.injuryDescription ? `Injury: ${params.injuryDescription}` : ""}

Analysis Results:
- ${params.viableCount} viable alternative occupations identified
- ${params.excludedCount} occupations excluded due to trait/strength deficits
- Top candidates:
  ${topOccs}

Write a professional vocational opinion (2-3 paragraphs) that:
1. Summarizes the transferability analysis methodology (PVQ-TM using STQ, TFQ, VAQ, LMQ)
2. States the key findings — how many viable alternatives exist and their quality
3. Discusses wage implications compared to prior earnings if available
4. Notes any limitations or considerations based on age rule
5. Uses professional, objective VE language appropriate for litigation or SSA proceedings
6. Does NOT include headings — just flowing paragraphs`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 600,
    temperature: 0.6,
  });

  return response.choices[0]?.message?.content?.trim() ?? "";
}

/**
 * Generate occupation-specific acquired skills based on occupation details.
 * Returns an array of skill objects ready for database insertion.
 */
export async function generateAcquiredSkills(params: {
  jobTitle: string;
  onetCode?: string;
  svp?: number;
  strength?: string;
  dutiesDescription?: string;
}): Promise<Array<{
  actionVerb: string;
  object: string;
  context: string;
  toolsSoftware: string | null;
}>> {
  const client = getClient();

  const prompt = `You are a Certified Vocational Evaluator identifying acquired skills from a worker's Past Relevant Work for an SSA disability case.

Job Title: ${params.jobTitle}
${params.onetCode ? `O*NET Code: ${params.onetCode}` : ""}
SVP: ${params.svp ?? "unknown"}
Strength: ${params.strength ?? "unknown"}
${params.dutiesDescription ? `Duties: ${params.dutiesDescription}` : ""}

Generate 4-6 acquired skills in SSA format. Each skill must have:
- actionVerb: A specific action verb (e.g., "Operate", "Analyze", "Coordinate")
- object: What is acted upon (e.g., "CNC milling machines")
- context: The work context (e.g., "in precision manufacturing environment")
- toolsSoftware: Relevant tools/software or null

Return ONLY a JSON array with these exact fields. No markdown, no explanation.
Example: [{"actionVerb":"Operate","object":"CNC machines","context":"in manufacturing","toolsSoftware":"Haas CNC, Mastercam"}]`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 500,
    temperature: 0.7,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content?.trim() ?? "{}";
  try {
    const parsed = JSON.parse(content);
    // Handle both { skills: [...] } and [...] formats
    const skills = Array.isArray(parsed) ? parsed : (parsed.skills ?? []);
    return skills.map((s: Record<string, string>) => ({
      actionVerb: s.actionVerb ?? s.verb ?? "",
      object: s.object ?? "",
      context: s.context ?? "",
      toolsSoftware: s.toolsSoftware ?? s.tools ?? null,
    }));
  } catch {
    return [];
  }
}

/**
 * Check if OpenAI is configured and available.
 */
export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
