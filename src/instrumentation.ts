/**
 * Next.js instrumentation hook — runs once on server startup.
 * Triggers background data sync if data is stale or missing.
 */
export async function register() {
  // Only run on the server (not in edge runtime)
  // In production, skip auto-sync on startup to avoid hammering external APIs on deploy.
  // Data sync should be triggered manually via the admin UI.
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV !== "production") {
    await runAutoSync();
  }
}

async function runAutoSync() {
  // Dynamically import to avoid bundling issues
  const { prisma } = await import("@/lib/db");

  try {
    // Check if we have any O*NET data cached
    const onetCount = await prisma.occupationONET.count();
    const oewsCount = await prisma.occupationWages.count();
    const orsCount = await prisma.occupationORS.count();
    const projCount = await prisma.occupationProjections.count();

    // Check if last sync was more than 24 hours ago
    const lastSync = await prisma.dataSyncLog.findFirst({
      where: { status: "completed" },
      orderBy: { completedAt: "desc" },
    });

    const staleThreshold = 24 * 60 * 60 * 1000; // 24 hours
    const isStale = !lastSync?.completedAt ||
      (Date.now() - lastSync.completedAt.getTime()) > staleThreshold;

    const needsSync = onetCount === 0 || isStale;

    if (!needsSync) {
      console.log(
        `[AutoSync] Data is fresh (last sync: ${lastSync?.completedAt?.toISOString()}). ` +
        `ONET: ${onetCount}, OEWS: ${oewsCount}, ORS: ${orsCount}, Projections: ${projCount}`
      );
      return;
    }

    console.log(
      `[AutoSync] Data needs sync. ONET: ${onetCount}, OEWS: ${oewsCount}, ORS: ${orsCount}, Projections: ${projCount}`
    );

    // Import sync functions dynamically
    const { syncAll } = await import("@/lib/api/sync");

    // Run sync in background (don't block server startup)
    syncAll().catch((e) => {
      console.error("[AutoSync] Background sync failed:", e);
    });

    console.log("[AutoSync] Background sync started.");
  } catch (e) {
    console.error("[AutoSync] Failed to check sync status:", e);
  }
}
