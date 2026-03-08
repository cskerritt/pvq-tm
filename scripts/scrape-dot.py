#!/usr/bin/env python3
"""
Scrape all DOT (Dictionary of Occupational Titles) occupation data from occupationalinfo.org
and save to a JSON file for database seeding.

Data extracted per occupation:
- DOT code (e.g., "160.162-018")
- Title (e.g., "ACCOUNTANT")
- Industry designation (e.g., "profess. & kin.")
- Job description text
- GOE code
- Strength level (S, L, M, H, V)
- GED levels (R, M, L each 1-6)
- SVP (1-9)
- DLU (date of last update)
- O*NET crosswalk code
- Worker functions Data/People/Things (decoded from DOT code)
"""

import requests
from bs4 import BeautifulSoup
import json
import re
import time
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin

BASE_URL = "https://occupationalinfo.org/"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "dot")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "all_occupations.json")
PROGRESS_FILE = os.path.join(OUTPUT_DIR, "scrape_progress.json")

# All alphabetical index pages
INDEX_PAGES = [
    "dot_a0.html", "dot_a1.html", "dot_a2.html", "dot_a3.html",
    "dot_b1.html", "dot_b2.html", "dot_b3.html", "dot_b4.html", "dot_b5.html", "dot_b6.html",
    "dot_c1.html", "dot_c2.html", "dot_c3.html", "dot_c4.html", "dot_c5.html",
    "dot_d1.html", "dot_d2.html", "dot_d3.html", "dot_d4.html", "dot_d5.html",
    "dot_e1.html", "dot_e2.html", "dot_e3.html", "dot_e4.html",
    "dot_f1.html", "dot_f2.html", "dot_f3.html", "dot_f4.html", "dot_f5.html", "dot_f6.html",
    "dot_g1.html", "dot_g2.html", "dot_g3.html", "dot_g4.html", "dot_g5.html", "dot_g6.html",
    "dot_h1.html", "dot_h2.html", "dot_h3.html", "dot_h4.html", "dot_h5.html",
    "dot_i1.html", "dot_i2.html", "dot_i3.html", "dot_i4.html", "dot_i5.html",
    "dot_j1.html", "dot_j2.html", "dot_j3.html", "dot_j4.html",
    "dot_k1.html", "dot_k2.html",
    "dot_l1.html", "dot_l2.html", "dot_l3.html", "dot_l4.html", "dot_l5.html", "dot_l6.html",
    "dot_m1.html", "dot_m1a.html", "dot_m2.html", "dot_m3.html", "dot_m4.html", "dot_m5.html", "dot_m6.html",
    "dot_n1.html", "dot_n2.html", "dot_n3.html", "dot_n4.html", "dot_n5.html",
    "dot_o1.html", "dot_o2.html", "dot_o3.html", "dot_o4.html",
    "dot_p1.html", "dot_p2.html", "dot_p3.html", "dot_p4.html", "dot_p5.html",
    "dot_q1.html", "dot_q2.html",
    "dot_r1.html", "dot_r2.html", "dot_r3.html", "dot_r4.html", "dot_r5.html",
    "dot_s1.html", "dot_s2.html", "dot_s3.html", "dot_s4.html", "dot_s5.html", "dot_s6.html",
    "dot_t1.html", "dot_t2.html", "dot_t3.html", "dot_t4.html", "dot_t5.html",
    "dot_u1.html", "dot_u2.html",
    "dot_v1.html", "dot_v2.html",
    "dot_w1.html", "dot_w2.html", "dot_w3.html", "dot_w4.html", "dot_w5.html",
    "dot_x1.html", "dot_y1.html", "dot_z1.html",
]

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) PVQ-TM Research Tool"
})


def format_dot_code(raw_code: str) -> str:
    """Convert raw DOT code like '160162018' to formatted '160.162-018'."""
    raw = re.sub(r'[.\-\s]', '', raw_code)
    if len(raw) == 9 and raw.isdigit():
        return f"{raw[:3]}.{raw[3:6]}-{raw[6:9]}"
    return raw_code


