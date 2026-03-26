#!/bin/bash
# Seed the deployed PVQ-TM database with complete test cases
# ready for analysis via the API endpoints.
#
# Usage: bash scripts/seed-test-cases.sh [BASE_URL]

BASE_URL="${1:-https://pvq-tm-production.up.railway.app}"
echo "Seeding test cases at: $BASE_URL"

# ─── Helper ─────────────────────────────────────────────────────────
post() {
  curl -s -X POST "$BASE_URL$1" \
    -H "Content-Type: application/json" \
    -d "$2"
}
put() {
  curl -s -X PUT "$BASE_URL$1" \
    -H "Content-Type: application/json" \
    -d "$2"
}
get() {
  curl -s "$BASE_URL$1"
}

# ════════════════════════════════════════════════════════════════════
# CASE 1: Warehouse Worker → Office/Light Work (Classic PI)
# ════════════════════════════════════════════════════════════════════
echo ""
echo "═══ Creating Case 1: Warehouse Worker PI ═══"

CASE1=$(post "/api/cases" '{
  "clientName": "Martinez, Roberto",
  "caseType": "pi",
  "caseName": "Warehouse Worker PI - Full Test",
  "clientDOB": "1978-06-15T00:00:00.000Z",
  "dateOfInjury": "2024-03-10T00:00:00.000Z",
  "evaluatorName": "Dr. Smith",
  "zipCode": "78701",
  "state": "TX"
}')
CASE1_ID=$(echo "$CASE1" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "  Case 1 ID: $CASE1_ID"

if [ -z "$CASE1_ID" ] || [ "$CASE1_ID" = "" ]; then
  echo "  ERROR: Failed to create case 1. Response: $CASE1"
  exit 1
fi

# ─── PRW: 2 jobs ────────────────────────────────────────────────────
echo "  Adding Past Relevant Work..."
post "/api/cases/$CASE1_ID/prw" '{
  "jobTitle": "Warehouse Worker",
  "employer": "Amazon Fulfillment Center",
  "dotCode": "922687010",
  "onetSocCode": "53-7062.00",
  "svp": 3,
  "startDate": "2015-01-01T00:00:00.000Z",
  "endDate": "2024-03-10T00:00:00.000Z",
  "durationMonths": 110,
  "dutiesDescription": "Loaded and unloaded freight, sorted packages, operated pallet jacks and hand trucks, maintained inventory counts, prepared shipments",
  "isSubstantialGainful": true,
  "actualWageAnnual": 38500
}' > /dev/null

post "/api/cases/$CASE1_ID/prw" '{
  "jobTitle": "Delivery Driver",
  "employer": "FedEx Ground",
  "dotCode": "906683010",
  "onetSocCode": "53-3031.00",
  "svp": 4,
  "startDate": "2010-06-01T00:00:00.000Z",
  "endDate": "2014-12-31T00:00:00.000Z",
  "durationMonths": 55,
  "dutiesDescription": "Drove delivery route, loaded/sorted packages by route, collected signatures, maintained delivery records, performed vehicle inspections",
  "isSubstantialGainful": true,
  "actualWageAnnual": 42000
}' > /dev/null

# ─── Acquired Skills ────────────────────────────────────────────────
echo "  Adding Acquired Skills..."
for skill in \
  '{"actionVerb":"Operate","object":"material handling equipment","context":"warehouse environment","toolsSoftware":"Pallet jacks, hand trucks, RF scanners","svpLevel":4,"isTransferable":true}' \
  '{"actionVerb":"Track","object":"inventory and shipments","context":"fulfillment operations","toolsSoftware":"WMS software, barcode scanners","svpLevel":4,"isTransferable":true}' \
  '{"actionVerb":"Sort","object":"packages by route and priority","context":"distribution center","materialsServices":"Shipping labels, manifests","svpLevel":4,"isTransferable":true}' \
  '{"actionVerb":"Drive","object":"commercial delivery vehicles","context":"urban delivery routes","toolsSoftware":"GPS navigation, route optimization","svpLevel":5,"isTransferable":true}' \
  '{"actionVerb":"Maintain","object":"delivery and inventory records","context":"logistics operations","toolsSoftware":"Handheld scanners, delivery software","svpLevel":4,"isTransferable":true}'
do
  post "/api/cases/$CASE1_ID/skills" "$skill" > /dev/null
done

