import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/geo/zip-to-metro?zip=XXXXX
 *
 * Converts a US zip code to the corresponding BLS metropolitan area code.
 * Uses the Census Bureau CBSA crosswalk data (embedded for common metros).
 * Returns areaCode + areaName for use in OEWS wage lookups.
 */
export async function GET(req: NextRequest) {
  const zip = req.nextUrl.searchParams.get("zip");
  if (!zip || zip.length !== 5) {
    return NextResponse.json({ error: "Valid 5-digit zip code required" }, { status: 400 });
  }

  // First 3 digits of zip (ZIP3) → approximate metro area
  const zip3 = zip.substring(0, 3);

  const metro = ZIP3_TO_METRO[zip3];
  if (metro) {
    return NextResponse.json({
      zipCode: zip,
      areaCode: metro.code,
      areaName: metro.name,
      areaType: "metro",
    });
  }

  // No metro match → use national
  return NextResponse.json({
    zipCode: zip,
    areaCode: "0000000",
    areaName: "National",
    areaType: "national",
    note: "No metro area match found for this zip code. Using national-level data.",
  });
}

/**
 * ZIP3 prefix to BLS Metropolitan Statistical Area (MSA) mapping.
 * BLS uses 7-digit codes: C + FIPS CBSA code (padded).
 * This maps the first 3 digits of US zip codes to their most likely metro area.
 */
