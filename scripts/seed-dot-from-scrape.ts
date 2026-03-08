import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import * as path from "path";

const INPUT_FILE = path.join(__dirname, "../data/dot/all_occupations.json");
const BATCH_SIZE = 100;

/**
 * Map strength letter to standard format
 */
function normalizeStrength(s: string | null): string {
  if (!s) return "S";
  const map: Record<string, string> = {
    S: "S",
    L: "L",
    M: "M",
    H: "H",
    V: "V",
  };
  return map[s.toUpperCase()] || s;
}

async function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Input file not found: ${INPUT_FILE}`);
    console.error("Run the scraper first: python3 scripts/scrape-dot.py");
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  console.log("Loading scraped DOT data from JSON...\n");

  const raw = JSON.parse(fs.readFileSync(INPUT_FILE, "utf-8"));
  const occupations = raw.occupations as Record<
    string,
    {
      dot_code: string;
      title: string;
      industry_desig: string | null;
      description: string | null;
      goe: string | null;
      strength: string | null;
      ged_r: number | null;
      ged_m: number | null;
      ged_l: number | null;
      svp: number | null;
      dlu: string | null;
      onet_crosswalk: string | null;
      dpt: { data: number; people: number; things: number } | null;
      alternate_titles: string[];
    }
  >;

  const codes = Object.keys(occupations);
  console.log(`Found ${codes.length} occupations in JSON file`);
  console.log(`Loading in batches of ${BATCH_SIZE}...\n`);

  let loaded = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < codes.length; i += BATCH_SIZE) {
    const batch = codes.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (code) => {
      const occ = occupations[code];
      try {
        // Validate required fields
        if (!occ.dot_code || !occ.title) {
          skipped++;
          return;
        }

        // Build aptitudes object (worker functions from DPT + GOE)
        const aptitudes: Record<string, unknown> = {};
        if (occ.dpt) {
          aptitudes.workerFunctions = occ.dpt;
        }
        if (occ.goe) {
          aptitudes.goe = occ.goe;
        }

        // Build physical demands
        const physicalDemands: Record<string, unknown> = {
          strength: normalizeStrength(occ.strength),
        };

        await prisma.occupationDOT.upsert({
          where: { id: occ.dot_code },
          update: {
            title: occ.title,
            industryDesig: occ.industry_desig || null,
            svp: occ.svp || 1,
            strength: normalizeStrength(occ.strength),
            gedR: occ.ged_r || 1,
            gedM: occ.ged_m || 1,
            gedL: occ.ged_l || 1,
            aptitudes,
            temperaments: [],
            interests: [],
            physicalDemands,
            envConditions: {},
            workFields: [],
            mpsms: [],
            dlu: occ.dlu || null,
          },
          create: {
            id: occ.dot_code,
            title: occ.title,
            industryDesig: occ.industry_desig || null,
            svp: occ.svp || 1,
            strength: normalizeStrength(occ.strength),
            gedR: occ.ged_r || 1,
            gedM: occ.ged_m || 1,
            gedL: occ.ged_l || 1,
            aptitudes,
            temperaments: [],
            interests: [],
            physicalDemands,
            envConditions: {},
            workFields: [],
            mpsms: [],
            dlu: occ.dlu || null,
          },
        });

        loaded++;
      } catch (err: unknown) {
        errors++;
        if (errors <= 10) {
          console.error(`  ✗ Error on ${occ.dot_code}: ${err}`);
        }
      }
    });

    await Promise.all(promises);

    const pct = (((i + batch.length) / codes.length) * 100).toFixed(1);
    process.stdout.write(
      `\r  Progress: ${loaded} loaded, ${skipped} skipped, ${errors} errors (${pct}%)`
    );
  }

  console.log("\n");

  // Also seed O*NET crosswalk data where we have it
  console.log("Seeding DOT→O*NET crosswalk entries...");

  let xwLoaded = 0;
  let xwSkipped = 0;

  for (const code of codes) {
    const occ = occupations[code];
    if (!occ.onet_crosswalk || !occ.dot_code) continue;

    // The occupationalinfo.org O*NET codes are in old format (e.g., "21114A")
    // We'll store these as-is for now — they can be mapped to modern O*NET-SOC later
    // Skip crosswalk if the O*NET occupation doesn't exist in our DB
    try {
      const onetExists = await prisma.occupationONET.findUnique({
        where: { id: occ.onet_crosswalk },
        select: { id: true },
      });
      if (!onetExists) {
        xwSkipped++;
        continue;
      }

      await prisma.dOTONETCrosswalk.upsert({
        where: {
          dotCode_onetSocCode: {
            dotCode: occ.dot_code,
            onetSocCode: occ.onet_crosswalk,
          },
        },
        update: {},
        create: {
          dotCode: occ.dot_code,
          onetSocCode: occ.onet_crosswalk,
        },
      });
      xwLoaded++;
    } catch {
      xwSkipped++;
    }
  }

  console.log(`  Crosswalks: ${xwLoaded} loaded, ${xwSkipped} skipped (O*NET codes not in DB)\n`);

  // Verify
  const totalCount = await prisma.occupationDOT.count();
  console.log(`\nTotal DOT occupations in database: ${totalCount}`);

  // Sample some entries
  const samples = await prisma.occupationDOT.findMany({
    take: 5,
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      svp: true,
      strength: true,
      gedR: true,
      gedM: true,
      gedL: true,
    },
  });
  console.log("\nSample entries:");
  for (const s of samples) {
    console.log(
      `  ${s.id} - ${s.title} (SVP: ${s.svp}, Str: ${s.strength}, GED: R${s.gedR} M${s.gedM} L${s.gedL})`
    );
  }

  await prisma.$disconnect();
}

main().catch(console.error);
