#!/usr/bin/env node
/**
 * convert-jolts-data.mjs
 *
 * Fetches JOLTS (Job Openings and Labor Turnover Survey) data from the
 * BLS Public Data API v2 and outputs compact JSON for the app to consume.
 *
 * Source: https://www.bls.gov/jlt/
 *   → Data retrieved via https://api.bls.gov/publicAPI/v2/timeseries/data/
 *
 * Usage:
 *   node scripts/convert-jolts-data.mjs [--start-year 2014] [--end-year 2025]
 *
 * Output: src/data/jolts-data.json
 *
 * JOLTS series ID format (22 chars):
 *   JT[seasonal][industry6][state2][area4][sizeclass2][dataelement2][ratelevel1]
 *   Example: JTU000000000000000JOL
 *     JT = JOLTS prefix
 *     U  = not seasonally adjusted (S = seasonally adjusted)
 *     000000 = industry (Total nonfarm)
 *     00 = national
 *     0000 = national
 *     00 = all size classes
 *     JO = Job Openings (HI = Hires)
 *     L  = Level (R = Rate)
 *
 * The BLS API v2 (without registration key) allows max 25 series per request.
 * We fetch JO and HI in separate batches.
 *
 * Output format (keyed by 6-digit NAICS industry code):
 * {
 *   "000000": {
 *     "n": "Total nonfarm",
 *     "d": {
 *       "2024": { "jo": 7779.5, "hi": 5437.8 }
 *     }
 *   }
 * }
 *
 * Values are in thousands (matching raw BLS format).
 */

import https from "https";
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const INDUSTRIES = {
  "000000": "Total nonfarm",
  "100000": "Total private",
  "230000": "Construction",
  "300000": "Manufacturing",
  "320000": "Durable goods manufacturing",
  "340000": "Nondurable goods manufacturing",
  "400000": "Trade, transportation, and utilities",
  "420000": "Wholesale trade",
  "440000": "Retail trade",
  "510000": "Information",
  "520000": "Financial activities",
  "530000": "Real estate and rental and leasing",
  "600000": "Education and health services",
  "610000": "Educational services",
  "620000": "Health care and social assistance",
  "700000": "Leisure and hospitality",
  "710000": "Arts, entertainment, and recreation",
  "720000": "Accommodation and food services",
  "810000": "Other services",
  "900000": "Government",
  "920000": "State and local government",
};

function fetchBLS(seriesIds, startYear, endYear) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      seriesid: seriesIds,
      startyear: String(startYear),
      endyear: String(endYear),
    });

    const options = {
      hostname: "api.bls.gov",
      path: "/publicAPI/v2/timeseries/data/",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (d) => (data += d));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function processSeriesData(result, output) {
  for (const series of result.Results?.series || []) {
    const sid = series.seriesID;
    const industryCode = sid.substring(3, 9);
    const dataElement = sid.substring(sid.length - 3, sid.length - 1);

    const yearly = {};
    for (const dp of series.data || []) {
      if (dp.period === "M13") continue;
      const val = parseFloat(dp.value);
      if (isNaN(val)) continue;
      const yr = dp.year;
      if (!yearly[yr]) yearly[yr] = [];
      yearly[yr].push(val);
    }

    for (const [year, vals] of Object.entries(yearly)) {
      const avg =
        Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;

      if (!output[industryCode]) {
        output[industryCode] = {
          n: INDUSTRIES[industryCode] || `Industry ${industryCode}`,
          d: {},
        };
      }
      if (!output[industryCode].d[year]) {
        output[industryCode].d[year] = {};
      }
      if (dataElement === "JO") output[industryCode].d[year].jo = avg;
      else if (dataElement === "HI") output[industryCode].d[year].hi = avg;
    }
  }
}

async function main() {
  // Parse args
  const args = process.argv.slice(2);
  let startYear = 2014;
  let endYear = new Date().getFullYear();

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--start-year" && args[i + 1]) startYear = parseInt(args[++i], 10);
    if (args[i] === "--end-year" && args[i + 1]) endYear = parseInt(args[++i], 10);
  }

  console.log(`Fetching JOLTS data for ${Object.keys(INDUSTRIES).length} industries, ${startYear}-${endYear}`);

  const codes = Object.keys(INDUSTRIES);
  const output = {};

  // BLS API allows 10-year windows and 25 series per request.
  // Split into decade chunks if needed, and JO/HI separately.
  for (let yr = startYear; yr <= endYear; yr += 10) {
    const chunkEnd = Math.min(yr + 9, endYear);
    console.log(`\n--- Fetching ${yr}-${chunkEnd} ---`);

    // Job Openings
    const seriesJO = codes.map((c) => `JTU${c}000000000JOL`);
    console.log(`  Job Openings (${seriesJO.length} series)...`);
    const resultJO = await fetchBLS(seriesJO, yr, chunkEnd);
    console.log(`  Status: ${resultJO.status}, Series: ${resultJO.Results?.series?.length}`);
    processSeriesData(resultJO, output);

    // Rate limit pause
    await new Promise((r) => setTimeout(r, 2000));

    // Hires
    const seriesHI = codes.map((c) => `JTU${c}000000000HIL`);
    console.log(`  Hires (${seriesHI.length} series)...`);
    const resultHI = await fetchBLS(seriesHI, yr, chunkEnd);
    console.log(`  Status: ${resultHI.status}, Series: ${resultHI.Results?.series?.length}`);
    processSeriesData(resultHI, output);

    if (chunkEnd < endYear) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  const outPath = resolve(__dirname, "../src/data/jolts-data.json");
  writeFileSync(outPath, JSON.stringify(output));

  const industryCount = Object.keys(output).length;
  const years = new Set();
  for (const ind of Object.values(output)) {
    for (const yr of Object.keys(ind.d)) years.add(yr);
  }

  console.log(`\nWrote ${industryCount} industries to ${outPath}`);
  console.log(`Years: ${[...years].sort().join(", ")}`);

  // Spot check
  const nf = output["000000"];
  if (nf) {
    const latestYear = [...Object.keys(nf.d)].sort().pop();
    const latest = nf.d[latestYear];
    console.log(
      `\nSpot check — Total nonfarm ${latestYear}: JO=${latest?.jo}K, HI=${latest?.hi}K`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
