/**
 * Build Unified Occupation Dataset
 *
 * Merges DOT + O*NET + ORS + OEWS + BLS Projections into a single
 * pre-computed JSON file: src/data/unified-occupations.json
 *
 * Each O*NET-SOC code becomes one UnifiedOccupation record with:
 * - Pre-computed 24-trait demand vector (source provenance per trait)
 * - VQ score and band (McCroskey regression)
 * - Wages, employment, projections (OEWS/BLS)
 * - DOT title drill-down
 * - O*NET content (tasks, DWAs, tools)
 *
 * Usage: npx tsx scripts/build-unified/build.ts
 */

import * as fs from "fs";
import * as path from "path";
import {
  loadDOT, loadONETFull, loadOEWS, loadORS,
  loadBLSProjections, loadONETOccupations,
} from "./load-data";
import { buildDOTToONETMap } from "./crosswalk";
import { buildTraitVectorWithDOT, TRAIT_KEYS } from "./compute-traits";
import { computeVQ } from "./compute-vq";
import type { UnifiedOccupation, DOTTitleEntry } from "./types";

// ─── Main Build ────────────────────────────────────────────────────

function main() {
  console.log("=== Building Unified Occupation Dataset ===\n");

  // Step 1: Load all data sources
  console.log("Loading data sources...");
  const dot = loadDOT();
  const onetFull = loadONETFull();
  const onetOcc = loadONETOccupations();
  const oews = loadOEWS();
  const ors = loadORS();
  const bls = loadBLSProjections();
  console.log(`  DOT: ${Object.keys(dot).length} entries`);
  console.log(`  O*NET: ${Object.keys(onetFull).length} entries`);
  console.log(`  OEWS: ${Object.keys(oews).length} entries`);
  console.log(`  ORS: ${Object.keys(ors).length} entries`);
  console.log(`  BLS: ${Object.keys(bls).length} entries`);

  // Step 2: Build DOT → O*NET crosswalk
  console.log("\nBuilding DOT→O*NET crosswalk...");
  const dotToOnet = buildDOTToONETMap(dot, onetFull);

  // Step 3: Build unified records
  console.log("\nBuilding unified occupation records...");
  const unified: UnifiedOccupation[] = [];
  let orsHits = 0;
  let dotHits = 0;
  let oewsHits = 0;
  let blsHits = 0;

  const onetCodes = Object.keys(onetFull).sort();

  for (const onetCode of onetCodes) {
    const onet = onetFull[onetCode];
    const socCode = onetCode.replace(/\.\d+$/, ""); // "11-1021.00" → "11-1021"
    const socCompact = socCode.replace("-", "");      // "111021" for ORS lookup

    // ORS lookup
    const orsEntry = ors[socCompact] || null;
    if (orsEntry) orsHits++;

    // DOT mappings
    const dotMappings = dotToOnet.get(onetCode) || [];
    if (dotMappings.length > 0) dotHits++;

    // Build trait vector
    const traits = buildTraitVectorWithDOT(onet, orsEntry, dotMappings, dot);

    // Compute VQ
    const vq = computeVQ(traits);

    // SVP from DOT titles
    const svps = dotMappings.map(d => d.svp).filter(s => s > 0);
    const svp = svps.length > 0 ? Math.max(...svps) : (onetOcc[onetCode]?.jz ? onetOcc[onetCode].jz! * 2 : 4);
    const svpRange: [number, number] = svps.length > 0
      ? [Math.min(...svps), Math.max(...svps)]
      : [svp, svp];

    // Strength from DOT titles
    const strengths = dotMappings.map(d => d.strength);
    const strengthMap: Record<string, number> = { S: 0, L: 1, M: 2, H: 3, V: 4 };
    const strengthLevel = strengths.length > 0
      ? strengths.reduce((max, s) => (strengthMap[s] ?? 0) > (strengthMap[max] ?? 0) ? s : max)
      : traits.strength.source !== "proxy" ? (["S", "L", "M", "H", "V"][traits.strength.value] || "L") : "L";
    const strengthRange = [...new Set(strengths)].sort((a, b) => (strengthMap[a] ?? 0) - (strengthMap[b] ?? 0));

    // OEWS lookup
    const oewsEntry = oews[socCode] || null;
    if (oewsEntry) oewsHits++;

    // BLS projections
    const blsEntry = bls[socCode] || null;
    if (blsEntry) blsHits++;

    // DOT title entries
    const dotTitles: DOTTitleEntry[] = dotMappings.slice(0, 50).map(d => ({
      code: d.dotCode,
      title: d.title,
      svp: d.svp,
      strength: d.strength,
    }));

    // O*NET content
    const tasks = (onet.ta || []).slice(0, 10).map(t => t.t);
    const dwas = (onet.dw || []).slice(0, 15).map(d => d.t);
    const tools = (onet.tt || []).slice(0, 15).map(t => t.t);

    // Data quality
    const dataSources: string[] = [];
    if (orsEntry) dataSources.push("ORS");
    if (dotMappings.length > 0) dataSources.push("DOT");
    dataSources.push("ONET");
    if (oewsEntry) dataSources.push("OEWS");
    if (blsEntry) dataSources.push("BLS");

    let traitCoverage = 0;
    for (const key of TRAIT_KEYS) {
      if (traits[key].source !== "proxy") traitCoverage++;
    }

    unified.push({
      onetCode,
      socCode,
      title: onet.t,
      description: onet.d || "",
      traits,
      vqScore: vq.vqScore,
      vqBand: vq.vqBand,
      svp,
      svpRange,
      jobZone: onetOcc[onetCode]?.jz ?? null,
      strengthLevel,
      strengthRange: strengthRange.length > 0 ? strengthRange : [strengthLevel],
      wages: {
        median: oewsEntry?.md ?? null,
        mean: oewsEntry?.m ?? null,
        p10: oewsEntry?.p10 ?? null,
        p25: oewsEntry?.p25 ?? null,
        p75: oewsEntry?.p75 ?? null,
        p90: oewsEntry?.p90 ?? null,
      },
      employment: oewsEntry?.e ?? null,
      projections: blsEntry ? {
        growthPercent: blsEntry.cp,
        annualOpenings: blsEntry.oa,
      } : null,
      dotTitles,
      dotTitleCount: dotMappings.length,
      tasks,
      dwas,
      tools,
      dataSources,
      traitCoverage,
      hasORS: !!orsEntry,
      hasDOT: dotMappings.length > 0,
      hasOEWS: !!oewsEntry,
      hasBLSProjections: !!blsEntry,
    });
  }

  // Step 4: Write output
  const outputPath = path.join(__dirname, "../../src/data/unified-occupations.json");
  fs.writeFileSync(outputPath, JSON.stringify(unified, null, 0));
  const sizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(1);

  console.log("\n=== Build Complete ===");
  console.log(`  Total occupations: ${unified.length}`);
  console.log(`  With ORS data: ${orsHits} (${(orsHits / unified.length * 100).toFixed(1)}%)`);
  console.log(`  With DOT titles: ${dotHits} (${(dotHits / unified.length * 100).toFixed(1)}%)`);
  console.log(`  With OEWS wages: ${oewsHits} (${(oewsHits / unified.length * 100).toFixed(1)}%)`);
  console.log(`  With BLS projections: ${blsHits} (${(blsHits / unified.length * 100).toFixed(1)}%)`);
  console.log(`  Output: ${outputPath} (${sizeMB} MB)`);

  // Step 5: Print VQ distribution
  const bands = [0, 0, 0, 0];
  for (const occ of unified) bands[occ.vqBand - 1]++;
  console.log(`\n  VQ Band Distribution:`);
  console.log(`    Band 1 (68-99):  ${bands[0]} occupations`);
  console.log(`    Band 2 (100-108): ${bands[1]} occupations`);
  console.log(`    Band 3 (109-143): ${bands[2]} occupations`);
  console.log(`    Band 4 (144-158): ${bands[3]} occupations`);

  // Step 6: Print trait coverage summary
  const coverageBuckets = { full: 0, high: 0, medium: 0, low: 0 };
  for (const occ of unified) {
    if (occ.traitCoverage === 24) coverageBuckets.full++;
    else if (occ.traitCoverage >= 18) coverageBuckets.high++;
    else if (occ.traitCoverage >= 10) coverageBuckets.medium++;
    else coverageBuckets.low++;
  }
  console.log(`\n  Trait Coverage:`);
  console.log(`    Full (24/24): ${coverageBuckets.full}`);
  console.log(`    High (18-23): ${coverageBuckets.high}`);
  console.log(`    Medium (10-17): ${coverageBuckets.medium}`);
  console.log(`    Low (<10): ${coverageBuckets.low}`);
}

main();
