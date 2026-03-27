/**
 * Generate SHA-256 hashes for benchmark pair expected results.
 *
 * Usage: npx tsx scripts/generate-hashes.ts
 *
 * This script loads the benchmark pairs fixture, serializes each pair's
 * expectedResults to canonical JSON (sorted keys), computes SHA-256 hashes,
 * and writes them to expected-hashes.json.
 */

import { createHash } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const FIXTURES_DIR = join(
  __dirname,
  "../src/lib/engine/__fixtures__"
);

// Load benchmark pairs
const pairsData = JSON.parse(
  readFileSync(join(FIXTURES_DIR, "benchmark-pairs.json"), "utf-8")
);

const pairs: { id: string; expectedResults: Record<string, unknown> }[] =
  pairsData.pairs;

/**
 * Produce canonical JSON: keys sorted recursively, no extra whitespace.
 */
function canonicalJSON(obj: unknown): string {
  return JSON.stringify(obj, (_key, value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(value).sort()) {
        sorted[k] = value[k];
      }
      return sorted;
    }
    return value;
  });
}

function sha256(data: string): string {
  return createHash("sha256").update(data, "utf-8").digest("hex");
}

// Build hashes
const pairHashes: Record<string, string> = {};

for (const pair of pairs) {
  const canonical = canonicalJSON(pair.expectedResults);
  pairHashes[pair.id] = sha256(canonical);
}

const output = {
  generatedAt: "2026-03-27T00:00:00Z",
  hashAlgorithm: "SHA-256",
  dataVersions: {
    dot: "4th Edition, Revised (1991)",
    onet: "29.1",
    oews: "May 2024",
  },
  pairHashes,
};

const outPath = join(FIXTURES_DIR, "expected-hashes.json");
writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n");

console.log(`Wrote ${Object.keys(pairHashes).length} hashes to ${outPath}`);
for (const [id, hash] of Object.entries(pairHashes)) {
  console.log(`  ${id}: ${hash.slice(0, 16)}...`);
}
