import { NextResponse } from "next/server";
import { getSyncStatus, getSyncLock } from "@/lib/api/sync";

export async function GET() {
  try {
    const statuses = await getSyncStatus();
    const isSyncing = getSyncLock();

    return NextResponse.json({
      sources: statuses,
      autoSync: {
        enabled: true,
        schedule: "Daily at 5:00 AM",
        isSyncing,
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/sync/status]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
