"""
Convert OEWS Excel dataset to a compact JSON file for the app.

Input: BLS OEWS May 2024 complete dataset (all_data_M_2024.xlsx)
Output: src/data/oews-data.json

Filters for:
- National level (AREA_TYPE = 1, AREA = 99)
- Cross-industry (NAICS = 000000)
- All ownerships (OWN_CODE = 1235)
- Detailed occupations (O_GROUP = 'detailed')

Structure: keyed by OCC_CODE → { title, employment, meanWage, medianWage, pct10-90 }
"""
import openpyxl
import json
import os

INPUT_FILE = '/Users/chrisskerritt/Downloads/oesm24all/all_data_M_2024.xlsx'
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), '../src/data/oews-data.json')

print('Reading OEWS Excel file (this may take a minute)...')
wb = openpyxl.load_workbook(INPUT_FILE, read_only=True, data_only=True)
ws = wb.active

# Read headers
headers = None
occupations = {}
total_rows = 0
skipped = 0

for row in ws.iter_rows(values_only=True):
    if headers is None:
        headers = [str(h) if h else '' for h in row]
        continue

    total_rows += 1

    # Convert to dict
    data = {}
    for i, val in enumerate(row):
        if i < len(headers):
            data[headers[i]] = val

    # Filter: national, cross-industry, all ownerships, detailed occupations
    area_type = str(data.get('AREA_TYPE', ''))
    area = str(data.get('AREA', ''))
    naics = str(data.get('NAICS', ''))
    own_code = str(data.get('OWN_CODE', ''))
    o_group = str(data.get('O_GROUP', ''))

    if area_type != '1' or area != '99':
        skipped += 1
        continue
    if naics != '000000':
        skipped += 1
        continue
    if own_code != '1235':
        skipped += 1
        continue
    if o_group != 'detailed':
        skipped += 1
        continue

    occ_code = str(data.get('OCC_CODE', ''))
    occ_title = str(data.get('OCC_TITLE', ''))

    def parse_num(val):
        if val is None or val == '' or val == '#' or val == '*' or val == '**':
            return None
        try:
            return float(str(val).replace(',', ''))
        except (ValueError, TypeError):
            return None

    occupations[occ_code] = {
        't': occ_title,
        'e': parse_num(data.get('TOT_EMP')),       # employment
        'm': parse_num(data.get('A_MEAN')),         # annual mean wage
        'md': parse_num(data.get('A_MEDIAN')),      # annual median wage
        'p10': parse_num(data.get('A_PCT10')),      # annual 10th percentile
        'p25': parse_num(data.get('A_PCT25')),      # annual 25th percentile
        'p75': parse_num(data.get('A_PCT75')),      # annual 75th percentile
        'p90': parse_num(data.get('A_PCT90')),      # annual 90th percentile
    }

wb.close()

print(f'Read {total_rows} rows, skipped {skipped}, kept {len(occupations)} occupations')

# Write compact JSON
os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
with open(OUTPUT_FILE, 'w') as f:
    json.dump(occupations, f, separators=(',', ':'))

file_size = os.path.getsize(OUTPUT_FILE)
print(f'Written to {OUTPUT_FILE}')
print(f'File size: {file_size / 1024:.1f} KB')

# Print some samples
sample_codes = list(occupations.keys())[:5]
for code in sample_codes:
    occ = occupations[code]
    print(f"  {code}: {occ['t']} — emp={occ['e']}, median=${occ['md']}, mean=${occ['m']}")
