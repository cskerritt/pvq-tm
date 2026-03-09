import { NextRequest, NextResponse } from "next/server";
import { syncONET, syncOEWS, syncORS, syncProjections, syncDOT, syncCrosswalk, syncAll } from "@/lib/api/sync";

export async function POST(req: NextRequest, { params }: { params: Promise<{ source: string }> }) {
  try {
  const { source } = await params;

  switch (source.toUpperCase()) {
    case "ONET": {
      const result = await syncONET();
      return NextResponse.json(result);
    }
    case "OEWS": {
      const result = await syncOEWS();
      return NextResponse.json(result);
    }
    case "ORS": {
      const result = await syncORS();
      return NextResponse.json(result);
    }
    case "PROJECTIONS": {
      const result = await syncProjections();
      return NextResponse.json(result);
    }
    case "DOT": {
      const result = await syncDOT();
      return NextResponse.json(result);
    }
    case "CROSSWALK": {
      const result = await syncCrosswalk();
      return NextResponse.json(result);
    }
    case "ALL": {
      const result = await syncAll();
      return NextResponse.json(result);
    }
    default:
      return NextResponse.json(
        { error: `Unknown sync source: ${source}` },
        { status: 400 }
      );
  }
  } catch (error) {
    console.error("[POST /api/admin/sync/[source]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
