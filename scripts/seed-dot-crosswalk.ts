/**
 * Seed DOT→O*NET crosswalk by matching DOT occupation titles to O*NET occupations.
 *
 * Matching strategy (in priority order):
 * 1. Exact title match (normalized)
 * 2. DOT title is substring of O*NET title or vice versa
 * 3. High word overlap (≥60% of significant words match)
 *
 * Run:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/seed-dot-crosswalk.ts
 */
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

// Common words to ignore when matching
const STOP_WORDS = new Set([
  "and", "the", "for", "all", "any", "not", "nor", "but", "yet",
  "other", "except", "general", "special", "first", "second", "third",
  "chief", "head", "lead", "senior", "junior", "apprentice", "helper",
  "worker", "operator", "supervisor", "manager", "director", "assistant",
  "aide", "attendant", "clerk", "technician", "specialist",
]);

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSignificantWords(title: string): string[] {
  return normalizeTitle(title)
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

function titleSimilarity(dotTitle: string, onetTitle: string): number {
  const dotNorm = normalizeTitle(dotTitle);
  const onetNorm = normalizeTitle(onetTitle);

  // Exact match
  if (dotNorm === onetNorm) return 1.0;

  // Substring containment
  if (dotNorm.includes(onetNorm) || onetNorm.includes(dotNorm)) return 0.9;

  // Word overlap
  const dotWords = getSignificantWords(dotTitle);
  const onetWords = new Set(getSignificantWords(onetTitle));

  if (dotWords.length === 0 || onetWords.size === 0) return 0;

  let matches = 0;
  for (const w of dotWords) {
    if (onetWords.has(w)) matches++;
  }

  // Require at least 2 matching words for word-based matching
  if (matches < 2) return 0;

  // Use Jaccard-like similarity
  const totalUnique = new Set([...dotWords, ...onetWords]).size;
  return matches / totalUnique;
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  console.log("Building DOT→O*NET crosswalk by title matching...\n");

  // Clear existing crosswalk
  const existingCount = await prisma.dOTONETCrosswalk.count();
  if (existingCount > 0) {
    console.log(`Clearing ${existingCount} existing crosswalk entries...`);
    await prisma.dOTONETCrosswalk.deleteMany({});
  }

  // Get all O*NET occupations
  const onetOccs = await prisma.occupationONET.findMany({
    select: { id: true, title: true },
  });
  console.log(`Found ${onetOccs.length} O*NET occupations`);

  // Get all DOT occupations
  const dotOccs = await prisma.occupationDOT.findMany({
    select: { id: true, title: true },
  });
  console.log(`Found ${dotOccs.length} DOT occupations\n`);

  // Build word index for O*NET for fast lookups
  const onetByWord = new Map<string, Set<number>>();
  for (let i = 0; i < onetOccs.length; i++) {
    const words = getSignificantWords(onetOccs[i].title);
    for (const word of words) {
      if (!onetByWord.has(word)) onetByWord.set(word, new Set());
      onetByWord.get(word)!.add(i);
    }
  }

  // For each DOT occupation, find best matching O*NET occupation
  let matched = 0;
  let unmatched = 0;
  const crosswalkEntries: { dotCode: string; onetSocCode: string }[] = [];

  for (let i = 0; i < dotOccs.length; i++) {
    const dot = dotOccs[i];

    // Get candidate O*NET indices using word index
    const candidateIndices = new Set<number>();
    const dotWords = getSignificantWords(dot.title);
    for (const word of dotWords) {
      const indices = onetByWord.get(word);
      if (indices) {
        for (const idx of indices) candidateIndices.add(idx);
      }
    }

    // Score each candidate
    let bestIdx = -1;
    let bestScore = 0;

    for (const idx of candidateIndices) {
      const score = titleSimilarity(dot.title, onetOccs[idx].title);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    }

    // Also try all O*NET for substring match if no good word match
    if (bestScore < 0.4) {
      const dotNorm = normalizeTitle(dot.title);
      for (let j = 0; j < onetOccs.length; j++) {
        const onetNorm = normalizeTitle(onetOccs[j].title);
        if (dotNorm.includes(onetNorm) || onetNorm.includes(dotNorm)) {
          bestIdx = j;
          bestScore = 0.9;
          break;
        }
      }
    }

    // Only accept matches with score ≥ 0.3 (at least 30% word overlap)
    if (bestIdx >= 0 && bestScore >= 0.3) {
      matched++;
      crosswalkEntries.push({
        dotCode: dot.id,
        onetSocCode: onetOccs[bestIdx].id,
      });
    } else {
      unmatched++;
    }

    if ((i + 1) % 1000 === 0 || i === dotOccs.length - 1) {
      process.stdout.write(
        `\r  Progress: ${i + 1}/${dotOccs.length} — ${matched} matched, ${unmatched} unmatched`
      );
    }
  }

  console.log("\n\nInserting crosswalk entries...");

  // Batch insert
  let inserted = 0;
  const batchSize = 500;
  for (let i = 0; i < crosswalkEntries.length; i += batchSize) {
    const batch = crosswalkEntries.slice(i, i + batchSize);
    try {
      await prisma.dOTONETCrosswalk.createMany({
        data: batch,
        skipDuplicates: true,
      });
      inserted += batch.length;
    } catch (e) {
      // Fall back to individual inserts on error
      for (const entry of batch) {
        try {
          await prisma.dOTONETCrosswalk.create({ data: entry });
          inserted++;
        } catch {
          // Skip
        }
      }
    }
    process.stdout.write(`\r  Inserted: ${inserted} / ${crosswalkEntries.length}`);
  }

  const xwCount = await prisma.dOTONETCrosswalk.count();
  console.log(`\n\nDone! Total crosswalk entries in database: ${xwCount}`);
  console.log(`  Matched: ${matched}, Unmatched: ${unmatched}`);

  // Show some statistics
  const onetCodesUsed = new Set(crosswalkEntries.map((e) => e.onetSocCode));
  console.log(`  Unique O*NET codes linked: ${onetCodesUsed.size} / ${onetOccs.length}`);

  // Show sample entries
  const samples = await prisma.dOTONETCrosswalk.findMany({
    take: 15,
    include: {
      dotOcc: { select: { title: true, svp: true, strength: true } },
      onetOcc: { select: { title: true } },
    },
    orderBy: { dotCode: "asc" },
  });
  console.log("\nSample crosswalk entries:");
  for (const s of samples) {
    console.log(
      `  DOT ${s.dotCode} "${s.dotOcc.title}" (SVP ${s.dotOcc.svp}) → O*NET ${s.onetSocCode} "${s.onetOcc.title}"`
    );
  }

  await prisma.$disconnect();
}

main().catch(console.error);