const ZIP3_TO_METRO: Record<string, { code: string; name: string }> = {
  // New York Metro
  "100": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "101": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "102": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "103": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "104": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "110": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "111": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "112": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "113": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "070": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "071": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "072": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "073": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  "074": { code: "0035620", name: "New York-Newark-Jersey City, NY-NJ-PA" },
  // Los Angeles
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
  "917": { code: "0031080", name: "Los Angeles-Long Beach-Anaheim, CA" },
  "918": { code: "0031080", name: "Los Angeles-Long Beach-Anaheim, CA" },
  // Chicago
  "606": { code: "0016980", name: "Chicago-Naperville-Elgin, IL-IN-WI" },
  "600": { code: "0016980", name: "Chicago-Naperville-Elgin, IL-IN-WI" },
  "601": { code: "0016980", name: "Chicago-Naperville-Elgin, IL-IN-WI" },
  "602": { code: "0016980", name: "Chicago-Naperville-Elgin, IL-IN-WI" },
  "603": { code: "0016980", name: "Chicago-Naperville-Elgin, IL-IN-WI" },
  "604": { code: "0016980", name: "Chicago-Naperville-Elgin, IL-IN-WI" },
  "605": { code: "0016980", name: "Chicago-Naperville-Elgin, IL-IN-WI" },
  // Houston
  "770": { code: "0026420", name: "Houston-The Woodlands-Sugar Land, TX" },
  "773": { code: "0026420", name: "Houston-The Woodlands-Sugar Land, TX" },
  "774": { code: "0026420", name: "Houston-The Woodlands-Sugar Land, TX" },
  "775": { code: "0026420", name: "Houston-The Woodlands-Sugar Land, TX" },
  // Dallas
  "750": { code: "0019100", name: "Dallas-Fort Worth-Arlington, TX" },
  "751": { code: "0019100", name: "Dallas-Fort Worth-Arlington, TX" },
  "752": { code: "0019100", name: "Dallas-Fort Worth-Arlington, TX" },
  "760": { code: "0019100", name: "Dallas-Fort Worth-Arlington, TX" },
  "761": { code: "0019100", name: "Dallas-Fort Worth-Arlington, TX" },
  // Philadelphia
  "190": { code: "0037980", name: "Philadelphia-Camden-Wilmington, PA-NJ-DE-MD" },
  "191": { code: "0037980", name: "Philadelphia-Camden-Wilmington, PA-NJ-DE-MD" },
  // Washington DC
  "200": { code: "0047900", name: "Washington-Arlington-Alexandria, DC-VA-MD-WV" },
  "201": { code: "0047900", name: "Washington-Arlington-Alexandria, DC-VA-MD-WV" },
  "202": { code: "0047900", name: "Washington-Arlington-Alexandria, DC-VA-MD-WV" },
  "220": { code: "0047900", name: "Washington-Arlington-Alexandria, DC-VA-MD-WV" },
  "221": { code: "0047900", name: "Washington-Arlington-Alexandria, DC-VA-MD-WV" },
  // Miami
  "331": { code: "0033100", name: "Miami-Fort Lauderdale-Pompano Beach, FL" },
  "330": { code: "0033100", name: "Miami-Fort Lauderdale-Pompano Beach, FL" },
  "332": { code: "0033100", name: "Miami-Fort Lauderdale-Pompano Beach, FL" },
  "333": { code: "0033100", name: "Miami-Fort Lauderdale-Pompano Beach, FL" },
  // Atlanta
  "303": { code: "0012060", name: "Atlanta-Sandy Springs-Alpharetta, GA" },
  "300": { code: "0012060", name: "Atlanta-Sandy Springs-Alpharetta, GA" },
  "301": { code: "0012060", name: "Atlanta-Sandy Springs-Alpharetta, GA" },
  // Boston
  "021": { code: "0014460", name: "Boston-Cambridge-Newton, MA-NH" },
  "020": { code: "0014460", name: "Boston-Cambridge-Newton, MA-NH" },
  "022": { code: "0014460", name: "Boston-Cambridge-Newton, MA-NH" },
  "023": { code: "0014460", name: "Boston-Cambridge-Newton, MA-NH" },
  "024": { code: "0014460", name: "Boston-Cambridge-Newton, MA-NH" },
  // San Francisco
  "941": { code: "0041860", name: "San Francisco-Oakland-Berkeley, CA" },
  "940": { code: "0041860", name: "San Francisco-Oakland-Berkeley, CA" },
  "944": { code: "0041860", name: "San Francisco-Oakland-Berkeley, CA" },
  "945": { code: "0041860", name: "San Francisco-Oakland-Berkeley, CA" },
  "946": { code: "0041860", name: "San Francisco-Oakland-Berkeley, CA" },
  "947": { code: "0041860", name: "San Francisco-Oakland-Berkeley, CA" },
  // Phoenix
  "850": { code: "0038060", name: "Phoenix-Mesa-Chandler, AZ" },
  "852": { code: "0038060", name: "Phoenix-Mesa-Chandler, AZ" },
  "853": { code: "0038060", name: "Phoenix-Mesa-Chandler, AZ" },
  // Seattle
  "980": { code: "0042660", name: "Seattle-Tacoma-Bellevue, WA" },
  "981": { code: "0042660", name: "Seattle-Tacoma-Bellevue, WA" },
  "982": { code: "0042660", name: "Seattle-Tacoma-Bellevue, WA" },
  "983": { code: "0042660", name: "Seattle-Tacoma-Bellevue, WA" },
  "984": { code: "0042660", name: "Seattle-Tacoma-Bellevue, WA" },
  // Minneapolis
  "553": { code: "0033460", name: "Minneapolis-St. Paul-Bloomington, MN-WI" },
  "554": { code: "0033460", name: "Minneapolis-St. Paul-Bloomington, MN-WI" },
  "550": { code: "0033460", name: "Minneapolis-St. Paul-Bloomington, MN-WI" },
  // Denver
  "802": { code: "0019740", name: "Denver-Aurora-Lakewood, CO" },
  "800": { code: "0019740", name: "Denver-Aurora-Lakewood, CO" },
  "801": { code: "0019740", name: "Denver-Aurora-Lakewood, CO" },
  "803": { code: "0019740", name: "Denver-Aurora-Lakewood, CO" },
  // Detroit
  "481": { code: "0019820", name: "Detroit-Warren-Dearborn, MI" },
  "482": { code: "0019820", name: "Detroit-Warren-Dearborn, MI" },
  "483": { code: "0019820", name: "Detroit-Warren-Dearborn, MI" },
  "480": { code: "0019820", name: "Detroit-Warren-Dearborn, MI" },
  // San Diego
  "919": { code: "0041740", name: "San Diego-Chula Vista-Carlsbad, CA" },
  "920": { code: "0041740", name: "San Diego-Chula Vista-Carlsbad, CA" },
  "921": { code: "0041740", name: "San Diego-Chula Vista-Carlsbad, CA" },
  // Tampa
  "336": { code: "0045300", name: "Tampa-St. Petersburg-Clearwater, FL" },
  "335": { code: "0045300", name: "Tampa-St. Petersburg-Clearwater, FL" },
  "337": { code: "0045300", name: "Tampa-St. Petersburg-Clearwater, FL" },
  // Orlando
  "328": { code: "0036740", name: "Orlando-Kissimmee-Sanford, FL" },
  "327": { code: "0036740", name: "Orlando-Kissimmee-Sanford, FL" },
  "347": { code: "0036740", name: "Orlando-Kissimmee-Sanford, FL" },
  // Portland, ME
  "040": { code: "0038860", name: "Portland-South Portland, ME" },
  "041": { code: "0038860", name: "Portland-South Portland, ME" },
  "042": { code: "0038860", name: "Portland-South Portland, ME" },
  // Portland, OR
  "970": { code: "0038900", name: "Portland-Vancouver-Hillsboro, OR-WA" },
  "971": { code: "0038900", name: "Portland-Vancouver-Hillsboro, OR-WA" },
  "972": { code: "0038900", name: "Portland-Vancouver-Hillsboro, OR-WA" },
  // St. Louis
  "631": { code: "0041180", name: "St. Louis, MO-IL" },
  "630": { code: "0041180", name: "St. Louis, MO-IL" },
  "620": { code: "0041180", name: "St. Louis, MO-IL" },
  // Las Vegas
  "891": { code: "0029820", name: "Las Vegas-Henderson-Paradise, NV" },
  "890": { code: "0029820", name: "Las Vegas-Henderson-Paradise, NV" },
  // Charlotte
  "282": { code: "0016740", name: "Charlotte-Concord-Gastonia, NC-SC" },
  "280": { code: "0016740", name: "Charlotte-Concord-Gastonia, NC-SC" },
  "281": { code: "0016740", name: "Charlotte-Concord-Gastonia, NC-SC" },
  // Nashville
  "372": { code: "0034980", name: "Nashville-Davidson--Murfreesboro--Franklin, TN" },
  "370": { code: "0034980", name: "Nashville-Davidson--Murfreesboro--Franklin, TN" },
  "371": { code: "0034980", name: "Nashville-Davidson--Murfreesboro--Franklin, TN" },
  // Austin
  "787": { code: "0012420", name: "Austin-Round Rock-Georgetown, TX" },
  "786": { code: "0012420", name: "Austin-Round Rock-Georgetown, TX" },
  // Pittsburgh
  "152": { code: "0038300", name: "Pittsburgh, PA" },
  "150": { code: "0038300", name: "Pittsburgh, PA" },
  "151": { code: "0038300", name: "Pittsburgh, PA" },
  // New Hampshire (Manchester-Nashua)
  "030": { code: "0031700", name: "Manchester-Nashua, NH" },
  "031": { code: "0031700", name: "Manchester-Nashua, NH" },
  "032": { code: "0031700", name: "Manchester-Nashua, NH" },
  "033": { code: "0014460", name: "Boston-Cambridge-Newton, MA-NH" },
  // Maine (Bangor)
  "044": { code: "0012620", name: "Bangor, ME" },
  "045": { code: "0038860", name: "Portland-South Portland, ME" },
  "046": { code: "0030340", name: "Lewiston-Auburn, ME" },
  "047": { code: "0038860", name: "Portland-South Portland, ME" },
  "048": { code: "0038860", name: "Portland-South Portland, ME" },
  "049": { code: "0012620", name: "Bangor, ME" },
};
