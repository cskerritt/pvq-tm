/**
 * Seed DOT→O*NET crosswalk by matching DOT occupation titles to O*NET occupations.
 *
 * The original scraped data has old OES codes (e.g., "22302") that don't match
 * modern O*NET-SOC codes (e.g., "17-1011.00"). This script builds the crosswalk
 * by finding O*NET occupations with matching/similar titles.
 *
 * Run: npx tsx scripts/seed-dot-crosswalk.ts
 */
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  console.log("Building DOT→O*NET crosswalk by title matching...\n");

  // Get all O*NET occupations
  const onetOccs = await prisma.occupationONET.findMany({
    select: { id: true, title: true },
  });
  console.log(`Found ${onetOccs.length} O*NET occupations`);

  // Get all DOT occupations
  const dotOccs = await prisma.occupationDOT.findMany({
    select: { id: true, title: true },
  });
  console.log(`Found ${dotOccs.length} DOT occupations`);

  // Build a normalized title index for O*NET
  const onetByTitle = new Map<string, string[]>();
  for (const occ of onetOccs) {
    const normalized = normalizeTitle(occ.title);
    const words = normalized.split(/\s+/);
    // Index by each significant word
    for (const word of words) {
      if (word.length >= 3) {
        const existing = onetByTitle.get(word) ?? [];
        existing.push(occ.id);
        onetByTitle.set(word, existing);
      }
    }
  }

  // For each DOT occupation, find matching O*NET occupations
  let matched = 0;
  let unmatched = 0;
  let created = 0;

  for (let i = 0; i < dotOccs.length; i++) {
    const dot = dotOccs[i];
    const dotNorm = normalizeTitle(dot.title);
    const dotWords = dotNorm.split(/\s+/).filter((w) => w.length >= 3);

    // Score each O*NET occupation by word overlap
    const scores = new Map<string, number>();
    for (const word of dotWords) {
      const candidates = onetByTitle.get(word) ?? [];
      for (const onetId of candidates) {
        scores.set(onetId, (scores.get(onetId) ?? 0) + 1);
      }
    }

    // Find best match (must match at least 1 significant word)
    let bestId = "";
    let bestScore = 0;
    for (const [id, score] of scores) {
      if (score > bestScore) {
        bestScore = score;
        bestId = id;
      }
    }

    // Also try exact/substring matching for better accuracy
    if (bestScore < 2) {
      for (const occ of onetOccs) {
        const onetNorm = normalizeTitle(occ.title);
        if (dotNorm.includes(onetNorm) || onetNorm.includes(dotNorm)) {
          bestId = occ.id;
          bestScore = 100; // Perfect match
          break;
        }
      }
    }

    if (bestId && bestScore >= 1) {
      matched++;
      try {
        await prisma.dOTONETCrosswalk.upsert({
          where: {
            dotCode_onetSocCode: {
              dotCode: dot.id,
              onetSocCode: bestId,
            },
          },
          update: {},
          create: {
            dotCode: dot.id,
            onetSocCode: bestId,
          },
        });
        created++;
      } catch {
        // Skip duplicates or foreign key errors
      }
    } else {
      unmatched++;
    }

    if ((i + 1) % 500 === 0) {
      process.stdout.write(
        `\r  Progress: ${i + 1}/${dotOccs.length} (${matched} matched, ${unmatched} unmatched, ${created} created)`
      );
    }
  }

  console.log(
    `\n\nDone! ${matched} matched, ${unmatched} unmatched, ${created} crosswalk entries created`
  );

  // Verify
  const xwCount = await prisma.dOTONETCrosswalk.count();
  console.log(`Total crosswalk entries in database: ${xwCount}`);

  // Show sample entries
  const samples = await prisma.dOTONETCrosswalk.findMany({
    take: 10,
    include: {
      dotOcc: { select: { title: true, svp: true, strength: true } },
      onetOcc: { select: { title: true } },
    },
  });
  console.log("\nSample crosswalk entries:");
  for (const s of samples) {
    console.log(
      `  DOT ${s.dotCode} (${s.dotOcc.title}) → O*NET ${s.onetSocCode} (${s.onetOcc.title})`
    );
  }

  await prisma.$disconnect();
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

main().catch(console.error);
