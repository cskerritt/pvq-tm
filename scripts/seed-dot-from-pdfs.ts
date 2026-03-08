import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  // ============================================================
  // Data extracted from PDF: umn-31951d00357017o-19-1772991867.pdf
  // Dictionary of Occupational Titles, 4th Edition Revised (1991)
  // Page: "PARTS OF THE OCCUPATIONAL DEFINITION" (p. xvii)
  // ============================================================

  const occupations = [
    {
      // Primary occupation fully defined on the page
      id: "652.382-010",
      title: "CLOTH PRINTER",
      industryDesig: "any industry",
      svp: 7,
      strength: "M",
      gedR: 4,
      gedM: 1,
      gedL: 3,
      aptitudes: {
        workerFunctions: { data: 3, people: 8, things: 2 },
        goe: "06.02.09",
      },
      temperaments: [] as string[],
      interests: [] as string[],
      physicalDemands: { strength: "M" },
      envConditions: {},
      workFields: [] as string[],
      mpsms: [] as string[],
      dlu: "77",
    },
    {
      // Referenced in CLOTH PRINTER definition
      id: "022.161-014",
      title: "COLORIST",
      industryDesig: "profess. & kin.",
      svp: 7,
      strength: "S",
      gedR: 6,
      gedM: 4,
      gedL: 5,
      aptitudes: {
        workerFunctions: { data: 0, people: 1, things: 6 },
        note: "Inferred from DOT code - not from full definition",
      },
      temperaments: [] as string[],
      interests: [] as string[],
      physicalDemands: { strength: "S" },
      envConditions: {},
      workFields: [] as string[],
      mpsms: [] as string[],
      dlu: null as string | null,
    },
    {
      // Referenced in CLOTH PRINTER definition
      id: "652.385-010",
      title: "PRINTING-ROLLER HANDLER",
      industryDesig: "textile",
      svp: 5,
      strength: "M",
      gedR: 3,
      gedM: 1,
      gedL: 2,
      aptitudes: {
        workerFunctions: { data: 3, people: 8, things: 5 },
        note: "Inferred from DOT code - not from full definition",
      },
      temperaments: [] as string[],
      interests: [] as string[],
      physicalDemands: { strength: "M" },
      envConditions: {},
      workFields: [] as string[],
      mpsms: [] as string[],
      dlu: null as string | null,
    },
  ];

  console.log("Inserting DOT occupations extracted from PDFs...\n");

  for (const occ of occupations) {
    const result = await prisma.occupationDOT.upsert({
      where: { id: occ.id },
      update: {
        title: occ.title,
        industryDesig: occ.industryDesig,
        svp: occ.svp,
        strength: occ.strength,
        gedR: occ.gedR,
        gedM: occ.gedM,
        gedL: occ.gedL,
        aptitudes: occ.aptitudes,
        temperaments: occ.temperaments,
        interests: occ.interests,
        physicalDemands: occ.physicalDemands,
        envConditions: occ.envConditions,
        workFields: occ.workFields,
        mpsms: occ.mpsms,
        dlu: occ.dlu,
      },
      create: occ,
    });
    console.log(`  ✓ ${result.id} - ${result.title} (SVP: ${result.svp}, Strength: ${result.strength}, GED: R${result.gedR} M${result.gedM} L${result.gedL})`);
  }

  // Verify
  const count = await prisma.occupationDOT.count();
  console.log(`\nTotal DOT occupations in database: ${count}`);

  await prisma.$disconnect();
}

main().catch(console.error);
