import { NextResponse } from "next/server";
import { getSyncStatus } from "@/lib/api/sync";

export async function GET() {
  try {
    const status = await getSyncStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error("[GET /api/admin/sync/status]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