def decode_dpt(dot_code: str) -> dict:
    """Decode Data/People/Things worker function levels from DOT code middle 3 digits."""
    clean = re.sub(r'[.\-]', '', dot_code)
    if len(clean) == 9 and clean.isdigit():
        return {
            "data": int(clean[3]),
            "people": int(clean[4]),
            "things": int(clean[5]),
        }
    return {}


def scrape_index_page(page_name: str) -> list:
    """Scrape an alphabetical index page and return list of (url, title_hint) tuples."""
    url = urljoin(BASE_URL, page_name)
    try:
        r = session.get(url, timeout=30)
        r.raise_for_status()
    except Exception as e:
        print(f"  ERROR fetching {page_name}: {e}")
        return []

    soup = BeautifulSoup(r.text, 'html.parser')
    links = []
    seen = set()

    for a in soup.find_all('a'):
        href = a.get('href', '')
        # Occupation pages: ./XX/XXXXXXXXX.html
        if href.startswith('./') and href.endswith('.html'):
            parts = href[2:].split('/')
            if len(parts) == 2 and parts[0].isdigit():
                code_part = parts[1].replace('.html', '')
                if code_part.isdigit() and len(code_part) == 9:
                    full_url = urljoin(BASE_URL, href[2:])
                    if full_url not in seen:
                        seen.add(full_url)
                        links.append(full_url)

    return links


