import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/geo/zip-to-metro?zip=XXXXX
 *
 * Converts a US zip code to the corresponding BLS metropolitan area code.
 * Uses comprehensive ZIP3→metro mapping plus state-level fallback.
 * Returns areaCode + areaName for use in OEWS wage lookups.
 */
export async function GET(req: NextRequest) {
  const zip = req.nextUrl.searchParams.get("zip");
  if (!zip || zip.length !== 5) {
    return NextResponse.json({ error: "Valid 5-digit zip code required" }, { status: 400 });
  }

  const zip3 = zip.substring(0, 3);

  // 1. Try exact ZIP3→metro match
  const metro = ZIP3_TO_METRO[zip3];
  if (metro) {
    return NextResponse.json({
      zipCode: zip,
      areaCode: metro.code,
      areaName: metro.name,
      areaType: "metro",
    });
  }

  // 2. Fallback: determine state from ZIP3 range → use state's largest metro
  const state = getStateFromZip3(parseInt(zip3, 10));
  if (state && STATE_FALLBACK[state]) {
    const fb = STATE_FALLBACK[state];
    return NextResponse.json({
      zipCode: zip,
      areaCode: fb.code,
      areaName: fb.name,
      areaType: "state_metro",
      note: `No exact metro match. Using ${state}'s largest metro area.`,
    });
  }

  // 3. Last resort: national
  return NextResponse.json({
    zipCode: zip,
    areaCode: "0000000",
    areaName: "National",
    areaType: "national",
  });
}

/** Determine US state abbreviation from ZIP3 numeric value */
function getStateFromZip3(z: number): string | null {
  if (z >= 6 && z <= 9) return "PR";
  if (z >= 10 && z <= 27) return "MA";
  if (z >= 28 && z <= 29) return "RI";
  if (z >= 30 && z <= 38) return "NH";
  if (z >= 39 && z <= 49) return "ME";
  if (z >= 50 && z <= 59) return "VT";
  if (z >= 60 && z <= 69) return "CT";
  if (z >= 70 && z <= 89) return "NJ";
  if (z >= 100 && z <= 149) return "NY";
  if (z >= 150 && z <= 196) return "PA";
  if (z >= 197 && z <= 199) return "DE";
  if (z >= 200 && z <= 205) return "DC";
  if (z >= 206 && z <= 219) return "MD";
  if (z >= 220 && z <= 246) return "VA";
  if (z >= 247 && z <= 268) return "WV";
  if (z >= 270 && z <= 289) return "NC";
  if (z >= 290 && z <= 299) return "SC";
  if (z >= 300 && z <= 319) return "GA";
  if (z >= 320 && z <= 349) return "FL";
  if (z >= 350 && z <= 369) return "AL";
  if (z >= 370 && z <= 385) return "TN";
  if (z >= 386 && z <= 397) return "MS";
  if (z >= 398 && z <= 399) return "GA";
  if (z >= 400 && z <= 427) return "KY";
  if (z >= 430 && z <= 458) return "OH";
  if (z >= 460 && z <= 479) return "IN";
  if (z >= 480 && z <= 499) return "MI";
  if (z >= 500 && z <= 528) return "IA";
  if (z >= 530 && z <= 549) return "WI";
  if (z >= 550 && z <= 567) return "MN";
  if (z >= 570 && z <= 577) return "SD";
  if (z >= 580 && z <= 588) return "ND";
  if (z >= 590 && z <= 599) return "MT";
  if (z >= 600 && z <= 629) return "IL";
  if (z >= 630 && z <= 658) return "MO";
  if (z >= 660 && z <= 679) return "KS";
  if (z >= 680 && z <= 693) return "NE";
  if (z >= 700 && z <= 714) return "LA";
  if (z >= 716 && z <= 729) return "AR";
  if (z >= 730 && z <= 749) return "OK";
  if (z >= 750 && z <= 799) return "TX";
  if (z >= 800 && z <= 816) return "CO";
  if (z >= 820 && z <= 831) return "WY";
  if (z >= 832 && z <= 838) return "ID";
  if (z >= 840 && z <= 847) return "UT";
  if (z >= 850 && z <= 865) return "AZ";
  if (z >= 870 && z <= 884) return "NM";
  if (z === 885) return "TX"; // El Paso
  if (z >= 889 && z <= 898) return "NV";
  if (z >= 900 && z <= 961) return "CA";
  if (z >= 967 && z <= 968) return "HI";
  if (z >= 970 && z <= 979) return "OR";
  if (z >= 980 && z <= 994) return "WA";
  if (z >= 995 && z <= 999) return "AK";
  return null;
}

