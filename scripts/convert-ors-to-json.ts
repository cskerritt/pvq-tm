/**
 * Convert ORS Excel dataset to a compact JSON file for the app.
 *
 * Input: BLS ORS complete dataset Excel file
 * Output: src/data/ors-data.json
 *
 * Structure: keyed by SOC code (6-digit, no dash) → { physicalDemands, envConditions, cogMental, eduTrainExp }
 * Each section is an object keyed by category name → array of { text, value }
 */
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const INPUT_FILE = '/Users/chrisskerritt/Downloads/ors-complete-dataset (3).xlsx';
const OUTPUT_FILE = path.join(__dirname, '../src/data/ors-data.json');

// Read Excel
console.log('Reading ORS Excel file...');
const wb = XLSX.readFile(INPUT_FILE);
const ws = wb.Sheets['ORS 2025 dataset'];
const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws);
console.log(`Read ${rows.length} rows`);

// Compact structure: SOC → { occupation, physical, env, cog, edu }
// Each section: { categoryName: [{ t: estimateText, v: estimate }] }
interface CompactEstimate {
  t: string;   // estimate text (shortened)
  v: string;   // value
}

interface CompactOcc {
  n: string;  // occupation name
  p: Record<string, CompactEstimate[]>;  // physical demands
  e: Record<string, CompactEstimate[]>;  // environmental conditions
  c: Record<string, CompactEstimate[]>;  // cognitive/mental
  d: Record<string, CompactEstimate[]>;  // education/training/experience
}

const occupations: Record<string, CompactOcc> = {};

for (const row of rows) {
  const socCode = row['2018 SOC CODE'] as string;
  const occupation = row['OCCUPATION'] as string;
  const requirement = row['REQUIREMENT'] as string;
  const category = row['CATEGORY'] as string;
  const estimateText = row['ESTIMATE TEXT'] as string;
  const estimate = String(row['ESTIMATE'] ?? '');

  // Skip "All workers" aggregate and broad groups
  if (socCode === '000000') continue;
  if (socCode.endsWith('0000') || socCode.endsWith('000')) continue;

  if (!occupations[socCode]) {
    occupations[socCode] = { n: occupation, p: {}, e: {}, c: {}, d: {} };
  }

  const occ = occupations[socCode];

  // Shorten the estimate text (remove "Percent of workers that " prefix)
  const shortText = estimateText
    .replace(/^Percent of workers that /, '')
    .replace(/^Percent of workers with /, '')
    .replace(/^Percent of workers /, '');

  let bucket: Record<string, CompactEstimate[]>;
  switch (requirement) {
    case 'Physical demands':
      bucket = occ.p;
      break;
    case 'Environmental conditions':
      bucket = occ.e;
      break;
    case 'Cognitive and mental requirements':
      bucket = occ.c;
      break;
    case 'Education, training, and experience':
      bucket = occ.d;
      break;
    default:
      continue;
  }

  if (!bucket[category]) {
    bucket[category] = [];
  }

  bucket[category].push({ t: shortText, v: estimate });
}

const occCount = Object.keys(occupations).length;
console.log(`Processed ${occCount} occupations`);

// Ensure output directory exists
const outDir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Write compact JSON (no indentation)
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(occupations));
console.log(`Written to ${OUTPUT_FILE}`);
console.log(`File size: ${(fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(1)} MB`);

// Also write a readable version for debugging
const debugFile = OUTPUT_FILE.replace('.json', '-debug.json');
fs.writeFileSync(debugFile, JSON.stringify(occupations, null, 2));
console.log(`Debug file: ${(fs.statSync(debugFile).size / 1024 / 1024).toFixed(1)} MB`);

// Print a sample
const sampleCode = Object.keys(occupations)[5];
const sample = occupations[sampleCode];
console.log(`\nSample (${sampleCode} - ${sample.n}):`);
console.log('Physical categories:', Object.keys(sample.p).length);
console.log('Environmental categories:', Object.keys(sample.e).length);
console.log('Cognitive categories:', Object.keys(sample.c).length);
console.log('Education categories:', Object.keys(sample.d).length);
console.log('Sample physical (first cat):', JSON.stringify(Object.entries(sample.p)[0], null, 2));