# ─── POST Profile (post-injury: reduced to light/sedentary) ────────
echo "  Adding POST worker profile (post-injury)..."
post "/api/cases/$CASE1_ID/profiles" '{
  "profileType": "POST",
  "reasoning": 3,
  "math": 3,
  "language": 3,
  "spatialPerception": 3,
  "formPerception": 3,
  "clericalPerception": 3,
  "motorCoordination": 3,
  "fingerDexterity": 3,
  "manualDexterity": 3,
  "eyeHandFoot": 2,
  "colorDiscrimination": 4,
  "strength": 2,
  "climbBalance": 1,
  "stoopKneel": 1,
  "reachHandle": 2,
  "talkHear": 4,
  "see": 4,
  "workLocation": 3,
  "extremeCold": 1,
  "extremeHeat": 1,
  "wetnessHumidity": 1,
  "noiseVibration": 2,
  "hazards": 1,
  "dustsFumes": 1,
  "notes": "Post-injury: L4-L5 disc herniation. Restricted to light duty. No repetitive bending/stooping. Limited overhead reaching."
}' > /dev/null

# ─── PRE Profile (pre-injury: full capacity) ───────────────────────
echo "  Adding PRE worker profile (pre-injury)..."
post "/api/cases/$CASE1_ID/profiles" '{
  "profileType": "PRE",
  "reasoning": 3,
  "math": 3,
  "language": 3,
  "spatialPerception": 3,
  "formPerception": 3,
  "clericalPerception": 3,
  "motorCoordination": 4,
  "fingerDexterity": 4,
  "manualDexterity": 4,
  "eyeHandFoot": 4,
  "colorDiscrimination": 4,
  "strength": 4,
  "climbBalance": 3,
  "stoopKneel": 3,
  "reachHandle": 4,
  "talkHear": 4,
  "see": 4,
  "workLocation": 4,
  "extremeCold": 3,
  "extremeHeat": 3,
  "wetnessHumidity": 3,
  "noiseVibration": 3,
  "hazards": 3,
  "dustsFumes": 3,
  "notes": "Pre-injury: full physical capacity, no restrictions"
}' > /dev/null

echo "  ✅ Case 1 complete: $BASE_URL/cases/$CASE1_ID"

# ════════════════════════════════════════════════════════════════════
# CASE 2: Office Manager → Sedentary Work (Advanced Age)
# ════════════════════════════════════════════════════════════════════
echo ""
echo "═══ Creating Case 2: Office Manager - Advanced Age ═══"

CASE2=$(post "/api/cases" '{
  "clientName": "Johnson, Patricia",
  "caseType": "pi",
  "caseName": "Office Manager Advanced Age Test",
  "clientDOB": "1968-02-20T00:00:00.000Z",
  "dateOfInjury": "2023-11-15T00:00:00.000Z",
  "evaluatorName": "Dr. Williams",
  "zipCode": "10001",
  "state": "NY"
}')
CASE2_ID=$(echo "$CASE2" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "  Case 2 ID: $CASE2_ID"

if [ -z "$CASE2_ID" ] || [ "$CASE2_ID" = "" ]; then
  echo "  ERROR: Failed to create case 2. Response: $CASE2"
  exit 1
fi

# ─── PRW ────────────────────────────────────────────────────────────
echo "  Adding Past Relevant Work..."
post "/api/cases/$CASE2_ID/prw" '{
  "jobTitle": "Office Manager",
  "employer": "Henderson & Associates Law Firm",
  "dotCode": "169167010",
  "onetSocCode": "11-3012.00",
  "svp": 7,
  "startDate": "2005-03-01T00:00:00.000Z",
  "endDate": "2023-11-15T00:00:00.000Z",
  "durationMonths": 224,
  "dutiesDescription": "Supervised office staff, managed accounts payable/receivable, coordinated scheduling, maintained filing systems, ordered supplies, prepared reports",
  "isSubstantialGainful": true,
  "actualWageAnnual": 58000
}' > /dev/null

post "/api/cases/$CASE2_ID/prw" '{
  "jobTitle": "Administrative Assistant",
  "employer": "City of New York",
  "dotCode": "169167014",
  "onetSocCode": "43-6014.00",
  "svp": 5,
  "startDate": "1998-09-01T00:00:00.000Z",
  "endDate": "2005-02-28T00:00:00.000Z",
  "durationMonths": 78,
  "dutiesDescription": "Answered phones, scheduled meetings, prepared correspondence, maintained records, processed invoices, data entry",
  "isSubstantialGainful": true,
  "actualWageAnnual": 42000
}' > /dev/null

# ─── Acquired Skills ────────────────────────────────────────────────
echo "  Adding Acquired Skills..."
for skill in \
  '{"actionVerb":"Supervise","object":"office staff and operations","context":"professional office environment","toolsSoftware":"Microsoft Office, QuickBooks","svpLevel":7,"isTransferable":true}' \
  '{"actionVerb":"Manage","object":"accounts payable and receivable","context":"law firm financial operations","toolsSoftware":"QuickBooks, Excel spreadsheets","svpLevel":6,"isTransferable":true}' \
  '{"actionVerb":"Coordinate","object":"scheduling and calendars","context":"multi-attorney law firm","toolsSoftware":"Outlook, Google Calendar","svpLevel":5,"isTransferable":true}' \
  '{"actionVerb":"Prepare","object":"business correspondence and reports","context":"professional services","toolsSoftware":"Word, Excel, PowerPoint","svpLevel":5,"isTransferable":true}' \
  '{"actionVerb":"Process","object":"data entry and records management","context":"government office","toolsSoftware":"Database systems, filing systems","svpLevel":4,"isTransferable":true}'
