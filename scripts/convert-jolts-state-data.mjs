#!/usr/bin/env node
/**
 * convert-jolts-state-data.mjs
 *
 * Fetches state-level JOLTS (Job Openings and Labor Turnover Survey) data
 * from the BLS Public Data API v2 and outputs compact JSON.
 *
 * JOLTS state-level data is Total Nonfarm only (industry=000000).
 * Available for all 50 states + DC + 4 Census regions.
 *
 * Series ID format (21 chars):
 *   JT[seasonal][industry6][state2][area5][sizeclass2][dataelement2][ratelevel1]
 *   Example: JTS000000010000000JOL
 *     JT = JOLTS prefix
 *     S  = seasonally adjusted
 *     000000 = Total nonfarm
 *     01 = Alabama (FIPS)
 *     00000 = all areas
 *     00 = all size classes
 *     JO = Job Openings
 *     L  = Level (thousands)
 *
 * Usage:
 *   node scripts/convert-jolts-state-data.mjs [--start-year 2014] [--end-year 2025]
 *
 * Output: src/data/jolts-state-data.json
 */

import https from "https";
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// All 50 states + DC with FIPS codes
const STATES = {
  "01": "Alabama",
  "02": "Alaska",
  "04": "Arizona",
  "05": "Arkansas",
  "06": "California",
  "08": "Colorado",
  "09": "Connecticut",
  "10": "Delaware",
  "11": "District of Columbia",
  "12": "Florida",
  "13": "Georgia",
  "15": "Hawaii",
  "16": "Idaho",
  "17": "Illinois",
  "18": "Indiana",
  "19": "Iowa",
  "20": "Kansas",
  "21": "Kentucky",
  "22": "Louisiana",
  "23": "Maine",
  "24": "Maryland",
  "25": "Massachusetts",
  "26": "Michigan",
  "27": "Minnesota",
  "28": "Mississippi",
  "29": "Missouri",
  "30": "Montana",
  "31": "Nebraska",
  "32": "Nevada",
  "33": "New Hampshire",
  "34": "New Jersey",
  "35": "New Mexico",
  "36": "New York",
  "37": "North Carolina",
  "38": "North Dakota",
  "39": "Ohio",
  "40": "Oklahoma",
  "41": "Oregon",
  "42": "Pennsylvania",
  "44": "Rhode Island",
  "45": "South Carolina",
  "46": "South Dakota",
  "47": "Tennessee",
  "48": "Texas",
  "49": "Utah",
  "50": "Vermont",
  "51": "Virginia",
  "53": "Washington",
  "54": "West Virginia",
  "55": "Wisconsin",
  "56": "Wyoming",
};

// 4 Census regions
const REGIONS = {
  NE: "Northeast",
  MW: "Midwest",
  SO: "South",
  WE: "West",
};

function fetchBLS(seriesIds, startYear, endYear) {
  return new Promise((res, reject) => {
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

    const req = https.request(options, (response) => {
      let data = "";
      response.on("data", (d) => (data += d));
      response.on("end", () => {
        try {
          res(JSON.parse(data));
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

function buildSeriesId(stateCode, dataElement) {
  // JTS000000{state2}0000000{dataElement2}L
  return `JTS000000${stateCode}0000000${dataElement}L`;
}

function processSeriesData(result, output) {
  for (const series of result.Results?.series || []) {
    const sid = series.seriesID;
    // Extract state code: positions 9-10 (0-indexed) in the series ID
    // JTS000000XX0000000JOL
    const stateCode = sid.substring(9, 11);
    const dataElement = sid.substring(sid.length - 3, sid.length - 1);

    const yearly = {};
    for (const dp of series.data || []) {
      if (dp.period === "M13") continue; // skip annual average
      const val = parseFloat(dp.value);
      if (isNaN(val)) continue;
      const yr = dp.year;
      if (!yearly[yr]) yearly[yr] = [];
      yearly[yr].push(val);
    }

    for (const [year, vals] of Object.entries(yearly)) {
      const avg =
        Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;

      if (!output[stateCode]) {
        output[stateCode] = {
          n: STATES[stateCode] || REGIONS[stateCode] || `State ${stateCode}`,
          d: {},
        };
      }
      if (!output[stateCode].d[year]) {
        output[stateCode].d[year] = {};
      }
      if (dataElement === "JO") output[stateCode].d[year].jo = avg;
      else if (dataElement === "HI") output[stateCode].d[year].hi = avg;
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  let startYear = 2014;
  let endYear = new Date().getFullYear();

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--start-year" && args[i + 1])
      startYear = parseInt(args[++i], 10);
    if (args[i] === "--end-year" && args[i + 1])
      endYear = parseInt(args[++i], 10);
  }

  const stateCodes = Object.keys(STATES);
  const regionCodes = Object.keys(REGIONS);
  const allCodes = [...stateCodes, ...regionCodes];

  console.log(
    `Fetching JOLTS state data for ${allCodes.length} states/regions, ${startYear}-${endYear}`
  );

  const output = {};

  // BLS API allows max 25 series per request and 10-year windows
  for (let yr = startYear; yr <= endYear; yr += 10) {
    const chunkEnd = Math.min(yr + 9, endYear);
    console.log(`\n--- Fetching ${yr}-${chunkEnd} ---`);

    // Process in batches of 25 series
    for (const dataElement of ["JO", "HI"]) {
      const elementName = dataElement === "JO" ? "Job Openings" : "Hires";
      const allSeriesIds = allCodes.map((code) =>
        buildSeriesId(code, dataElement)
      );

      for (let i = 0; i < allSeriesIds.length; i += 25) {
        const batch = allSeriesIds.slice(i, i + 25);
        const batchNum = Math.floor(i / 25) + 1;
        const totalBatches = Math.ceil(allSeriesIds.length / 25);

        console.log(
          `  ${elementName} batch ${batchNum}/${totalBatches} (${batch.length} series)...`
        );

        const result = await fetchBLS(batch, yr, chunkEnd);
        console.log(
          `  Status: ${result.status}, Series: ${result.Results?.series?.length ?? 0}`
        );

        if (result.status === "REQUEST_NOT_PROCESSED") {
          console.error(
            `  ERROR: ${result.message?.join(" ") || "Request not processed"}`
          );
          // Wait longer and retry once
          await new Promise((r) => setTimeout(r, 5000));
          const retry = await fetchBLS(batch, yr, chunkEnd);
          console.log(
            `  Retry status: ${retry.status}, Series: ${retry.Results?.series?.length ?? 0}`
          );
          processSeriesData(retry, output);
        } else {
          processSeriesData(result, output);
        }

        // Rate limit: BLS public API allows ~25 req/10sec
        await new Promise((r) => setTimeout(r, 2500));
      }
    }
  }

  const outPath = resolve(__dirname, "../src/data/jolts-state-data.json");
  writeFileSync(outPath, JSON.stringify(output));

  const stateCount = Object.keys(output).length;
  const years = new Set();
  for (const state of Object.values(output)) {
    for (const yr of Object.keys(state.d)) years.add(yr);
  }

  console.log(`\nWrote ${stateCount} states/regions to ${outPath}`);
  console.log(`Years: ${[...years].sort().join(", ")}`);

  // Spot check
  const ca = output["06"];
  if (ca) {
    const latestYear = [...Object.keys(ca.d)].sort().pop();
    const latest = ca.d[latestYear];
    console.log(
      `\nSpot check — California ${latestYear}: JO=${latest?.jo}K, HI=${latest?.hi}K`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
