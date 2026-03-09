/**
 * Sync ALL O*NET occupations from the API into the local database.
 *
 * The O*NET API has ~1,016 occupations. This script fetches them all
 * (in batches of 100) and upserts them into OccupationONET.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." ONET_API_KEY="..." npx tsx scripts/sync-all-onet.ts
 */

import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ONET_BASE = "https://api-v2.onetcenter.org";
const API_KEY = process.env.ONET_API_KEY;

if (!API_KEY) {
  console.error("ONET_API_KEY environment variable is required");
  process.exit(1);
}

interface OnetListItem {
  code: string;
  title: string;
  tags?: Record<string, boolean>;
  zone?: { code: number; title: string };
}

interface OnetListResponse {
  start: number;
  end: number;
  total: number;
  next?: string;
  occupation: OnetListItem[];
}

async function fetchOnetPage(start: number, end: number): Promise<OnetListResponse> {
  const url = `${ONET_BASE}/online/occupations/?start=${start}&end=${end}`;
  const res = await fetch(url, {
    headers: {
      "X-API-Key": API_KEY!,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`O*NET API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function main() {
  console.log("Fetching all O*NET occupations from API...");

  const allOccs: OnetListItem[] = [];
  let start = 1;
  const batchSize = 100;
  let total = 0;

  // Fetch all pages
  while (true) {
    const end = start + batchSize - 1;
    const page = await fetchOnetPage(start, end);
    total = page.total;
    allOccs.push(...page.occupation);
    console.log(`  Fetched ${allOccs.length} / ${total}`);

    if (!page.next || allOccs.length >= total) break;
    start = end + 1;

    // Small delay to be nice to the API
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\nTotal O*NET occupations fetched: ${allOccs.length}`);

  // Upsert into database
  let processed = 0;

  for (const occ of allOccs) {
    const jobZone = occ.zone?.code ?? null;

    try {
      await prisma.occupationONET.upsert({
        where: { id: occ.code },
        create: {
          id: occ.code,
          title: occ.title,
          jobZone,
        },
        update: {
          title: occ.title,
          jobZone: jobZone ?? undefined,
        },
      });
      processed++;
    } catch (e) {
      console.error(`  Failed to upsert ${occ.code}: ${(e as Error).message}`);
    }
  }

  const finalCount = await prisma.occupationONET.count();
  console.log(`\nDone! Database now has ${finalCount} O*NET occupations (was 184).`);
  console.log(`  Processed: ${processed} / ${allOccs.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