def parse_occupation_page(html: str, url: str) -> dict | None:
    """Parse a single occupation page and extract all fields."""
    soup = BeautifulSoup(html, 'html.parser')

    result = {
        "dot_code": None,
        "title": None,
        "industry_desig": None,
        "description": None,
        "goe": None,
        "strength": None,
        "ged_r": None,
        "ged_m": None,
        "ged_l": None,
        "svp": None,
        "dlu": None,
        "onet_crosswalk": None,
        "dpt": {},
        "alternate_titles": [],
    }

    # --- Extract DOT code from title tag ---
    title_tag = soup.find('title')
    if title_tag:
        title_text = title_tag.get_text()
        code_match = re.search(r'(\d{3})[.\s](\d{3})[.\-\s](\d{3})', title_text)
        if code_match:
            result["dot_code"] = f"{code_match.group(1)}.{code_match.group(2)}-{code_match.group(3)}"

    # Fallback: extract from URL
    if not result["dot_code"]:
        url_match = re.search(r'/(\d{9})\.html', url)
        if url_match:
            raw = url_match.group(1)
            result["dot_code"] = f"{raw[:3]}.{raw[3:6]}-{raw[6:9]}"

    if not result["dot_code"]:
        return None

    # --- Decode DPT from code ---
    result["dpt"] = decode_dpt(result["dot_code"])

    # --- Find the main content area ---
    # The content is in a <td> that contains CODE: and TITLE(s):
    content_td = None
    for td in soup.find_all('td'):
        text = td.get_text()
        if 'CODE:' in text and 'TITLE' in text:
            content_td = td
            break

    if not content_td:
        # Try mobile div
        mobile_div = soup.find('div', id='mobile')
        if mobile_div:
            content_td = mobile_div

    if not content_td:
        return result  # Return what we have from title

    full_text = content_td.get_text()

    # --- Extract title and industry designation ---
    # Pattern: "TITLE(s): ACCOUNTANT (profess. & kin.)"
    title_match = re.search(r'TITLE\(s\):\s*(.+?)(?:\n|Applies|Drives|Performs|Operates|Supervises|Plans|Manages|Conducts|Directs|Installs|Prepares|Repairs|Designs|Tests|Sells|Cleans|Tends|Feeds|Sets|Loads|Cuts|Paints|Welds|Sews|Mixes|Packs|Types|Inspects|Maintains|Assembles|Fabricat|Classif|Controls|Grinds|Heats|Measures|Monitors|Records|Removes|Adjusts|Calculates|Compiles|Coordinates|Examines|Files|Fills|Makes|Molds|Moves|Observes|Pours|Reads|Reviews|Sorts|Stacks|Stamps|Stores|Transports|Trims|Weighs|Writes)', full_text, re.DOTALL)
    if title_match:
        raw_title = title_match.group(1).strip()
    else:
        # Simpler fallback
        title_match = re.search(r'TITLE\(s\):\s*(.+?)(?:\r?\n)', full_text)
        if title_match:
            raw_title = title_match.group(1).strip()
        else:
            raw_title = ""

    # Parse "TITLE (industry)" format
    if raw_title:
        industry_match = re.match(r'^(.+?)\s*\(([^)]+)\)\s*$', raw_title.split('\n')[0].strip())
        if industry_match:
            result["title"] = industry_match.group(1).strip()
            result["industry_desig"] = industry_match.group(2).strip()
        else:
            result["title"] = raw_title.split('\n')[0].strip()

    # --- Extract description ---
    # Description is between the title line and the GOE/Strength line
    desc_start = full_text.find(')')
    if result["industry_desig"] and desc_start > 0:
        # Find after the industry designation closing paren
        title_end_idx = full_text.find(result["industry_desig"])
        if title_end_idx > 0:
            desc_start = full_text.find(')', title_end_idx) + 1

    # Find the GOE line
    goe_idx = full_text.find('GOE:')
    if desc_start > 0 and goe_idx > 0 and goe_idx > desc_start:
        desc = full_text[desc_start:goe_idx].strip()
        # Clean up the description
        desc = re.sub(r'\s+', ' ', desc).strip()
        # Remove any leading/trailing navigation text
        desc = re.sub(r'^.*?(?=[A-Z][a-z])', '', desc, count=1)
        if len(desc) > 20:
            result["description"] = desc

    # --- Extract GOE, Strength, GED, SVP, DLU from bold text ---
    for b_tag in content_td.find_all('b'):
        b_text = b_tag.get_text()
        if 'GOE:' in b_text or 'STRENGTH:' in b_text or 'SVP:' in b_text:
            # Parse GOE
            goe_match = re.search(r'GOE:\s*([\d.]+)', b_text)
            if goe_match:
                result["goe"] = goe_match.group(1)

            # Parse Strength
            str_match = re.search(r'STRENGTH:\s*([SLMHV])', b_text)
            if str_match:
                result["strength"] = str_match.group(1)

            # Parse GED
            ged_match = re.search(r'GED:\s*R(\d)\s*M(\d)\s*L(\d)', b_text)
            if ged_match:
                result["ged_r"] = int(ged_match.group(1))
                result["ged_m"] = int(ged_match.group(2))
                result["ged_l"] = int(ged_match.group(3))

            # Parse SVP
            svp_match = re.search(r'SVP:\s*(\d)', b_text)
            if svp_match:
                result["svp"] = int(svp_match.group(1))

            # Parse DLU
            dlu_match = re.search(r'DLU:\s*(\d+)', b_text)
            if dlu_match:
                result["dlu"] = dlu_match.group(1)
            break

    # --- Extract O*NET crosswalk ---
    for a in content_td.find_all('a'):
        href = a.get('href', '')
        if '/onet/' in href and href.endswith('.html'):
            onet_code = href.split('/')[-1].replace('.html', '').upper()
            link_text = a.get_text(strip=True)
            if onet_code and any(c.isdigit() for c in onet_code):
                result["onet_crosswalk"] = onet_code
                break

    # --- Extract alternate titles ---
    # These sometimes appear after "May be designated" or as links at the bottom
    alt_text = re.findall(r'May be designated[:\s]+(.+?)(?:GOE|$)', full_text, re.DOTALL)
    if alt_text:
        alts = re.split(r'[;.]', alt_text[0])
        for alt in alts:
            alt = alt.strip()
            if alt and len(alt) > 2:
                result["alternate_titles"].append(alt)

    return result


