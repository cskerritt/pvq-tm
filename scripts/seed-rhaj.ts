import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import * as path from "path";

const PARSED_DIR = path.join(__dirname, "../data/rhaj/parsed");

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  const entries: {
    id: string;
    category: string;
    title: string;
    file: string;
    source: string;
  }[] = [
    {
      id: "dpt",
      category: "worker_functions",
      title: "Worker Functions — Data, People, Things",
      file: "ch3_dpt.json",
      source: "RHAJ Ch. 3: Worker Functions (DOL, 1991)",
    },
    {
      id: "ged",
      category: "worker_characteristics",
      title: "General Educational Development — Reasoning, Math, Language",
      file: "ch7_ged.json",
      source: "RHAJ Ch. 7: GED (DOL, 1991)",
    },
    {
      id: "svp",
      category: "worker_characteristics",
      title: "Specific Vocational Preparation",
      file: "ch8_svp.json",
      source: "RHAJ Ch. 8: SVP (DOL, 1991)",
    },
    {
      id: "aptitudes",
      category: "worker_characteristics",
      title: "Aptitudes (G, V, N, S, P, Q, K, F, M, E, C)",
      file: "ch9_aptitudes.json",
      source: "RHAJ Ch. 9: Aptitudes (DOL, 1991)",
    },
    {
      id: "temperaments",
      category: "worker_characteristics",
      title: "Temperaments (Adaptability Requirements)",
      file: "ch10_temperaments.json",
      source: "RHAJ Ch. 10: Temperaments (DOL, 1991)",
    },
    {
      id: "physical_demands",
      category: "worker_characteristics",
      title: "Physical Demands and Environmental Conditions",
      file: "ch12_physical_env.json",
      source: "RHAJ Ch. 12: Physical Demands & Environmental Conditions (DOL, 1991)",
    },
    {
      id: "work_fields",
      category: "job_content",
      title: "Work Fields",
      file: "ch4_work_fields.json",
      source: "RHAJ Ch. 4: Work Fields (DOL, 1991)",
    },
    {
      id: "mpsms",
      category: "job_content",
      title: "Materials, Products, Subject Matter, and Services",
      file: "ch5_mpsms.json",
      source: "RHAJ Ch. 5: MPSMS (DOL, 1991)",
    },
  ];

  console.log("Loading RHAJ reference data into database...\n");

  let loaded = 0;
  let skipped = 0;

  for (const entry of entries) {
    const filePath = path.join(PARSED_DIR, entry.file);
    if (!fs.existsSync(filePath)) {
      console.log(`  ⏭ Skipping ${entry.id} — ${entry.file} not yet available`);
      skipped++;
      continue;
    }

    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    await prisma.rHAJReference.upsert({
      where: { id: entry.id },
      update: {
        category: entry.category,
        title: entry.title,
        data,
        source: entry.source,
      },
      create: {
        id: entry.id,
        category: entry.category,
        title: entry.title,
        data,
        source: entry.source,
      },
    });

    const sizeKB = (fs.statSync(filePath).size / 1024).toFixed(1);
    console.log(`  ✓ ${entry.id} — ${entry.title} (${sizeKB} KB)`);
    loaded++;
  }

  console.log(`\nLoaded: ${loaded}, Skipped: ${skipped}`);

  // Verify
  const count = await prisma.rHAJReference.count();
  const all = await prisma.rHAJReference.findMany({
    select: { id: true, category: true, title: true },
  });
  console.log(`\nTotal RHAJ reference entries in database: ${count}`);
  for (const r of all) {
    console.log(`  ${r.id} [${r.category}] — ${r.title}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