do
  post "/api/cases/$CASE2_ID/skills" "$skill" > /dev/null
done

# ─── POST Profile (sedentary restrictions) ─────────────────────────
echo "  Adding POST worker profile..."
post "/api/cases/$CASE2_ID/profiles" '{
  "profileType": "POST",
  "reasoning": 4,
  "math": 4,
  "language": 4,
  "spatialPerception": 3,
  "formPerception": 3,
  "clericalPerception": 4,
  "motorCoordination": 3,
  "fingerDexterity": 3,
  "manualDexterity": 2,
  "eyeHandFoot": 2,
  "colorDiscrimination": 4,
  "strength": 1,
  "climbBalance": 0,
  "stoopKneel": 1,
  "reachHandle": 2,
  "talkHear": 4,
  "see": 4,
  "workLocation": 2,
  "extremeCold": 1,
  "extremeHeat": 1,
  "wetnessHumidity": 1,
  "noiseVibration": 2,
  "hazards": 0,
  "dustsFumes": 1,
  "notes": "Post-injury: bilateral carpal tunnel, right shoulder rotator cuff tear. Sedentary only. No repetitive gripping. Limited keyboard time."
}' > /dev/null

echo "  Adding PRE worker profile..."
post "/api/cases/$CASE2_ID/profiles" '{
  "profileType": "PRE",
  "reasoning": 4,
  "math": 4,
  "language": 4,
  "spatialPerception": 3,
  "formPerception": 3,
  "clericalPerception": 4,
  "motorCoordination": 4,
  "fingerDexterity": 4,
  "manualDexterity": 4,
  "eyeHandFoot": 3,
  "colorDiscrimination": 4,
  "strength": 2,
  "climbBalance": 2,
  "stoopKneel": 2,
  "reachHandle": 3,
  "talkHear": 4,
  "see": 4,
  "workLocation": 3,
  "extremeCold": 2,
  "extremeHeat": 2,
  "wetnessHumidity": 2,
  "noiseVibration": 3,
  "hazards": 2,
  "dustsFumes": 2,
  "notes": "Pre-injury: light-medium capacity, no restrictions"
}' > /dev/null

echo "  ✅ Case 2 complete: $BASE_URL/cases/$CASE2_ID"

# ════════════════════════════════════════════════════════════════════
# CASE 3: Construction Worker → Very Limited (Severe Restrictions)
# ════════════════════════════════════════════════════════════════════
echo ""
echo "═══ Creating Case 3: Construction Worker - Severe ═══"

CASE3=$(post "/api/cases" '{
  "clientName": "Williams, James",
  "caseType": "pi",
  "caseName": "Construction Worker Severe Restrictions",
  "clientDOB": "1985-09-22T00:00:00.000Z",
  "dateOfInjury": "2024-01-08T00:00:00.000Z",
  "evaluatorName": "Dr. Chen",
  "zipCode": "04101",
  "state": "ME"
}')
CASE3_ID=$(echo "$CASE3" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "  Case 3 ID: $CASE3_ID"

if [ -z "$CASE3_ID" ] || [ "$CASE3_ID" = "" ]; then
  echo "  ERROR: Failed to create case 3. Response: $CASE3"
  exit 1
fi

# ─── PRW ────────────────────────────────────────────────────────────
echo "  Adding Past Relevant Work..."
post "/api/cases/$CASE3_ID/prw" '{
  "jobTitle": "Carpenter",
  "employer": "Maine Builders Inc.",
  "dotCode": "860381022",
  "onetSocCode": "47-2031.00",
  "svp": 7,
  "startDate": "2008-04-01T00:00:00.000Z",
  "endDate": "2024-01-08T00:00:00.000Z",
  "durationMonths": 189,
  "dutiesDescription": "Framed residential structures, installed doors/windows, read blueprints, measured and cut lumber, operated power tools, supervised helpers",
  "isSubstantialGainful": true,
  "actualWageAnnual": 52000
}' > /dev/null

post "/api/cases/$CASE3_ID/prw" '{
  "jobTitle": "Construction Laborer",
  "employer": "Various contractors",
  "dotCode": "869687026",
  "onetSocCode": "47-2061.00",
  "svp": 3,
  "startDate": "2005-06-01T00:00:00.000Z",
  "endDate": "2008-03-31T00:00:00.000Z",
  "durationMonths": 34,
  "dutiesDescription": "Mixed concrete, carried materials, cleaned job sites, operated hand tools, assisted skilled tradespeople",
  "isSubstantialGainful": true,
  "actualWageAnnual": 32000
}' > /dev/null