def fetch_and_parse(url: str, retries: int = 3) -> dict | None:
    """Fetch a URL and parse the occupation data."""
    for attempt in range(retries):
        try:
            r = session.get(url, timeout=30)
            r.raise_for_status()
            return parse_occupation_page(r.text, url)
        except requests.exceptions.HTTPError as e:
            if r.status_code == 404:
                return None
            if attempt < retries - 1:
                time.sleep(1)
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(1)
            else:
                print(f"  FAILED {url}: {e}")
    return None


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # --- Phase 1: Collect all occupation URLs from index pages ---
    print("=" * 60)
    print("Phase 1: Collecting occupation URLs from index pages...")
    print("=" * 60)

    all_urls = set()
    for i, page in enumerate(INDEX_PAGES):
        urls = scrape_index_page(page)
        all_urls.update(urls)
        sys.stdout.write(f"\r  Scraped {i+1}/{len(INDEX_PAGES)} index pages, {len(all_urls)} unique URLs found")
        sys.stdout.flush()
        time.sleep(0.1)  # Be polite

    print(f"\n\nTotal unique occupation URLs: {len(all_urls)}")

    # Check for progress file to resume
    completed = {}
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, 'r') as f:
            completed = json.load(f)
        print(f"Resuming from progress file: {len(completed)} already scraped")

    remaining_urls = [u for u in sorted(all_urls) if u not in completed]
    print(f"Remaining to scrape: {len(remaining_urls)}")

    # --- Phase 2: Scrape each occupation page ---
    print("\n" + "=" * 60)
    print("Phase 2: Scraping individual occupation pages...")
    print("=" * 60)

    batch_size = 50
    total = len(remaining_urls)
    scraped_count = len(completed)

    for batch_start in range(0, total, batch_size):
        batch = remaining_urls[batch_start:batch_start + batch_size]

        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = {executor.submit(fetch_and_parse, url): url for url in batch}
            for future in as_completed(futures):
                url = futures[future]
                try:
                    result = future.result()
                    if result and result.get("dot_code"):
                        completed[url] = result
                        scraped_count += 1
                except Exception as e:
                    print(f"\n  ERROR: {url}: {e}")

        # Progress update
        pct = (batch_start + len(batch)) / total * 100 if total > 0 else 100
        sys.stdout.write(f"\r  Progress: {scraped_count} scraped ({pct:.1f}% of remaining)")
        sys.stdout.flush()

        # Save progress every batch
        if (batch_start // batch_size) % 5 == 0:
            with open(PROGRESS_FILE, 'w') as f:
                json.dump(completed, f)

        time.sleep(0.2)  # Rate limiting between batches

    # --- Phase 3: Save final results ---
    print(f"\n\n{'=' * 60}")
    print("Phase 3: Saving results...")
    print("=" * 60)

    # Save progress
    with open(PROGRESS_FILE, 'w') as f:
        json.dump(completed, f)

    # Convert to list keyed by DOT code
    occupations = {}
    for url, data in completed.items():
        if data and data.get("dot_code"):
            code = data["dot_code"]
            occupations[code] = data

    # Save final output
    output = {
        "source": "occupationalinfo.org",
        "description": "Dictionary of Occupational Titles, 4th Edition Revised (1991)",
        "total_occupations": len(occupations),
        "occupations": occupations,
    }

    with open(OUTPUT_FILE, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\nSaved {len(occupations)} occupations to {OUTPUT_FILE}")
    size_mb = os.path.getsize(OUTPUT_FILE) / (1024 * 1024)
    print(f"File size: {size_mb:.1f} MB")

    # Stats
    has_svp = sum(1 for o in occupations.values() if o.get("svp"))
    has_strength = sum(1 for o in occupations.values() if o.get("strength"))
    has_ged = sum(1 for o in occupations.values() if o.get("ged_r"))
    has_desc = sum(1 for o in occupations.values() if o.get("description"))
    has_onet = sum(1 for o in occupations.values() if o.get("onet_crosswalk"))

    print(f"\nData completeness:")
    print(f"  SVP:         {has_svp}/{len(occupations)}")
    print(f"  Strength:    {has_strength}/{len(occupations)}")
    print(f"  GED:         {has_ged}/{len(occupations)}")
    print(f"  Description: {has_desc}/{len(occupations)}")
    print(f"  O*NET XW:    {has_onet}/{len(occupations)}")

    # Cleanup progress file
    if os.path.exists(PROGRESS_FILE):
        os.remove(PROGRESS_FILE)

    print("\nDone!")


if __name__ == "__main__":
    main()
