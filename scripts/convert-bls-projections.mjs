#!/usr/bin/env node
/**
 * convert-bls-projections.mjs
 *
 * Parses the BLS "Occupational projections and worker characteristics"
 * XLSX file and outputs compact JSON for the app to consume.
 *
 * Source: https://www.bls.gov/emp/tables/occupational-projections-and-characteristics.htm
 *   → Download the XLSX version of Table 1.10
 *
 * Usage:
 *   node scripts/convert-bls-projections.mjs <path-to-xlsx>
 *
 * Output: src/data/bls-projections.json
 *
 * The BLS table contains both "Summary" rows (aggregates for major groups)
 * and "Line item" rows (detailed occupations). We only extract Line items.
 *
 * Employment and openings figures are published in THOUSANDS — this script
 * multiplies by 1,000 to store absolute counts.
 *
 * Output format (keyed by 7-char SOC code "XX-XXXX"):
 * {
 *   "11-1021": {
 *     "t": "General and Operations Managers",  // title
 *     "be": 3712900,   // base year employment (2024)
 *     "pe": 3876800,   // projected year employment (2034)
 *     "cn": 164000,    // employment change, numeric
 *     "cp": 4.4,       // employment change, percent
 *     "oa": 308700     // annual openings (avg 2024-34)
 *   }
 * }
 */

import { readFile, writeFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const xlsxPath = process.argv[2];
  if (!xlsxPath) {
    console.error("Usage: node scripts/convert-bls-projections.mjs <path-to-xlsx>");
    console.error("Download from: https://www.bls.gov/emp/tables/occupational-projections-and-characteristics.htm");
    process.exit(1);
  }

  // Dynamic import of xlsx package
  const XLSX = await import("xlsx");

  const workbook = XLSX.readFile(resolve(xlsxPath));
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  // Find the header row (contains "National Employment Matrix code")
  let headerIdx = -1;
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const row = rows[i].map((c) => String(c).toLowerCase());
    if (row.some((c) => c.includes("matrix code") || c.includes("soc code"))) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    console.error("Could not find header row. First 5 rows:");
    rows.slice(0, 5).forEach((r, i) => console.error(`  Row ${i}:`, r.slice(0, 5)));
    process.exit(1);
  }

  const headers = rows[headerIdx].map((h) => String(h).toLowerCase().trim());
  console.log(`Found headers at row ${headerIdx}:`, headers.slice(0, 6));

  // Map column indices
  const colIdx = {
    title: headers.findIndex((h) => h.includes("title") || h.includes("matrix title")),
    code: headers.findIndex((h) => h.includes("code")),
    type: headers.findIndex((h) => h.includes("type")),
    emp2024: headers.findIndex((h) => h.includes("employment") && !h.includes("change") && !h.includes("distribution")),
    changePct: headers.findIndex((h) => h.includes("change") && h.includes("percent")),
    changeN: headers.findIndex((h) => h.includes("change") && h.includes("numeric")),
    openings: headers.findIndex((h) => h.includes("openings")),
  };

  // Employment 2034 is typically the column after 2024
  colIdx.emp2034 = colIdx.emp2024 + 1;

  console.log("Column indices:", colIdx);

  const result = {};
  let skipped = 0;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const occType = String(row[colIdx.type] || "").trim();
    if (occType !== "Line item") {
      skipped++;
      continue;
    }

    const socCode = String(row[colIdx.code] || "").trim();
    if (!socCode.match(/^\d{2}-\d{4}$/)) continue;

    const parseNum = (val) => {
      if (val === null || val === undefined || val === "—" || val === "") return null;
      const n = parseFloat(String(val).replace(/,/g, ""));
      return isNaN(n) ? null : n;
    };

    const title = String(row[colIdx.title] || "").trim();
    const emp2024 = parseNum(row[colIdx.emp2024]);
    const emp2034 = parseNum(row[colIdx.emp2034]);
    const changeN = parseNum(row[colIdx.changeN]);
    const changePct = parseNum(row[colIdx.changePct]);
    const openings = parseNum(row[colIdx.openings]);

    result[socCode] = {
      t: title,
      be: emp2024 !== null ? Math.round(emp2024 * 1000) : null,
      pe: emp2034 !== null ? Math.round(emp2034 * 1000) : null,
      cn: changeN !== null ? Math.round(changeN * 1000) : null,
      cp: changePct,
      oa: openings !== null ? Math.round(openings * 1000) : null,
    };
  }

  const outPath = resolve(__dirname, "../src/data/bls-projections.json");
  await writeFile(outPath, JSON.stringify(result));
  console.log(`\nWrote ${Object.keys(result).length} occupations to ${outPath}`);
  console.log(`Skipped ${skipped} summary/aggregate rows`);

  // Spot checks
  const checks = [
    ["49-9081", "Wind turbine service technicians"],
    ["41-2031", "Retail salespersons"],
    ["29-1141", "Registered nurses"],
    ["15-1252", "Software developers"],
  ];
  console.log("\nSpot checks:");
  for (const [code, label] of checks) {
    const entry = result[code];
    if (entry) {
      console.log(`  ${code} (${label}): growth=${entry.cp}%, openings=${entry.oa}`);
    } else {
      console.log(`  ${code} (${label}): NOT FOUND`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
