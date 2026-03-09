#!/usr/bin/env python3
"""
Convert O*NET 30.2 Excel database to a single comprehensive JSON file.

Reads all major O*NET Excel files and produces src/data/onet-full.json
with the complete dataset for each of 1,016+ occupations.

Uses compact keys to reduce file size:
  t=title, d=description, jz=jobZone, ta=tasks, sk=skills,
  ab=abilities, kn=knowledge, wa=workActivities, wc=workContext,
  tt=toolsTech, dw=dwas, ro=relatedOccs, ws=workStyles,
  in=interests, ed=education, at=alternateTitles,
  id=elementId, n=name, v=value, l=level, im=importance

Usage:
  python3 scripts/convert-onet-excel.py

Input directory:  ~/Downloads/db_30_2_excel/
Output file:      src/data/onet-full.json
"""

import json
import os
import sys
from pathlib import Path
from collections import defaultdict

try:
    import openpyxl
except ImportError:
    print("Installing openpyxl...")
    os.system(f"{sys.executable} -m pip install openpyxl")
    import openpyxl

EXCEL_DIR = Path.home() / "Downloads" / "db_30_2_excel"
OUTPUT_FILE = Path(__file__).parent.parent / "src" / "data" / "onet-full.json"


def read_xlsx(filename: str):
    """Read an Excel file and return header + rows."""
    path = EXCEL_DIR / filename
    if not path.exists():
        print(f"  WARNING: {filename} not found, skipping")
        return [], []

    wb = openpyxl.load_workbook(str(path), read_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    wb.close()

    if not rows:
        return [], []

    header = [str(h) if h else f"col{i}" for i, h in enumerate(rows[0])]
    return header, rows[1:]


def main():
    print("=" * 60)
    print("O*NET 30.2 Excel → JSON Converter (compact)")
    print("=" * 60)

    if not EXCEL_DIR.exists():
        print(f"ERROR: Directory not found: {EXCEL_DIR}")
        sys.exit(1)

    # ── 1. Occupation Data (code, title, description) ──────────────────
    print("\n1. Reading Occupation Data...")
    header, rows = read_xlsx("Occupation Data.xlsx")
    occs = {}
    for row in rows:
        d = dict(zip(header, row))
        code = d["O*NET-SOC Code"]
        occs[code] = {
            "t": d["Title"],
            "d": d.get("Description", ""),
        }
    print(f"   {len(occs)} occupations loaded")

    # ── 2. Job Zones ───────────────────────────────────────────────────
    print("2. Reading Job Zones...")
    header, rows = read_xlsx("Job Zones.xlsx")
    for row in rows:
        d = dict(zip(header, row))
        code = d["O*NET-SOC Code"]
        if code in occs:
            jz = d.get("Job Zone")
            if jz is not None:
                occs[code]["jz"] = int(jz)
    print(f"   Job zones mapped")

    # ── 3. Task Statements + Task Ratings ──────────────────────────────
    print("3. Reading Task Statements...")
    header, rows = read_xlsx("Task Statements.xlsx")
    tasks_by_occ = defaultdict(list)
    for row in rows:
        d = dict(zip(header, row))
        code = d["O*NET-SOC Code"]
        task_id = d.get("Task ID")
        task_text = d.get("Task", "")
        if task_id and task_text:
            tasks_by_occ[code].append({
                "id": str(task_id),
                "t": task_text,
            })

    print("   Reading Task Ratings (importance)...")
    header, rows = read_xlsx("Task Ratings.xlsx")
    task_imp = {}
    for row in rows:
        d = dict(zip(header, row))
        if d.get("Scale ID") == "IM":
            code = d["O*NET-SOC Code"]
            task_id = str(d.get("Task ID", ""))
            val = d.get("Data Value")
            if val is not None:
                task_imp[(code, task_id)] = round(float(val), 2)

    for code, tasks in tasks_by_occ.items():
        for task in tasks:
            imp = task_imp.get((code, task["id"]))
            if imp is not None:
                task["im"] = imp
        tasks.sort(key=lambda x: x.get("im", 0), reverse=True)

    for code in occs:
        if code in tasks_by_occ:
            occs[code]["ta"] = tasks_by_occ[code]
    print(f"   {sum(len(v) for v in tasks_by_occ.values())} tasks loaded")

    # ── Helper for scored element files (Skills, Abilities, Knowledge, Work Activities) ──
    def read_scored_elements(filename, label):
        """Read an element file with IM/LV scales. Returns {code: [{id, n, v, l}]}"""
        print(f"   Reading {filename}...")
        header, rows = read_xlsx(filename)
        by_occ = defaultdict(list)
        seen = set()
        lv_vals = {}

        for row in rows:
            d = dict(zip(header, row))
            code = d["O*NET-SOC Code"]
            scale_id = d.get("Scale ID", "")
            eid = d.get("Element ID", "")
            val = d.get("Data Value")

            if scale_id == "IM":
                key = (code, eid)
                if key not in seen:
                    seen.add(key)
                    entry = {"id": eid, "n": d.get("Element Name", "")}
                    if val is not None:
                        entry["v"] = round(float(val), 2)
                    by_occ[code].append(entry)
            elif scale_id == "LV" and val is not None:
                lv_vals[(code, eid)] = round(float(val), 2)

        for code, items in by_occ.items():
            for item in items:
                lv = lv_vals.get((code, item["id"]))
                if lv is not None:
                    item["l"] = lv
            items.sort(key=lambda x: x.get("v", 0), reverse=True)

        count = sum(len(v) for v in by_occ.values())
        print(f"   {count} {label} entries loaded")
        return by_occ

    # ── 4-7. Skills, Abilities, Knowledge, Work Activities ─────────────
    print("\n4. Skills, Abilities, Knowledge, Work Activities:")

    skills_by_occ = read_scored_elements("Skills.xlsx", "skill")
    for code in occs:
        if code in skills_by_occ:
            occs[code]["sk"] = skills_by_occ[code]

    abilities_by_occ = read_scored_elements("Abilities.xlsx", "ability")
    for code in occs:
        if code in abilities_by_occ:
            occs[code]["ab"] = abilities_by_occ[code]

    knowledge_by_occ = read_scored_elements("Knowledge.xlsx", "knowledge")
    for code in occs:
        if code in knowledge_by_occ:
            occs[code]["kn"] = knowledge_by_occ[code]

    wa_by_occ = read_scored_elements("Work Activities.xlsx", "work activity")
    for code in occs:
        if code in wa_by_occ:
            occs[code]["wa"] = wa_by_occ[code]

    # ── 8. Work Context ────────────────────────────────────────────────
    print("\n5. Reading Work Context...")
    header, rows = read_xlsx("Work Context.xlsx")
    wc_by_occ = defaultdict(list)
    seen_wc = set()
    for row in rows:
        d = dict(zip(header, row))
        code = d["O*NET-SOC Code"]
        scale_id = d.get("Scale ID", "")
        eid = d.get("Element ID", "")
        category = d.get("Category")
        val = d.get("Data Value")

        # Use CX scale (overall mean, no category)
        if scale_id == "CX" and category is None:
            key = (code, eid)
            if key not in seen_wc:
                seen_wc.add(key)
                entry = {"id": eid, "n": d.get("Element Name", "")}
                if val is not None:
                    entry["v"] = round(float(val), 2)
                wc_by_occ[code].append(entry)

    for code in occs:
        if code in wc_by_occ:
            occs[code]["wc"] = wc_by_occ[code]

    print(f"   {sum(len(v) for v in wc_by_occ.values())} work context entries loaded")

    # ── 9-10. Technology Skills + Tools Used ───────────────────────────
    print("\n6. Reading Technology Skills + Tools Used...")
    header, rows = read_xlsx("Technology Skills.xlsx")
    tech_by_occ = defaultdict(list)
    for row in rows:
        d = dict(zip(header, row))
        code = d["O*NET-SOC Code"]
        example = d.get("Example", "")
        if example:
            entry = {"t": example, "c": d.get("Commodity Title", "")}
            if d.get("Hot Technology", "") == "Y":
                entry["h"] = True
            tech_by_occ[code].append(entry)

    header, rows = read_xlsx("Tools Used.xlsx")
    for row in rows:
        d = dict(zip(header, row))
        code = d["O*NET-SOC Code"]
        example = d.get("Example", "")
        if example:
            tech_by_occ[code].append({"t": example, "c": d.get("Commodity Title", "")})

    for code in occs:
        if code in tech_by_occ:
            occs[code]["tt"] = tech_by_occ[code]

    print(f"   {sum(len(v) for v in tech_by_occ.values())} tools/tech entries loaded")

    # ── 11. Tasks to DWAs ──────────────────────────────────────────────
    print("\n7. Reading Tasks to DWAs...")
    header, rows = read_xlsx("Tasks to DWAs.xlsx")
    dwas_by_occ = defaultdict(dict)
    for row in rows:
        d = dict(zip(header, row))
        code = d["O*NET-SOC Code"]
        dwa_id = d.get("DWA ID", "")
        dwa_title = d.get("DWA Title", "")
        if dwa_id and dwa_title:
            dwas_by_occ[code][dwa_id] = dwa_title

    for code in occs:
        if code in dwas_by_occ:
            occs[code]["dw"] = [
                {"id": did, "t": dtitle}
                for did, dtitle in dwas_by_occ[code].items()
            ]

    print(f"   {sum(len(v) for v in dwas_by_occ.values())} unique DWAs loaded")

    # ── 12. Related Occupations ────────────────────────────────────────
    print("\n8. Reading Related Occupations...")
    header, rows = read_xlsx("Related Occupations.xlsx")
    related_by_occ = defaultdict(list)
    for row in rows:
        d = dict(zip(header, row))
        code = d["O*NET-SOC Code"]
        rel_code = d.get("Related O*NET-SOC Code", "")
        rel_title = d.get("Related Title", "")
        if rel_code and rel_title:
            related_by_occ[code].append({"c": rel_code, "t": rel_title})

    for code in occs:
        if code in related_by_occ:
            occs[code]["ro"] = related_by_occ[code]

    print(f"   {sum(len(v) for v in related_by_occ.values())} related occupation entries loaded")

    # ── 13. Work Styles ────────────────────────────────────────────────
    print("\n9. Reading Work Styles...")
    header, rows = read_xlsx("Work Styles.xlsx")
    ws_by_occ = defaultdict(list)
    seen_ws = set()
    for row in rows:
        d = dict(zip(header, row))
        code = d["O*NET-SOC Code"]
        scale_id = d.get("Scale ID", "")
        eid = d.get("Element ID", "")
        val = d.get("Data Value")

        # Work Styles uses WI (Work Styles Impact) scale
        if scale_id == "WI":
            key = (code, eid)
            if key not in seen_ws:
                seen_ws.add(key)
                entry = {"id": eid, "n": d.get("Element Name", "")}
                if val is not None:
                    entry["v"] = round(float(val), 2)
                ws_by_occ[code].append(entry)

    for code, items in ws_by_occ.items():
        items.sort(key=lambda x: x.get("v", 0), reverse=True)

    for code in occs:
        if code in ws_by_occ:
            occs[code]["ws"] = ws_by_occ[code]

    print(f"   {sum(len(v) for v in ws_by_occ.values())} work style entries loaded")

    # ── 14. Interests (RIASEC) ─────────────────────────────────────────
    print("\n10. Reading Interests...")
    header, rows = read_xlsx("Interests.xlsx")
    interests_by_occ = defaultdict(list)
    seen_int = set()
    for row in rows:
        d = dict(zip(header, row))
        code = d["O*NET-SOC Code"]
        scale_id = d.get("Scale ID", "")
        eid = d.get("Element ID", "")
        val = d.get("Data Value")

        if scale_id == "OI":
            key = (code, eid)
            if key not in seen_int:
                seen_int.add(key)
                entry = {"id": eid, "n": d.get("Element Name", "")}
                if val is not None:
                    entry["v"] = round(float(val), 2)
                interests_by_occ[code].append(entry)

    for code, items in interests_by_occ.items():
        items.sort(key=lambda x: x.get("v", 0), reverse=True)

    for code in occs:
        if code in interests_by_occ:
            occs[code]["in"] = interests_by_occ[code]

    print(f"   {sum(len(v) for v in interests_by_occ.values())} interest entries loaded")

    # ── 15. Education, Training, and Experience ────────────────────────
    print("\n11. Reading Education, Training, and Experience...")
    header, rows = read_xlsx("Education, Training, and Experience.xlsx")
    edu_by_occ = defaultdict(list)
    for row in rows:
        d = dict(zip(header, row))
        code = d["O*NET-SOC Code"]
        val = d.get("Data Value")
        if val is not None and float(val) > 0:
            edu_by_occ[code].append({
                "id": d.get("Element ID", ""),
                "n": d.get("Element Name", ""),
                "s": d.get("Scale ID", ""),
                "cat": d.get("Category"),
                "v": round(float(val), 2),
            })

    for code in occs:
        if code in edu_by_occ:
            occs[code]["ed"] = edu_by_occ[code]

    print(f"   {sum(len(v) for v in edu_by_occ.values())} education entries loaded")

    # ── 16. Alternate Titles ───────────────────────────────────────────
    print("\n12. Reading Alternate Titles...")
    header, rows = read_xlsx("Alternate Titles.xlsx")
    alt_by_occ = defaultdict(list)
    for row in rows:
        d = dict(zip(header, row))
        code = d["O*NET-SOC Code"]
        alt = d.get("Alternate Title", "")
        if alt:
            alt_by_occ[code].append(alt)

    for code in occs:
        if code in alt_by_occ:
            occs[code]["at"] = alt_by_occ[code]

    print(f"   {sum(len(v) for v in alt_by_occ.values())} alternate titles loaded")

    # ── Summary & Output ───────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("Summary:")

    field_names = {
        "ta": "tasks", "sk": "skills", "ab": "abilities", "kn": "knowledge",
        "wa": "workActivities", "wc": "workContext", "tt": "toolsTech",
        "dw": "dwas", "ro": "relatedOccs", "ws": "workStyles",
        "in": "interests", "ed": "education", "at": "alternateTitles",
        "jz": "jobZone", "d": "description",
    }

    has_fields = defaultdict(int)
    for code, occ in occs.items():
        for key, name in field_names.items():
            if key in occ and occ[key]:
                has_fields[name] += 1

    for name, count in sorted(has_fields.items(), key=lambda x: -x[1]):
        print(f"  {name}: {count}/{len(occs)} occupations")

    # Write output
    print(f"\nWriting {OUTPUT_FILE}...")
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    with open(OUTPUT_FILE, "w") as f:
        json.dump(occs, f, separators=(",", ":"))

    size_mb = OUTPUT_FILE.stat().st_size / 1024 / 1024
    print(f"Output: {size_mb:.1f} MB ({len(occs)} occupations)")
    print("Done!")


if __name__ == "__main__":
    main()