/** State → largest metro area fallback */
const STATE_FALLBACK: Record<string, { code: string; name: string }> = {
  PR: { code: "0041980", name: "San Juan-Bayamon-Caguas, PR" },
  MA: { code: "0014460", name: "Boston-Cambridge-Newton, MA-NH" },
  RI: { code: "0039300", name: "Providence-Warwick, RI-MA" },
  NH: { code: "0031700", name: "Manchester-Nashua, NH" },
  ME: { code: "0038860", name: "Portland-South Portland, ME" },
  VT: { code: "0015540", name: "Burlington-South Burlington, VT" },
  CT: { code: "0025540", name: "Hartford-East Hartford-Middletown, CT" },
  NJ: { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  NY: { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  PA: { code: "0037980", name: "Philadelphia-Camden-Wilmington, PA-NJ-DE-MD" },
  DE: { code: "0037980", name: "Philadelphia-Camden-Wilmington, PA-NJ-DE-MD" },
  DC: { code: "0047900", name: "Washington-Arlington-Alexandria, DC-VA-MD-WV" },
  MD: { code: "0012580", name: "Baltimore-Columbia-Towson, MD" },
  VA: { code: "0047900", name: "Washington-Arlington-Alexandria, DC-VA-MD-WV" },
  WV: { code: "0016580", name: "Charleston, WV" },
  NC: { code: "0016740", name: "Charlotte-Concord-Gastonia, NC-SC" },
  SC: { code: "0017900", name: "Columbia, SC" },
  GA: { code: "0012060", name: "Atlanta-Sandy Springs-Alpharetta, GA" },
  FL: { code: "0033100", name: "Miami-Fort Lauderdale-Pompano Beach, FL" },
  AL: { code: "0013820", name: "Birmingham-Hoover, AL" },
  TN: { code: "0034980", name: "Nashville-Davidson--Murfreesboro--Franklin, TN" },
  MS: { code: "0027140", name: "Jackson, MS" },
  KY: { code: "0031140", name: "Louisville/Jefferson County, KY-IN" },
  OH: { code: "0018140", name: "Columbus, OH" },
  IN: { code: "0026900", name: "Indianapolis-Carmel-Anderson, IN" },
  MI: { code: "0019820", name: "Detroit-Warren-Dearborn, MI" },
  IA: { code: "0019780", name: "Des Moines-West Des Moines, IA" },
  WI: { code: "0033340", name: "Milwaukee-Waukesha, WI" },
  MN: { code: "0033460", name: "Minneapolis-St. Paul-Bloomington, MN-WI" },
  SD: { code: "0043580", name: "Sioux Falls, SD" },
  ND: { code: "0022020", name: "Fargo, ND-MN" },
  MT: { code: "0013740", name: "Billings, MT" },
  IL: { code: "0016980", name: "Chicago-Naperville-Elgin, IL-IN-WI" },
  MO: { code: "0028140", name: "Kansas City, MO-KS" },
  KS: { code: "0048620", name: "Wichita, KS" },
  NE: { code: "0036540", name: "Omaha-Council Bluffs, NE-IA" },
  LA: { code: "0035380", name: "New Orleans-Metairie, LA" },
  AR: { code: "0030780", name: "Little Rock-North Little Rock-Conway, AR" },
  OK: { code: "0036420", name: "Oklahoma City, OK" },
  TX: { code: "0019100", name: "Dallas-Fort Worth-Arlington, TX" },
  CO: { code: "0019740", name: "Denver-Aurora-Lakewood, CO" },
  WY: { code: "0016940", name: "Cheyenne, WY" },
  ID: { code: "0014260", name: "Boise City, ID" },
  UT: { code: "0041620", name: "Salt Lake City, UT" },
  AZ: { code: "0038060", name: "Phoenix-Mesa-Chandler, AZ" },
  NM: { code: "0010740", name: "Albuquerque, NM" },
  NV: { code: "0029820", name: "Las Vegas-Henderson-Paradise, NV" },
  CA: { code: "0031080", name: "Los Angeles-Long Beach-Anaheim, CA" },
  HI: { code: "0046520", name: "Urban Honolulu, HI" },
  OR: { code: "0038900", name: "Portland-Vancouver-Hillsboro, OR-WA" },
  WA: { code: "0042660", name: "Seattle-Tacoma-Bellevue, WA" },
  AK: { code: "0011260", name: "Anchorage, AK" },
};

/**
 * Comprehensive ZIP3→BLS metro area mapping.
 * Covers 100+ metros across all 50 states.
 * BLS area code format: "00" + 5-digit CBSA FIPS code.
 */
const ZIP3_TO_METRO: Record<string, { code: string; name: string }> = {
  // ── Puerto Rico ──
  "006": { code: "0041980", name: "San Juan-Bayamon-Caguas, PR" },
  "007": { code: "0041980", name: "San Juan-Bayamon-Caguas, PR" },
  "009": { code: "0041980", name: "San Juan-Bayamon-Caguas, PR" },

  // ── Massachusetts ──
  "010": { code: "0044140", name: "Springfield, MA" },
  "011": { code: "0044140", name: "Springfield, MA" },
  "012": { code: "0044140", name: "Springfield, MA" },
  "013": { code: "0044140", name: "Springfield, MA" },
  "014": { code: "0049340", name: "Worcester, MA-CT" },
  "015": { code: "0049340", name: "Worcester, MA-CT" },
  "016": { code: "0049340", name: "Worcester, MA-CT" },
  "017": { code: "0049340", name: "Worcester, MA-CT" },
  "018": { code: "0014460", name: "Boston-Cambridge-Newton, MA-NH" },
  "019": { code: "0014460", name: "Boston-Cambridge-Newton, MA-NH" },
  "020": { code: "0014460", name: "Boston-Cambridge-Newton, MA-NH" },
  "021": { code: "0014460", name: "Boston-Cambridge-Newton, MA-NH" },
  "022": { code: "0014460", name: "Boston-Cambridge-Newton, MA-NH" },
  "023": { code: "0014460", name: "Boston-Cambridge-Newton, MA-NH" },
  "024": { code: "0014460", name: "Boston-Cambridge-Newton, MA-NH" },
  "025": { code: "0014460", name: "Boston-Cambridge-Newton, MA-NH" },
  "026": { code: "0014460", name: "Boston-Cambridge-Newton, MA-NH" },
  "027": { code: "0014460", name: "Boston-Cambridge-Newton, MA-NH" },

  // ── Rhode Island ──
  "028": { code: "0039300", name: "Providence-Warwick, RI-MA" },
  "029": { code: "0039300", name: "Providence-Warwick, RI-MA" },

  // ── New Hampshire ──
  "030": { code: "0031700", name: "Manchester-Nashua, NH" },
  "031": { code: "0031700", name: "Manchester-Nashua, NH" },
  "032": { code: "0031700", name: "Manchester-Nashua, NH" },
  "033": { code: "0014460", name: "Boston-Cambridge-Newton, MA-NH" },
  "034": { code: "0031700", name: "Manchester-Nashua, NH" },
  "035": { code: "0031700", name: "Manchester-Nashua, NH" },
  "036": { code: "0031700", name: "Manchester-Nashua, NH" },
  "037": { code: "0031700", name: "Manchester-Nashua, NH" },
  "038": { code: "0031700", name: "Manchester-Nashua, NH" },

  // ── Maine ──
  "039": { code: "0038860", name: "Portland-South Portland, ME" },
  "040": { code: "0038860", name: "Portland-South Portland, ME" },
  "041": { code: "0038860", name: "Portland-South Portland, ME" },
  "042": { code: "0038860", name: "Portland-South Portland, ME" },
  "043": { code: "0012620", name: "Bangor, ME" },
  "044": { code: "0012620", name: "Bangor, ME" },
  "045": { code: "0038860", name: "Portland-South Portland, ME" },
  "046": { code: "0030340", name: "Lewiston-Auburn, ME" },
  "047": { code: "0038860", name: "Portland-South Portland, ME" },
  "048": { code: "0038860", name: "Portland-South Portland, ME" },
  "049": { code: "0012620", name: "Bangor, ME" },

  // ── Vermont ──
  "050": { code: "0015540", name: "Burlington-South Burlington, VT" },
  "054": { code: "0015540", name: "Burlington-South Burlington, VT" },
  "056": { code: "0015540", name: "Burlington-South Burlington, VT" },

  // ── Connecticut ──
  "060": { code: "0025540", name: "Hartford-East Hartford-Middletown, CT" },
  "061": { code: "0025540", name: "Hartford-East Hartford-Middletown, CT" },
  "062": { code: "0025540", name: "Hartford-East Hartford-Middletown, CT" },
  "063": { code: "0035300", name: "New Haven-Milford, CT" },
  "064": { code: "0035300", name: "New Haven-Milford, CT" },
  "065": { code: "0035300", name: "New Haven-Milford, CT" },
  "066": { code: "0025540", name: "Hartford-East Hartford-Middletown, CT" },
  "067": { code: "0025540", name: "Hartford-East Hartford-Middletown, CT" },
  "068": { code: "0014860", name: "Bridgeport-Stamford-Norwalk, CT" },
  "069": { code: "0014860", name: "Bridgeport-Stamford-Norwalk, CT" },

  // ── New Jersey ──
  "070": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "071": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "072": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "073": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "074": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "075": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "076": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "077": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "078": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "079": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "080": { code: "0037980", name: "Philadelphia-Camden-Wilmington, PA-NJ-DE-MD" },
  "081": { code: "0037980", name: "Philadelphia-Camden-Wilmington, PA-NJ-DE-MD" },
  "082": { code: "0037980", name: "Philadelphia-Camden-Wilmington, PA-NJ-DE-MD" },
  "083": { code: "0037980", name: "Philadelphia-Camden-Wilmington, PA-NJ-DE-MD" },
  "084": { code: "0037980", name: "Philadelphia-Camden-Wilmington, PA-NJ-DE-MD" },
  "085": { code: "0045940", name: "Trenton-Princeton, NJ" },
  "086": { code: "0045940", name: "Trenton-Princeton, NJ" },
  "087": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "088": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "089": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },

  // ── New York ──
  "100": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "101": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "102": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "103": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "104": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "105": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "106": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "107": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "108": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "109": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "110": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "111": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "112": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "113": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "114": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "115": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "116": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "117": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "118": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "119": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "120": { code: "0010580", name: "Albany-Schenectady-Troy, NY" },
  "121": { code: "0010580", name: "Albany-Schenectady-Troy, NY" },
  "122": { code: "0010580", name: "Albany-Schenectady-Troy, NY" },
  "123": { code: "0010580", name: "Albany-Schenectady-Troy, NY" },
  "130": { code: "0045060", name: "Syracuse, NY" },
  "131": { code: "0045060", name: "Syracuse, NY" },
  "132": { code: "0045060", name: "Syracuse, NY" },
  "133": { code: "0046540", name: "Utica-Rome, NY" },
  "134": { code: "0046540", name: "Utica-Rome, NY" },
  "140": { code: "0015380", name: "Buffalo-Cheektowaga, NY" },
  "141": { code: "0015380", name: "Buffalo-Cheektowaga, NY" },
  "142": { code: "0015380", name: "Buffalo-Cheektowaga, NY" },
  "143": { code: "0015380", name: "Buffalo-Cheektowaga, NY" },
  "144": { code: "0040380", name: "Rochester, NY" },
  "145": { code: "0040380", name: "Rochester, NY" },
  "146": { code: "0040380", name: "Rochester, NY" },
  "147": { code: "0013780", name: "Binghamton, NY" },
  "148": { code: "0013780", name: "Binghamton, NY" },
  "149": { code: "0013780", name: "Binghamton, NY" },

  // ── Pennsylvania ──
  "150": { code: "0038300", name: "Pittsburgh, PA" },
  "151": { code: "0038300", name: "Pittsburgh, PA" },
  "152": { code: "0038300", name: "Pittsburgh, PA" },
  "153": { code: "0038300", name: "Pittsburgh, PA" },
  "154": { code: "0038300", name: "Pittsburgh, PA" },
  "155": { code: "0038300", name: "Pittsburgh, PA" },
  "156": { code: "0038300", name: "Pittsburgh, PA" },
  "160": { code: "0038300", name: "Pittsburgh, PA" },
  "161": { code: "0038300", name: "Pittsburgh, PA" },
  "170": { code: "0025420", name: "Harrisburg-Carlisle, PA" },
  "171": { code: "0025420", name: "Harrisburg-Carlisle, PA" },
  "172": { code: "0025420", name: "Harrisburg-Carlisle, PA" },
  "175": { code: "0029540", name: "Lancaster, PA" },
  "176": { code: "0029540", name: "Lancaster, PA" },
  "180": { code: "0010900", name: "Allentown-Bethlehem-Easton, PA-NJ" },
  "181": { code: "0010900", name: "Allentown-Bethlehem-Easton, PA-NJ" },
  "182": { code: "0042540", name: "Scranton--Wilkes-Barre, PA" },
  "183": { code: "0042540", name: "Scranton--Wilkes-Barre, PA" },
  "184": { code: "0042540", name: "Scranton--Wilkes-Barre, PA" },
  "185": { code: "0042540", name: "Scranton--Wilkes-Barre, PA" },
  "186": { code: "0042540", name: "Scranton--Wilkes-Barre, PA" },
  "189": { code: "0037980", name: "Philadelphia-Camden-Wilmington, PA-NJ-DE-MD" },
  "190": { code: "0037980", name: "Philadelphia-Camden-Wilmington, PA-NJ-DE-MD" },
  "191": { code: "0037980", name: "Philadelphia-Camden-Wilmington, PA-NJ-DE-MD" },
  "192": { code: "0037980", name: "Philadelphia-Camden-Wilmington, PA-NJ-DE-MD" },
  "193": { code: "0037980", name: "Philadelphia-Camden-Wilmington, PA-NJ-DE-MD" },
  "194": { code: "0037980", name: "Philadelphia-Camden-Wilmington, PA-NJ-DE-MD" },
  "195": { code: "0039740", name: "Reading, PA" },
  "196": { code: "0039740", name: "Reading, PA" },

  // ── Delaware ──
  "197": { code: "0037980", name: "Philadelphia-Camden-Wilmington, PA-NJ-DE-MD" },
  "198": { code: "0037980", name: "Philadelphia-Camden-Wilmington, PA-NJ-DE-MD" },
  "199": { code: "0037980", name: "Philadelphia-Camden-Wilmington, PA-NJ-DE-MD" },

  // ── Washington DC ──
  "200": { code: "0047900", name: "Washington-Arlington-Alexandria, DC-VA-MD-WV" },
  "201": { code: "0047900", name: "Washington-Arlington-Alexandria, DC-VA-MD-WV" },
  "202": { code: "0047900", name: "Washington-Arlington-Alexandria, DC-VA-MD-WV" },
  "203": { code: "0047900", name: "Washington-Arlington-Alexandria, DC-VA-MD-WV" },
  "204": { code: "0047900", name: "Washington-Arlington-Alexandria, DC-VA-MD-WV" },
  "205": { code: "0047900", name: "Washington-Arlington-Alexandria, DC-VA-MD-WV" },

  // ── Maryland ──
  "206": { code: "0047900", name: "Washington-Arlington-Alexandria, DC-VA-MD-WV" },
  "207": { code: "0047900", name: "Washington-Arlington-Alexandria, DC-VA-MD-WV" },
  "208": { code: "0047900", name: "Washington-Arlington-Alexandria, DC-VA-MD-WV" },
  "209": { code: "0047900", name: "Washington-Arlington-Alexandria, DC-VA-MD-WV" },
  "210": { code: "0012580", name: "Baltimore-Columbia-Towson, MD" },
  "211": { code: "0012580", name: "Baltimore-Columbia-Towson, MD" },
  "212": { code: "0012580", name: "Baltimore-Columbia-Towson, MD" },
  "214": { code: "0012580", name: "Baltimore-Columbia-Towson, MD" },
  "215": { code: "0012580", name: "Baltimore-Columbia-Towson, MD" },
  "216": { code: "0012580", name: "Baltimore-Columbia-Towson, MD" },
  "217": { code: "0012580", name: "Baltimore-Columbia-Towson, MD" },
  "218": { code: "0012580", name: "Baltimore-Columbia-Towson, MD" },
  "219": { code: "0012580", name: "Baltimore-Columbia-Towson, MD" },

  // ── Virginia ──
  "220": { code: "0047900", name: "Washington-Arlington-Alexandria, DC-VA-MD-WV" },
  "221": { code: "0047900", name: "Washington-Arlington-Alexandria, DC-VA-MD-WV" },
  "222": { code: "0047900", name: "Washington-Arlington-Alexandria, DC-VA-MD-WV" },
  "223": { code: "0047900", name: "Washington-Arlington-Alexandria, DC-VA-MD-WV" },
  "226": { code: "0047900", name: "Washington-Arlington-Alexandria, DC-VA-MD-WV" },
  "230": { code: "0040060", name: "Richmond, VA" },
  "231": { code: "0040060", name: "Richmond, VA" },
  "232": { code: "0040060", name: "Richmond, VA" },
  "233": { code: "0047260", name: "Virginia Beach-Norfolk-Newport News, VA-NC" },
  "234": { code: "0047260", name: "Virginia Beach-Norfolk-Newport News, VA-NC" },
  "235": { code: "0047260", name: "Virginia Beach-Norfolk-Newport News, VA-NC" },
  "236": { code: "0047260", name: "Virginia Beach-Norfolk-Newport News, VA-NC" },
  "237": { code: "0047260", name: "Virginia Beach-Norfolk-Newport News, VA-NC" },
  "240": { code: "0040220", name: "Roanoke, VA" },
  "241": { code: "0040220", name: "Roanoke, VA" },
  "244": { code: "0031340", name: "Lynchburg, VA" },
  "245": { code: "0031340", name: "Lynchburg, VA" },

  // ── West Virginia ──
  "250": { code: "0016580", name: "Charleston, WV" },
  "251": { code: "0016580", name: "Charleston, WV" },
  "252": { code: "0016580", name: "Charleston, WV" },
  "253": { code: "0016580", name: "Charleston, WV" },
  "260": { code: "0026580", name: "Huntington-Ashland, WV-KY-OH" },
  "261": { code: "0026580", name: "Huntington-Ashland, WV-KY-OH" },

  // ── North Carolina ──
  "270": { code: "0024660", name: "Greensboro-High Point, NC" },
  "271": { code: "0024660", name: "Greensboro-High Point, NC" },
  "272": { code: "0024660", name: "Greensboro-High Point, NC" },
  "273": { code: "0024660", name: "Greensboro-High Point, NC" },
  "274": { code: "0024660", name: "Greensboro-High Point, NC" },
  "275": { code: "0039580", name: "Raleigh-Cary, NC" },
  "276": { code: "0039580", name: "Raleigh-Cary, NC" },
  "277": { code: "0039580", name: "Raleigh-Cary, NC" },
  "278": { code: "0022180", name: "Fayetteville, NC" },
  "280": { code: "0016740", name: "Charlotte-Concord-Gastonia, NC-SC" },
  "281": { code: "0016740", name: "Charlotte-Concord-Gastonia, NC-SC" },
  "282": { code: "0016740", name: "Charlotte-Concord-Gastonia, NC-SC" },
  "283": { code: "0022180", name: "Fayetteville, NC" },
  "284": { code: "0048900", name: "Wilmington, NC" },
  "287": { code: "0011700", name: "Asheville, NC" },
  "288": { code: "0011700", name: "Asheville, NC" },

  // ── South Carolina ──
  "290": { code: "0017900", name: "Columbia, SC" },
  "291": { code: "0017900", name: "Columbia, SC" },
  "292": { code: "0017900", name: "Columbia, SC" },
  "293": { code: "0024860", name: "Greenville-Anderson, SC" },
  "294": { code: "0016700", name: "Charleston-North Charleston, SC" },
  "295": { code: "0024860", name: "Greenville-Anderson, SC" },
  "296": { code: "0024860", name: "Greenville-Anderson, SC" },
  "297": { code: "0016740", name: "Charlotte-Concord-Gastonia, NC-SC" },
  "298": { code: "0034820", name: "Myrtle Beach-Conway-North Myrtle Beach, SC-NC" },
  "299": { code: "0034820", name: "Myrtle Beach-Conway-North Myrtle Beach, SC-NC" },

  // ── Georgia ──
  "300": { code: "0012060", name: "Atlanta-Sandy Springs-Alpharetta, GA" },
  "301": { code: "0012060", name: "Atlanta-Sandy Springs-Alpharetta, GA" },
  "302": { code: "0012060", name: "Atlanta-Sandy Springs-Alpharetta, GA" },
  "303": { code: "0012060", name: "Atlanta-Sandy Springs-Alpharetta, GA" },
  "304": { code: "0012060", name: "Atlanta-Sandy Springs-Alpharetta, GA" },
  "305": { code: "0012060", name: "Atlanta-Sandy Springs-Alpharetta, GA" },
  "306": { code: "0012060", name: "Atlanta-Sandy Springs-Alpharetta, GA" },
  "308": { code: "0012260", name: "Augusta-Richmond County, GA-SC" },
  "309": { code: "0012260", name: "Augusta-Richmond County, GA-SC" },
  "310": { code: "0031420", name: "Macon-Bibb County, GA" },
  "311": { code: "0012060", name: "Atlanta-Sandy Springs-Alpharetta, GA" },
  "312": { code: "0031420", name: "Macon-Bibb County, GA" },
  "314": { code: "0042340", name: "Savannah, GA" },

  // ── Florida ──
  "320": { code: "0027260", name: "Jacksonville, FL" },
  "321": { code: "0019660", name: "Deltona-Daytona Beach-Ormond Beach, FL" },
  "322": { code: "0027260", name: "Jacksonville, FL" },
  "323": { code: "0045220", name: "Tallahassee, FL" },
  "324": { code: "0037460", name: "Panama City, FL" },
  "325": { code: "0037860", name: "Pensacola-Ferry Pass-Brent, FL" },
  "326": { code: "0023540", name: "Gainesville, FL" },
  "327": { code: "0036740", name: "Orlando-Kissimmee-Sanford, FL" },
  "328": { code: "0036740", name: "Orlando-Kissimmee-Sanford, FL" },
  "329": { code: "0037340", name: "Palm Bay-Melbourne-Titusville, FL" },
  "330": { code: "0033100", name: "Miami-Fort Lauderdale-Pompano Beach, FL" },
  "331": { code: "0033100", name: "Miami-Fort Lauderdale-Pompano Beach, FL" },
  "332": { code: "0033100", name: "Miami-Fort Lauderdale-Pompano Beach, FL" },
  "333": { code: "0033100", name: "Miami-Fort Lauderdale-Pompano Beach, FL" },
  "334": { code: "0048424", name: "West Palm Beach-Boca Raton, FL" },
  "335": { code: "0045300", name: "Tampa-St. Petersburg-Clearwater, FL" },
  "336": { code: "0045300", name: "Tampa-St. Petersburg-Clearwater, FL" },
  "337": { code: "0045300", name: "Tampa-St. Petersburg-Clearwater, FL" },
  "338": { code: "0029460", name: "Lakeland-Winter Haven, FL" },
  "339": { code: "0015980", name: "Cape Coral-Fort Myers, FL" },
  "340": { code: "0015980", name: "Cape Coral-Fort Myers, FL" },
  "341": { code: "0035840", name: "North Port-Sarasota-Bradenton, FL" },
  "342": { code: "0035840", name: "North Port-Sarasota-Bradenton, FL" },
  "344": { code: "0033100", name: "Miami-Fort Lauderdale-Pompano Beach, FL" },
  "346": { code: "0045300", name: "Tampa-St. Petersburg-Clearwater, FL" },
  "347": { code: "0036740", name: "Orlando-Kissimmee-Sanford, FL" },
  "349": { code: "0015980", name: "Cape Coral-Fort Myers, FL" },

  // ── Alabama ──
  "350": { code: "0013820", name: "Birmingham-Hoover, AL" },
  "351": { code: "0013820", name: "Birmingham-Hoover, AL" },
  "352": { code: "0013820", name: "Birmingham-Hoover, AL" },
  "354": { code: "0013820", name: "Birmingham-Hoover, AL" },
  "355": { code: "0013820", name: "Birmingham-Hoover, AL" },
  "356": { code: "0013820", name: "Birmingham-Hoover, AL" },
  "357": { code: "0026620", name: "Huntsville, AL" },
  "358": { code: "0026620", name: "Huntsville, AL" },
  "360": { code: "0033860", name: "Montgomery, AL" },
  "361": { code: "0033860", name: "Montgomery, AL" },
  "362": { code: "0013820", name: "Birmingham-Hoover, AL" },
  "363": { code: "0013820", name: "Birmingham-Hoover, AL" },
  "365": { code: "0033660", name: "Mobile, AL" },
  "366": { code: "0033660", name: "Mobile, AL" },

  // ── Tennessee ──
  "370": { code: "0034980", name: "Nashville-Davidson--Murfreesboro--Franklin, TN" },
  "371": { code: "0034980", name: "Nashville-Davidson--Murfreesboro--Franklin, TN" },
  "372": { code: "0034980", name: "Nashville-Davidson--Murfreesboro--Franklin, TN" },
  "373": { code: "0016860", name: "Chattanooga, TN-GA" },
  "374": { code: "0016860", name: "Chattanooga, TN-GA" },
  "376": { code: "0034980", name: "Nashville-Davidson--Murfreesboro--Franklin, TN" },
  "377": { code: "0028940", name: "Knoxville, TN" },
  "378": { code: "0028940", name: "Knoxville, TN" },
  "379": { code: "0028940", name: "Knoxville, TN" },
  "380": { code: "0032820", name: "Memphis, TN-MS-AR" },
  "381": { code: "0032820", name: "Memphis, TN-MS-AR" },
  "383": { code: "0034980", name: "Nashville-Davidson--Murfreesboro--Franklin, TN" },
  "384": { code: "0034980", name: "Nashville-Davidson--Murfreesboro--Franklin, TN" },
  "385": { code: "0034980", name: "Nashville-Davidson--Murfreesboro--Franklin, TN" },

  // ── Mississippi ──
  "386": { code: "0032820", name: "Memphis, TN-MS-AR" },
  "390": { code: "0027140", name: "Jackson, MS" },
  "391": { code: "0027140", name: "Jackson, MS" },
  "392": { code: "0027140", name: "Jackson, MS" },
  "394": { code: "0025060", name: "Gulfport-Biloxi, MS" },
  "395": { code: "0025060", name: "Gulfport-Biloxi, MS" },

  // ── Kentucky ──
  "400": { code: "0031140", name: "Louisville/Jefferson County, KY-IN" },
  "401": { code: "0031140", name: "Louisville/Jefferson County, KY-IN" },
  "402": { code: "0031140", name: "Louisville/Jefferson County, KY-IN" },
  "403": { code: "0030460", name: "Lexington-Fayette, KY" },
  "404": { code: "0030460", name: "Lexington-Fayette, KY" },
  "405": { code: "0030460", name: "Lexington-Fayette, KY" },
  "406": { code: "0030460", name: "Lexington-Fayette, KY" },

  // ── Ohio ──
  "430": { code: "0018140", name: "Columbus, OH" },
  "431": { code: "0018140", name: "Columbus, OH" },
  "432": { code: "0018140", name: "Columbus, OH" },
  "433": { code: "0018140", name: "Columbus, OH" },
  "434": { code: "0045780", name: "Toledo, OH" },
  "435": { code: "0045780", name: "Toledo, OH" },
  "436": { code: "0045780", name: "Toledo, OH" },
  "440": { code: "0017460", name: "Cleveland-Elyria, OH" },
  "441": { code: "0017460", name: "Cleveland-Elyria, OH" },
  "442": { code: "0010420", name: "Akron, OH" },
  "443": { code: "0017460", name: "Cleveland-Elyria, OH" },
  "444": { code: "0017460", name: "Cleveland-Elyria, OH" },
  "445": { code: "0049660", name: "Youngstown-Warren-Boardman, OH-PA" },
  "446": { code: "0015940", name: "Canton-Massillon, OH" },
  "447": { code: "0015940", name: "Canton-Massillon, OH" },
  "448": { code: "0010420", name: "Akron, OH" },
  "450": { code: "0017140", name: "Cincinnati, OH-KY-IN" },
  "451": { code: "0017140", name: "Cincinnati, OH-KY-IN" },
  "452": { code: "0017140", name: "Cincinnati, OH-KY-IN" },
  "453": { code: "0019380", name: "Dayton-Kettering, OH" },
  "454": { code: "0019380", name: "Dayton-Kettering, OH" },
  "455": { code: "0044220", name: "Springfield, OH" },
  "456": { code: "0019380", name: "Dayton-Kettering, OH" },
  "457": { code: "0018140", name: "Columbus, OH" },
  "458": { code: "0018140", name: "Columbus, OH" },

  // ── Indiana ──
  "460": { code: "0026900", name: "Indianapolis-Carmel-Anderson, IN" },
  "461": { code: "0026900", name: "Indianapolis-Carmel-Anderson, IN" },
  "462": { code: "0026900", name: "Indianapolis-Carmel-Anderson, IN" },
  "463": { code: "0026900", name: "Indianapolis-Carmel-Anderson, IN" },
  "464": { code: "0026900", name: "Indianapolis-Carmel-Anderson, IN" },
  "465": { code: "0026900", name: "Indianapolis-Carmel-Anderson, IN" },
  "466": { code: "0026900", name: "Indianapolis-Carmel-Anderson, IN" },
  "467": { code: "0023060", name: "Fort Wayne, IN" },
  "468": { code: "0023060", name: "Fort Wayne, IN" },
  "469": { code: "0023060", name: "Fort Wayne, IN" },
  "470": { code: "0017140", name: "Cincinnati, OH-KY-IN" },
  "472": { code: "0018140", name: "Columbus, OH" },
  "473": { code: "0031140", name: "Louisville/Jefferson County, KY-IN" },
  "474": { code: "0014020", name: "Bloomington, IN" },
  "476": { code: "0045460", name: "Terre Haute, IN" },
  "477": { code: "0021140", name: "Evansville, IN-KY" },
  "478": { code: "0045460", name: "Terre Haute, IN" },
  "479": { code: "0029200", name: "Lafayette-West Lafayette, IN" },

  // ── Michigan ──
  "480": { code: "0019820", name: "Detroit-Warren-Dearborn, MI" },
  "481": { code: "0019820", name: "Detroit-Warren-Dearborn, MI" },
  "482": { code: "0019820", name: "Detroit-Warren-Dearborn, MI" },
  "483": { code: "0019820", name: "Detroit-Warren-Dearborn, MI" },
  "484": { code: "0022420", name: "Flint, MI" },
  "485": { code: "0022420", name: "Flint, MI" },
  "486": { code: "0040980", name: "Saginaw, MI" },
  "487": { code: "0040980", name: "Saginaw, MI" },
  "488": { code: "0029620", name: "Lansing-East Lansing, MI" },
  "489": { code: "0029620", name: "Lansing-East Lansing, MI" },
  "490": { code: "0028020", name: "Kalamazoo-Portage, MI" },
  "491": { code: "0028020", name: "Kalamazoo-Portage, MI" },
  "493": { code: "0024340", name: "Grand Rapids-Kentwood, MI" },
  "494": { code: "0024340", name: "Grand Rapids-Kentwood, MI" },
  "495": { code: "0024340", name: "Grand Rapids-Kentwood, MI" },
  "496": { code: "0024340", name: "Grand Rapids-Kentwood, MI" },

  // ── Iowa ──
  "500": { code: "0019780", name: "Des Moines-West Des Moines, IA" },
  "501": { code: "0019780", name: "Des Moines-West Des Moines, IA" },
  "502": { code: "0019780", name: "Des Moines-West Des Moines, IA" },
  "503": { code: "0019780", name: "Des Moines-West Des Moines, IA" },
  "520": { code: "0019340", name: "Davenport-Moline-Rock Island, IA-IL" },
  "521": { code: "0019340", name: "Davenport-Moline-Rock Island, IA-IL" },
  "522": { code: "0016300", name: "Cedar Rapids, IA" },
  "524": { code: "0016300", name: "Cedar Rapids, IA" },

  // ── Wisconsin ──
  "530": { code: "0033340", name: "Milwaukee-Waukesha, WI" },
  "531": { code: "0033340", name: "Milwaukee-Waukesha, WI" },
  "532": { code: "0033340", name: "Milwaukee-Waukesha, WI" },
  "534": { code: "0039540", name: "Racine, WI" },
  "535": { code: "0031540", name: "Madison, WI" },
  "536": { code: "0031540", name: "Madison, WI" },
  "537": { code: "0031540", name: "Madison, WI" },
  "540": { code: "0011540", name: "Appleton, WI" },
  "541": { code: "0024580", name: "Green Bay, WI" },
  "543": { code: "0024580", name: "Green Bay, WI" },
  "544": { code: "0048140", name: "Wausau-Weston, WI" },

  // ── Minnesota ──
  "550": { code: "0033460", name: "Minneapolis-St. Paul-Bloomington, MN-WI" },
  "551": { code: "0033460", name: "Minneapolis-St. Paul-Bloomington, MN-WI" },
  "553": { code: "0033460", name: "Minneapolis-St. Paul-Bloomington, MN-WI" },
  "554": { code: "0033460", name: "Minneapolis-St. Paul-Bloomington, MN-WI" },
  "555": { code: "0033460", name: "Minneapolis-St. Paul-Bloomington, MN-WI" },
  "556": { code: "0020260", name: "Duluth, MN-WI" },
  "557": { code: "0020260", name: "Duluth, MN-WI" },
  "559": { code: "0040340", name: "Rochester, MN" },
  "560": { code: "0033460", name: "Minneapolis-St. Paul-Bloomington, MN-WI" },
  "561": { code: "0033460", name: "Minneapolis-St. Paul-Bloomington, MN-WI" },
  "562": { code: "0033460", name: "Minneapolis-St. Paul-Bloomington, MN-WI" },

  // ── North Dakota ──
  "580": { code: "0022020", name: "Fargo, ND-MN" },
  "581": { code: "0022020", name: "Fargo, ND-MN" },
  "585": { code: "0013900", name: "Bismarck, ND" },

  // ── Illinois ──
  "600": { code: "0016980", name: "Chicago-Naperville-Elgin, IL-IN-WI" },
  "601": { code: "0016980", name: "Chicago-Naperville-Elgin, IL-IN-WI" },
  "602": { code: "0016980", name: "Chicago-Naperville-Elgin, IL-IN-WI" },
  "603": { code: "0016980", name: "Chicago-Naperville-Elgin, IL-IN-WI" },
  "604": { code: "0016980", name: "Chicago-Naperville-Elgin, IL-IN-WI" },
  "605": { code: "0016980", name: "Chicago-Naperville-Elgin, IL-IN-WI" },
  "606": { code: "0016980", name: "Chicago-Naperville-Elgin, IL-IN-WI" },
  "607": { code: "0016980", name: "Chicago-Naperville-Elgin, IL-IN-WI" },
  "608": { code: "0016980", name: "Chicago-Naperville-Elgin, IL-IN-WI" },
  "609": { code: "0016980", name: "Chicago-Naperville-Elgin, IL-IN-WI" },
  "610": { code: "0040420", name: "Rockford, IL" },
  "611": { code: "0040420", name: "Rockford, IL" },
  "612": { code: "0019340", name: "Davenport-Moline-Rock Island, IA-IL" },
  "615": { code: "0037900", name: "Peoria, IL" },
  "616": { code: "0037900", name: "Peoria, IL" },
  "617": { code: "0014010", name: "Bloomington, IL" },
  "619": { code: "0044100", name: "Springfield, IL" },
  "620": { code: "0041180", name: "St. Louis, MO-IL" },
  "625": { code: "0016580", name: "Champaign-Urbana, IL" },
  "627": { code: "0044100", name: "Springfield, IL" },
  "628": { code: "0016020", name: "Carbondale-Marion, IL" },
  "629": { code: "0016020", name: "Carbondale-Marion, IL" },

  // ── Missouri ──
  "630": { code: "0041180", name: "St. Louis, MO-IL" },
  "631": { code: "0041180", name: "St. Louis, MO-IL" },
  "633": { code: "0041180", name: "St. Louis, MO-IL" },
  "634": { code: "0044100", name: "Springfield, MO" },
  "636": { code: "0041180", name: "St. Louis, MO-IL" },
  "637": { code: "0044180", name: "Springfield, MO" },
  "638": { code: "0044180", name: "Springfield, MO" },
  "640": { code: "0028140", name: "Kansas City, MO-KS" },
  "641": { code: "0028140", name: "Kansas City, MO-KS" },
  "644": { code: "0041180", name: "St. Louis, MO-IL" },
  "645": { code: "0028140", name: "Kansas City, MO-KS" },
  "646": { code: "0028140", name: "Kansas City, MO-KS" },
  "650": { code: "0017860", name: "Columbia, MO" },
  "651": { code: "0027620", name: "Jefferson City, MO" },
  "652": { code: "0017860", name: "Columbia, MO" },

  // ── Kansas ──
  "660": { code: "0028140", name: "Kansas City, MO-KS" },
  "661": { code: "0028140", name: "Kansas City, MO-KS" },
  "662": { code: "0028140", name: "Kansas City, MO-KS" },
  "664": { code: "0045820", name: "Topeka, KS" },
  "665": { code: "0045820", name: "Topeka, KS" },
  "666": { code: "0045820", name: "Topeka, KS" },
  "670": { code: "0048620", name: "Wichita, KS" },
  "671": { code: "0048620", name: "Wichita, KS" },
  "672": { code: "0048620", name: "Wichita, KS" },

  // ── Nebraska ──
  "680": { code: "0036540", name: "Omaha-Council Bluffs, NE-IA" },
  "681": { code: "0036540", name: "Omaha-Council Bluffs, NE-IA" },
  "683": { code: "0030700", name: "Lincoln, NE" },
  "684": { code: "0030700", name: "Lincoln, NE" },
  "685": { code: "0030700", name: "Lincoln, NE" },

  // ── Louisiana ──
  "700": { code: "0035380", name: "New Orleans-Metairie, LA" },
  "701": { code: "0035380", name: "New Orleans-Metairie, LA" },
  "703": { code: "0035380", name: "New Orleans-Metairie, LA" },
  "704": { code: "0035380", name: "New Orleans-Metairie, LA" },
  "707": { code: "0012940", name: "Baton Rouge, LA" },
  "708": { code: "0012940", name: "Baton Rouge, LA" },
  "710": { code: "0043340", name: "Shreveport-Bossier City, LA" },
  "711": { code: "0043340", name: "Shreveport-Bossier City, LA" },
  "712": { code: "0029180", name: "Lafayette, LA" },
  "713": { code: "0029180", name: "Lafayette, LA" },

  // ── Arkansas ──
  "720": { code: "0030780", name: "Little Rock-North Little Rock-Conway, AR" },
  "721": { code: "0030780", name: "Little Rock-North Little Rock-Conway, AR" },
  "722": { code: "0030780", name: "Little Rock-North Little Rock-Conway, AR" },
  "723": { code: "0032820", name: "Memphis, TN-MS-AR" },
  "724": { code: "0022900", name: "Fort Smith, AR-OK" },
  "725": { code: "0022900", name: "Fort Smith, AR-OK" },
  "727": { code: "0022220", name: "Fayetteville-Springdale-Rogers, AR" },
  "728": { code: "0022220", name: "Fayetteville-Springdale-Rogers, AR" },

  // ── Oklahoma ──
  "730": { code: "0036420", name: "Oklahoma City, OK" },
  "731": { code: "0036420", name: "Oklahoma City, OK" },
  "734": { code: "0036420", name: "Oklahoma City, OK" },
  "735": { code: "0036420", name: "Oklahoma City, OK" },
  "740": { code: "0046140", name: "Tulsa, OK" },
  "741": { code: "0046140", name: "Tulsa, OK" },
  "743": { code: "0046140", name: "Tulsa, OK" },
  "744": { code: "0046140", name: "Tulsa, OK" },
  "745": { code: "0036420", name: "Oklahoma City, OK" },

  // ── Texas ──
  "750": { code: "0019100", name: "Dallas-Fort Worth-Arlington, TX" },
  "751": { code: "0019100", name: "Dallas-Fort Worth-Arlington, TX" },
  "752": { code: "0019100", name: "Dallas-Fort Worth-Arlington, TX" },
  "753": { code: "0019100", name: "Dallas-Fort Worth-Arlington, TX" },
  "754": { code: "0019100", name: "Dallas-Fort Worth-Arlington, TX" },
  "755": { code: "0019100", name: "Dallas-Fort Worth-Arlington, TX" },
  "756": { code: "0019100", name: "Dallas-Fort Worth-Arlington, TX" },
  "760": { code: "0019100", name: "Dallas-Fort Worth-Arlington, TX" },
  "761": { code: "0019100", name: "Dallas-Fort Worth-Arlington, TX" },
  "762": { code: "0019100", name: "Dallas-Fort Worth-Arlington, TX" },
  "763": { code: "0048660", name: "Wichita Falls, TX" },
  "764": { code: "0019100", name: "Dallas-Fort Worth-Arlington, TX" },
  "765": { code: "0048660", name: "Wichita Falls, TX" },
  "766": { code: "0047380", name: "Waco, TX" },
  "767": { code: "0047380", name: "Waco, TX" },
  "768": { code: "0019100", name: "Dallas-Fort Worth-Arlington, TX" },
  "769": { code: "0041660", name: "San Angelo, TX" },
  "770": { code: "0026420", name: "Houston-The Woodlands-Sugar Land, TX" },
  "771": { code: "0026420", name: "Houston-The Woodlands-Sugar Land, TX" },
  "772": { code: "0026420", name: "Houston-The Woodlands-Sugar Land, TX" },
  "773": { code: "0026420", name: "Houston-The Woodlands-Sugar Land, TX" },
  "774": { code: "0026420", name: "Houston-The Woodlands-Sugar Land, TX" },
  "775": { code: "0026420", name: "Houston-The Woodlands-Sugar Land, TX" },
  "776": { code: "0013140", name: "Beaumont-Port Arthur, TX" },
  "777": { code: "0013140", name: "Beaumont-Port Arthur, TX" },
  "778": { code: "0026420", name: "Houston-The Woodlands-Sugar Land, TX" },
  "779": { code: "0047020", name: "Victoria, TX" },
  "780": { code: "0041700", name: "San Antonio-New Braunfels, TX" },
  "781": { code: "0041700", name: "San Antonio-New Braunfels, TX" },
  "782": { code: "0041700", name: "San Antonio-New Braunfels, TX" },
  "783": { code: "0018580", name: "Corpus Christi, TX" },
  "784": { code: "0018580", name: "Corpus Christi, TX" },
  "785": { code: "0032580", name: "McAllen-Edinburg-Mission, TX" },
  "786": { code: "0012420", name: "Austin-Round Rock-Georgetown, TX" },
  "787": { code: "0012420", name: "Austin-Round Rock-Georgetown, TX" },
  "788": { code: "0041700", name: "San Antonio-New Braunfels, TX" },
  "790": { code: "0031180", name: "Lubbock, TX" },
  "791": { code: "0031180", name: "Lubbock, TX" },
  "793": { code: "0031180", name: "Lubbock, TX" },
  "794": { code: "0010180", name: "Abilene, TX" },
  "795": { code: "0010180", name: "Abilene, TX" },
  "797": { code: "0033260", name: "Midland, TX" },
  "798": { code: "0021340", name: "El Paso, TX" },
  "799": { code: "0021340", name: "El Paso, TX" },

  // ── Colorado ──
  "800": { code: "0019740", name: "Denver-Aurora-Lakewood, CO" },
  "801": { code: "0019740", name: "Denver-Aurora-Lakewood, CO" },
  "802": { code: "0019740", name: "Denver-Aurora-Lakewood, CO" },
  "803": { code: "0019740", name: "Denver-Aurora-Lakewood, CO" },
  "804": { code: "0019740", name: "Denver-Aurora-Lakewood, CO" },
  "805": { code: "0019740", name: "Denver-Aurora-Lakewood, CO" },
  "806": { code: "0019740", name: "Denver-Aurora-Lakewood, CO" },
  "808": { code: "0017820", name: "Colorado Springs, CO" },
  "809": { code: "0017820", name: "Colorado Springs, CO" },
  "810": { code: "0017820", name: "Colorado Springs, CO" },
  "811": { code: "0019740", name: "Denver-Aurora-Lakewood, CO" },
  "812": { code: "0019740", name: "Denver-Aurora-Lakewood, CO" },
  "813": { code: "0019740", name: "Denver-Aurora-Lakewood, CO" },
  "814": { code: "0024300", name: "Grand Junction, CO" },
  "815": { code: "0022660", name: "Fort Collins, CO" },
  "816": { code: "0024540", name: "Greeley, CO" },

  // ── Idaho ──
  "832": { code: "0038340", name: "Pocatello, ID" },
  "833": { code: "0026820", name: "Idaho Falls, ID" },
  "836": { code: "0014260", name: "Boise City, ID" },
  "837": { code: "0014260", name: "Boise City, ID" },

  // ── Utah ──
  "840": { code: "0041620", name: "Salt Lake City, UT" },
  "841": { code: "0041620", name: "Salt Lake City, UT" },
  "842": { code: "0041620", name: "Salt Lake City, UT" },
  "843": { code: "0036260", name: "Ogden-Clearfield, UT" },
  "844": { code: "0036260", name: "Ogden-Clearfield, UT" },
  "845": { code: "0041620", name: "Salt Lake City, UT" },
  "846": { code: "0039340", name: "Provo-Orem, UT" },
  "847": { code: "0039340", name: "Provo-Orem, UT" },

  // ── Arizona ──
  "850": { code: "0038060", name: "Phoenix-Mesa-Chandler, AZ" },
  "851": { code: "0038060", name: "Phoenix-Mesa-Chandler, AZ" },
  "852": { code: "0038060", name: "Phoenix-Mesa-Chandler, AZ" },
  "853": { code: "0038060", name: "Phoenix-Mesa-Chandler, AZ" },
  "855": { code: "0038060", name: "Phoenix-Mesa-Chandler, AZ" },
  "856": { code: "0046060", name: "Tucson, AZ" },
  "857": { code: "0046060", name: "Tucson, AZ" },
  "859": { code: "0038060", name: "Phoenix-Mesa-Chandler, AZ" },
  "860": { code: "0022380", name: "Flagstaff, AZ" },
  "863": { code: "0039140", name: "Prescott Valley-Prescott, AZ" },
  "864": { code: "0029420", name: "Lake Havasu City-Kingman, AZ" },
  "865": { code: "0046060", name: "Tucson, AZ" },

  // ── New Mexico ──
  "870": { code: "0010740", name: "Albuquerque, NM" },
  "871": { code: "0010740", name: "Albuquerque, NM" },
  "873": { code: "0010740", name: "Albuquerque, NM" },
  "874": { code: "0022140", name: "Farmington, NM" },
  "875": { code: "0010740", name: "Albuquerque, NM" },
  "877": { code: "0029740", name: "Las Cruces, NM" },
  "879": { code: "0029740", name: "Las Cruces, NM" },
  "880": { code: "0029740", name: "Las Cruces, NM" },
  "881": { code: "0010740", name: "Albuquerque, NM" },
  "883": { code: "0040740", name: "Santa Fe, NM" },

  // ── Texas (El Paso) ──
  "885": { code: "0021340", name: "El Paso, TX" },

  // ── Nevada ──
  "889": { code: "0029820", name: "Las Vegas-Henderson-Paradise, NV" },
  "890": { code: "0029820", name: "Las Vegas-Henderson-Paradise, NV" },
  "891": { code: "0029820", name: "Las Vegas-Henderson-Paradise, NV" },
  "893": { code: "0039900", name: "Reno, NV" },
  "894": { code: "0039900", name: "Reno, NV" },
  "895": { code: "0039900", name: "Reno, NV" },
  "897": { code: "0029820", name: "Las Vegas-Henderson-Paradise, NV" },
  "898": { code: "0021220", name: "Elko, NV" },

  // ── California ──
  "900": { code: "0031080", name: "Los Angeles-Long Beach-Anaheim, CA" },
  "901": { code: "0031080", name: "Los Angeles-Long Beach-Anaheim, CA" },
  "902": { code: "0031080", name: "Los Angeles-Long Beach-Anaheim, CA" },
  "903": { code: "0031080", name: "Los Angeles-Long Beach-Anaheim, CA" },
  "904": { code: "0031080", name: "Los Angeles-Long Beach-Anaheim, CA" },
  "905": { code: "0031080", name: "Los Angeles-Long Beach-Anaheim, CA" },
  "906": { code: "0031080", name: "Los Angeles-Long Beach-Anaheim, CA" },
  "907": { code: "0031080", name: "Los Angeles-Long Beach-Anaheim, CA" },
  "908": { code: "0031080", name: "Los Angeles-Long Beach-Anaheim, CA" },
  "910": { code: "0031080", name: "Los Angeles-Long Beach-Anaheim, CA" },
  "911": { code: "0031080", name: "Los Angeles-Long Beach-Anaheim, CA" },
  "912": { code: "0031080", name: "Los Angeles-Long Beach-Anaheim, CA" },
  "913": { code: "0031080", name: "Los Angeles-Long Beach-Anaheim, CA" },
  "914": { code: "0031080", name: "Los Angeles-Long Beach-Anaheim, CA" },
  "915": { code: "0031080", name: "Los Angeles-Long Beach-Anaheim, CA" },
  "916": { code: "0031080", name: "Los Angeles-Long Beach-Anaheim, CA" },
  "917": { code: "0031080", name: "Los Angeles-Long Beach-Anaheim, CA" },
  "918": { code: "0031080", name: "Los Angeles-Long Beach-Anaheim, CA" },
  "919": { code: "0041740", name: "San Diego-Chula Vista-Carlsbad, CA" },
  "920": { code: "0041740", name: "San Diego-Chula Vista-Carlsbad, CA" },
  "921": { code: "0041740", name: "San Diego-Chula Vista-Carlsbad, CA" },
  "922": { code: "0040140", name: "Riverside-San Bernardino-Ontario, CA" },
  "923": { code: "0040140", name: "Riverside-San Bernardino-Ontario, CA" },
  "924": { code: "0040140", name: "Riverside-San Bernardino-Ontario, CA" },
  "925": { code: "0040140", name: "Riverside-San Bernardino-Ontario, CA" },
  "926": { code: "0040140", name: "Riverside-San Bernardino-Ontario, CA" },
  "927": { code: "0040140", name: "Riverside-San Bernardino-Ontario, CA" },
  "928": { code: "0031080", name: "Los Angeles-Long Beach-Anaheim, CA" },
  "930": { code: "0037100", name: "Oxnard-Thousand Oaks-Ventura, CA" },
  "931": { code: "0042200", name: "Santa Maria-Santa Barbara, CA" },
  "932": { code: "0012540", name: "Bakersfield, CA" },
  "933": { code: "0012540", name: "Bakersfield, CA" },
  "934": { code: "0042020", name: "San Luis Obispo-Paso Robles, CA" },
  "935": { code: "0047300", name: "Visalia, CA" },
  "936": { code: "0023420", name: "Fresno, CA" },
  "937": { code: "0023420", name: "Fresno, CA" },
  "939": { code: "0041500", name: "Salinas, CA" },
  "940": { code: "0041860", name: "San Francisco-Oakland-Berkeley, CA" },
  "941": { code: "0041860", name: "San Francisco-Oakland-Berkeley, CA" },
  "943": { code: "0041940", name: "San Jose-Sunnyvale-Santa Clara, CA" },
  "944": { code: "0041860", name: "San Francisco-Oakland-Berkeley, CA" },
  "945": { code: "0041860", name: "San Francisco-Oakland-Berkeley, CA" },
  "946": { code: "0041860", name: "San Francisco-Oakland-Berkeley, CA" },
  "947": { code: "0041860", name: "San Francisco-Oakland-Berkeley, CA" },
  "948": { code: "0041860", name: "San Francisco-Oakland-Berkeley, CA" },
  "949": { code: "0041860", name: "San Francisco-Oakland-Berkeley, CA" },
  "950": { code: "0041940", name: "San Jose-Sunnyvale-Santa Clara, CA" },
  "951": { code: "0041940", name: "San Jose-Sunnyvale-Santa Clara, CA" },
  "952": { code: "0044700", name: "Stockton, CA" },
  "953": { code: "0044700", name: "Stockton, CA" },
  "954": { code: "0033700", name: "Modesto, CA" },
  "955": { code: "0033700", name: "Modesto, CA" },
  "956": { code: "0040900", name: "Sacramento-Roseville-Folsom, CA" },
  "957": { code: "0040900", name: "Sacramento-Roseville-Folsom, CA" },
  "958": { code: "0040900", name: "Sacramento-Roseville-Folsom, CA" },
  "959": { code: "0040900", name: "Sacramento-Roseville-Folsom, CA" },
  "960": { code: "0039820", name: "Redding, CA" },
  "961": { code: "0017020", name: "Chico, CA" },

  // ── Hawaii ──
  "967": { code: "0046520", name: "Urban Honolulu, HI" },
  "968": { code: "0046520", name: "Urban Honolulu, HI" },

  // ── Oregon ──
  "970": { code: "0038900", name: "Portland-Vancouver-Hillsboro, OR-WA" },
  "971": { code: "0038900", name: "Portland-Vancouver-Hillsboro, OR-WA" },
  "972": { code: "0038900", name: "Portland-Vancouver-Hillsboro, OR-WA" },
  "973": { code: "0041420", name: "Salem, OR" },
  "974": { code: "0021660", name: "Eugene-Springfield, OR" },
  "975": { code: "0032780", name: "Medford, OR" },
  "976": { code: "0013460", name: "Bend, OR" },
  "977": { code: "0021660", name: "Eugene-Springfield, OR" },
  "978": { code: "0038900", name: "Portland-Vancouver-Hillsboro, OR-WA" },
  "979": { code: "0038900", name: "Portland-Vancouver-Hillsboro, OR-WA" },

  // ── Washington ──
  "980": { code: "0042660", name: "Seattle-Tacoma-Bellevue, WA" },
  "981": { code: "0042660", name: "Seattle-Tacoma-Bellevue, WA" },
  "982": { code: "0042660", name: "Seattle-Tacoma-Bellevue, WA" },
  "983": { code: "0042660", name: "Seattle-Tacoma-Bellevue, WA" },
  "984": { code: "0042660", name: "Seattle-Tacoma-Bellevue, WA" },
  "985": { code: "0036500", name: "Olympia-Lacey-Tumwater, WA" },
  "986": { code: "0038900", name: "Portland-Vancouver-Hillsboro, OR-WA" },
  "988": { code: "0048300", name: "Wenatchee, WA" },
  "989": { code: "0049420", name: "Yakima, WA" },
  "990": { code: "0044060", name: "Spokane-Spokane Valley, WA" },
  "991": { code: "0044060", name: "Spokane-Spokane Valley, WA" },
  "992": { code: "0044060", name: "Spokane-Spokane Valley, WA" },
  "993": { code: "0028420", name: "Kennewick-Richland, WA" },
  "994": { code: "0044060", name: "Spokane-Spokane Valley, WA" },

  // ── Alaska ──
  "995": { code: "0011260", name: "Anchorage, AK" },
  "996": { code: "0011260", name: "Anchorage, AK" },
  "997": { code: "0021820", name: "Fairbanks, AK" },
  "998": { code: "0027100", name: "Juneau, AK" },
  "999": { code: "0011260", name: "Anchorage, AK" },
};
