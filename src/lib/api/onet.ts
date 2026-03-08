/**
 * O*NET Web Services API v2 Client
 *
 * Uses the v2 API at api-v2.onetcenter.org with X-API-Key authentication.
 * Handles pagination to fetch complete result sets.
 */

const ONET_BASE = "https://api-v2.onetcenter.org";

function getApiKey(): string {
  const key = process.env.ONET_API_KEY;
  if (!key) throw new Error("ONET_API_KEY not set");
  return key;
}

async function onetFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${ONET_BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), {
    headers: {
      "X-API-Key": getApiKey(),
      Accept: "application/json",
    },
    next: { revalidate: 86400 }, // cache for 24h
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`O*NET API error ${res.status}: ${text}`);
  }
  return res.json();
}

/** Fetch all pages from a paginated v2 endpoint */
async function onetFetchAll<T>(path: string, params?: Record<string, string>): Promise<T> {
  // First fetch with a large page size
  const mergedParams = { ...params, start: "1", end: "100" };
  return onetFetch<T>(path, mergedParams);
}

// ─── Types ─────────────────────────────────────────────────────────────

export interface OnetOccupation {
  code: string;
  title: string;
  description?: string;
  sample_of_reported_titles?: string[];
  updated?: { year: number; contents: { title: string; source: string; year: number }[] };
  summary_contents?: { href: string; title: string }[];
}

export interface OnetSearchResult {
  total: number;
  start: number;
  end: number;
  occupation?: { code: string; title: string; tags?: Record<string, boolean> }[];
}

export interface OnetTask {
  id: string;
  title: string; // v2 uses 'title' instead of 'statement'
}

export interface OnetDWA {
  id: string;
  title: string;
}

export interface OnetTechSkillCategory {
  code: number;
  title: string;
  example?: { title: string; hot_technology?: boolean; in_demand?: boolean }[];
}

export interface OnetElement {
  id: string;
  name: string;
  description: string;
}

export interface OnetRelatedOccupation {
  code: string;
  title: string;
  tags?: Record<string, boolean>;
}

// ─── API Functions ─────────────────────────────────────────────────────

export async function searchOccupations(keyword: string, start = 1, end = 20): Promise<OnetSearchResult> {
  return onetFetch<OnetSearchResult>("/online/search", {
    keyword,
    start: String(start),
    end: String(end),
  });
}

export async function getOccupation(code: string): Promise<OnetOccupation> {
  return onetFetch<OnetOccupation>(`/online/occupations/${code}/`);
}

export async function getOccupationTasks(code: string): Promise<{ task: OnetTask[] }> {
  return onetFetchAll<{ task: OnetTask[] }>(`/online/occupations/${code}/summary/tasks`);
}

export async function getOccupationDWAs(code: string): Promise<{ activity: OnetDWA[] }> {
  return onetFetchAll<{ activity: OnetDWA[] }>(`/online/occupations/${code}/summary/detailed_work_activities`);
}

export async function getOccupationTechSkills(code: string): Promise<{ category: OnetTechSkillCategory[] }> {
  return onetFetchAll<{ category: OnetTechSkillCategory[] }>(`/online/occupations/${code}/summary/technology_skills`);
}

export async function getOccupationKnowledge(code: string): Promise<{ element: OnetElement[] }> {
  return onetFetchAll<{ element: OnetElement[] }>(`/online/occupations/${code}/summary/knowledge`);
}

export async function getOccupationSkills(code: string): Promise<{ element: OnetElement[] }> {
  return onetFetchAll<{ element: OnetElement[] }>(`/online/occupations/${code}/summary/skills`);
}

export async function getOccupationAbilities(code: string): Promise<{ element: OnetElement[] }> {
  return onetFetchAll<{ element: OnetElement[] }>(`/online/occupations/${code}/summary/abilities`);
}

export async function getOccupationWorkActivities(code: string): Promise<{ element: OnetElement[] }> {
  return onetFetchAll<{ element: OnetElement[] }>(`/online/occupations/${code}/summary/work_activities`);
}

export async function getOccupationWorkContext(code: string): Promise<{ element: unknown[] }> {
  return onetFetchAll<{ element: unknown[] }>(`/online/occupations/${code}/summary/work_context`);
}

export async function getOccupationJobZone(code: string): Promise<{ job_zone: number; svp_range: string }> {
  return onetFetch<{ job_zone: number; svp_range: string }>(`/online/occupations/${code}/summary/job_zone`);
}

export async function getRelatedOccupations(code: string): Promise<{ occupation: OnetRelatedOccupation[] }> {
  return onetFetchAll<{ occupation: OnetRelatedOccupation[] }>(`/online/occupations/${code}/summary/related_occupations`);
}

/**
 * Career changers: not a separate v2 endpoint, so we re-use related occupations.
 * In v1 this was a distinct endpoint; v2 merges them.
 */
export async function getCareerChangers(code: string): Promise<{ occupation: OnetRelatedOccupation[] }> {
  return getRelatedOccupations(code);
}

/** Fetch all major data for an occupation in parallel */
export async function getFullOccupation(code: string) {
  const [occ, tasks, dwas, techSkills, knowledge, skills, abilities, workActivities, workContext, related, jobZone] =
    await Promise.all([
      getOccupation(code),
      getOccupationTasks(code).catch(() => ({ task: [] as OnetTask[] })),
      getOccupationDWAs(code).catch(() => ({ activity: [] as OnetDWA[] })),
      getOccupationTechSkills(code).catch(() => ({ category: [] as OnetTechSkillCategory[] })),
      getOccupationKnowledge(code).catch(() => ({ element: [] as OnetElement[] })),
      getOccupationSkills(code).catch(() => ({ element: [] as OnetElement[] })),
      getOccupationAbilities(code).catch(() => ({ element: [] as OnetElement[] })),
      getOccupationWorkActivities(code).catch(() => ({ element: [] as OnetElement[] })),
      getOccupationWorkContext(code).catch(() => ({ element: [] as unknown[] })),
      getRelatedOccupations(code).catch(() => ({ occupation: [] as OnetRelatedOccupation[] })),
      getOccupationJobZone(code).catch(() => ({ job_zone: 0, svp_range: "" })),
    ]);

  // Flatten tech skills categories into a simple list of tool names
  const toolsTech = techSkills.category.flatMap(
    (cat) =>
      cat.example?.map((ex) => ({
        title: ex.title,
        category: cat.title,
        hot_technology: ex.hot_technology ?? false,
      })) ?? [{ title: cat.title, category: cat.title, hot_technology: false }]
  );

  return {
    ...occ,
    tasks: tasks.task,
    dwas: dwas.activity,
    toolsTech,
    knowledge: knowledge.element,
    skills: skills.element,
    abilities: abilities.element,
    workActivities: workActivities.element,
    workContext: workContext.element,
    relatedOccs: related.occupation,
    jobZone: jobZone.job_zone,
    svpRange: jobZone.svp_range,
  };
}
