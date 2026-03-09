import * as XLSX from 'xlsx';

const wb = XLSX.readFile('/Users/chrisskerritt/Downloads/ors-complete-dataset (3).xlsx');
const ws = wb.Sheets['ORS 2025 dataset'];
const data: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws);

// Get all unique categories per requirement type
const catsByReq: Record<string, Set<string>> = {};
for (const row of data) {
  const req = row['REQUIREMENT'] as string;
  const cat = row['CATEGORY'] as string;
  if (!catsByReq[req]) catsByReq[req] = new Set();
  catsByReq[req].add(cat);
}

for (const [req, cats] of Object.entries(catsByReq)) {
  console.log('\n=== ' + req.toUpperCase() + ' ===');
  for (const c of cats) console.log('  ', c);
}

// Look at a specific occupation to understand data shape
console.log('\n=== SAMPLE: 111021 General and operations managers ===');
const sample = data.filter(r => r['2018 SOC CODE'] === '111021');
console.log('Total rows:', sample.length);
for (const r of sample.slice(0, 15)) {
  console.log(
    r['REQUIREMENT'], '|',
    r['CATEGORY'], '|',
    r['ESTIMATE TEXT'], '|',
    r['ESTIMATE'], '|',
    r['DATATYPE']
  );
}

// Check how SOC codes map - are they 6-digit like "111021" or with dashes?
console.log('\n=== SOC CODE FORMATS (unique, first 20) ===');
const socCodes = new Set<string>();
for (const row of data) {
  socCodes.add(row['2018 SOC CODE'] as string);
}
let count = 0;
for (const c of socCodes) {
  if (count++ < 20) console.log('  ', c);
}
console.log('  ... total unique SOC codes:', socCodes.size);
