#!/usr/bin/env python3
"""
Post-processing script to clean up DOT data after scraping.
Fixes title parsing issues, normalizes data, etc.
"""

import json
import re
import os

INPUT_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "dot", "all_occupations.json")
OUTPUT_FILE = INPUT_FILE  # overwrite in place


def clean_title(entry: dict) -> dict:
    """Clean up title and industry designation parsing."""
    title = entry.get("title", "")
    industry = entry.get("industry_desig", "")

    if not title:
        return entry

    # Some titles have "alternate titles:" embedded
    # e.g., "LANDSCAPE ARCHITECT (profess. & kin.) alternate titles: community planner; environmental"
    alt_match = re.search(r'\s*alternate titles?:\s*(.+)', title, re.IGNORECASE)
    if alt_match:
        # Extract alternate titles
        alt_text = alt_match.group(1).strip()
        alts = [a.strip() for a in re.split(r'[;,]', alt_text) if a.strip()]
        entry["alternate_titles"] = alts

        # Clean the main title
        title = title[:alt_match.start()].strip()

    # Parse "TITLE (industry)" if not already parsed
    if not industry:
        # Match the last parenthetical as industry designation
        industry_match = re.match(r'^(.+?)\s*\(([^)]+)\)\s*$', title)
        if industry_match:
            title = industry_match.group(1).strip()
            industry = industry_match.group(2).strip()

    # Clean up title
    title = title.strip().rstrip('.')

    # Capitalize properly (DOT uses all-caps)
    # Keep as-is since DOT format is traditionally uppercase

    entry["title"] = title
    entry["industry_desig"] = industry if industry else None

    return entry


def clean_description(entry: dict) -> dict:
    """Clean up description text."""
    desc = entry.get("description", "")
    if not desc:
        return entry

    # Remove any navigation remnants
    desc = re.sub(r'(Previous|Next|Contents|About|ONET)\s*', '', desc)
    desc = re.sub(r'Buy the DOT:?\s*Download\s*', '', desc)
    desc = re.sub(r'^\s*CODE:\s*[\d.\-]+\s*', '', desc)
    desc = re.sub(r'^\s*TITLE\(s\):\s*', '', desc)

    # Normalize whitespace
    desc = re.sub(r'\s+', ' ', desc).strip()

    # Remove if too short to be meaningful
    if len(desc) < 15:
        desc = None

    entry["description"] = desc
    return entry


def normalize_strength(entry: dict) -> dict:
    """Normalize strength codes."""
    s = entry.get("strength", "")
    if s:
        valid = {"S", "L", "M", "H", "V"}
        entry["strength"] = s.upper() if s.upper() in valid else s
    return entry


def validate_entry(entry: dict) -> bool:
    """Check if entry has minimum required data."""
    return bool(
        entry.get("dot_code")
        and entry.get("title")
        and entry.get("svp") is not None
    )


def main():
    if not os.path.exists(INPUT_FILE):
        print(f"Input file not found: {INPUT_FILE}")
        return

    with open(INPUT_FILE) as f:
        data = json.load(f)

    occupations = data.get("occupations", {})
    print(f"Loaded {len(occupations)} occupations")

    cleaned = {}
    invalid = 0

    for code, entry in occupations.items():
        entry = clean_title(entry)
        entry = clean_description(entry)
        entry = normalize_strength(entry)

        if validate_entry(entry):
            cleaned[code] = entry
        else:
            invalid += 1
            if invalid <= 5:
                print(f"  Invalid entry: {entry.get('dot_code')} - {entry.get('title')}")

    data["occupations"] = cleaned
    data["total_occupations"] = len(cleaned)

    with open(OUTPUT_FILE, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"\nCleaned: {len(cleaned)} valid entries, {invalid} invalid removed")

    # Stats
    has_alt_titles = sum(1 for o in cleaned.values() if o.get("alternate_titles"))
    print(f"Entries with alternate titles: {has_alt_titles}")

    # Show sample
    print("\nSample cleaned entries:")
    for i, (code, entry) in enumerate(list(cleaned.items())[:3]):
        print(f"  {entry['dot_code']} - {entry['title']}")
        if entry.get('industry_desig'):
            print(f"    Industry: {entry['industry_desig']}")
        if entry.get('alternate_titles'):
            print(f"    Alt titles: {entry['alternate_titles']}")


if __name__ == "__main__":
    main()