# ─── Acquired Skills ────────────────────────────────────────────────
echo "  Adding Acquired Skills..."
for skill in \
  '{"actionVerb":"Read","object":"blueprints and construction plans","context":"residential construction","toolsSoftware":"Tape measures, levels, squares","svpLevel":7,"isTransferable":true}' \
  '{"actionVerb":"Measure","object":"building materials for cutting","context":"framing and finish carpentry","toolsSoftware":"Tape measures, speed squares, levels","svpLevel":6,"isTransferable":true}' \
  '{"actionVerb":"Operate","object":"power tools and equipment","context":"construction sites","toolsSoftware":"Circular saws, nail guns, drills, routers","svpLevel":5,"isTransferable":true}' \
  '{"actionVerb":"Supervise","object":"construction helpers and laborers","context":"job site operations","svpLevel":5,"isTransferable":true}' \
  '{"actionVerb":"Estimate","object":"material quantities and project timelines","context":"residential building projects","toolsSoftware":"Estimating software, Excel","svpLevel":6,"isTransferable":true}'
do
  post "/api/cases/$CASE3_ID/skills" "$skill" > /dev/null
done

# ─── POST Profile (severe restrictions — sedentary) ────────────────
echo "  Adding POST worker profile (severe restrictions)..."
post "/api/cases/$CASE3_ID/profiles" '{
  "profileType": "POST",
  "reasoning": 3,
  "math": 3,
  "language": 3,
  "spatialPerception": 4,
  "formPerception": 3,
  "clericalPerception": 2,
  "motorCoordination": 2,
  "fingerDexterity": 2,
  "manualDexterity": 1,
  "eyeHandFoot": 1,
  "colorDiscrimination": 4,
  "strength": 1,
  "climbBalance": 0,
  "stoopKneel": 0,
  "reachHandle": 1,
  "talkHear": 4,
  "see": 4,
  "workLocation": 1,
  "extremeCold": 0,
  "extremeHeat": 0,
  "wetnessHumidity": 0,
  "noiseVibration": 1,
  "hazards": 0,
  "dustsFumes": 0,
  "notes": "Post-injury: TBI with cognitive deficits, L-spine fusion, bilateral knee replacements. Sedentary only. No environmental exposures. Limited fine motor."
}' > /dev/null

echo "  Adding PRE worker profile..."
post "/api/cases/$CASE3_ID/profiles" '{
  "profileType": "PRE",
  "reasoning": 3,
  "math": 3,
  "language": 3,
  "spatialPerception": 4,
  "formPerception": 4,
  "clericalPerception": 3,
  "motorCoordination": 4,
  "fingerDexterity": 4,
  "manualDexterity": 4,
  "eyeHandFoot": 4,
  "colorDiscrimination": 4,
  "strength": 4,
  "climbBalance": 4,
  "stoopKneel": 4,
  "reachHandle": 4,
  "talkHear": 4,
  "see": 4,
  "workLocation": 4,
  "extremeCold": 4,
  "extremeHeat": 4,
  "wetnessHumidity": 4,
  "noiseVibration": 4,
  "hazards": 4,
  "dustsFumes": 4,
  "notes": "Pre-injury: very heavy capacity, full unrestricted"
}' > /dev/null

echo "  ✅ Case 3 complete: $BASE_URL/cases/$CASE3_ID"

# ════════════════════════════════════════════════════════════════════
echo ""
echo "════════════════════════════════════════════════════════"
echo "  ALL 3 TEST CASES SEEDED SUCCESSFULLY"
echo "════════════════════════════════════════════════════════"
echo ""
echo "  Case 1: Martinez, Roberto  (Warehouse Worker PI)"
echo "    → ID: $CASE1_ID"
echo "    → Light duty, SVP 3-4 PRW, TX location"
echo ""
echo "  Case 2: Johnson, Patricia  (Office Manager Advanced Age)"
echo "    → ID: $CASE2_ID"
echo "    → Sedentary, SVP 5-7 PRW, NY location, age 58"
echo ""
echo "  Case 3: Williams, James   (Construction Severe)"
echo "    → ID: $CASE3_ID"
echo "    → Sedentary, SVP 3-7 PRW, ME location, severe restrictions"
echo ""
echo "  NEXT STEPS:"
echo "  1. Go to $BASE_URL"
echo "  2. Click 'Resume' on any case"
echo "  3. Navigate to the Analysis step"
echo "  4. Hit 'Run Analysis' to test the calculation engine"
echo "════════════════════════════════════════════════════════"
