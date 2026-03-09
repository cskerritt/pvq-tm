/**
 * Next.js instrumentation hook — runs once on server startup.
 * Triggers background data sync if data is stale or missing,
 * and schedules daily automatic sync at 5:00 AM.
 */
export async function register() {
  // Only run on the server (not in edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Check on startup if data is stale and sync if needed
    await runAutoSync();

    // Schedule daily sync at 5:00 AM
    try {
      const cron = await import("node-cron");
      cron.schedule("0 5 * * *", () => {
        console.log("[AutoSync] Daily scheduled sync triggered.");
        runAutoSync().catch((e) => {
          console.error("[AutoSync] Scheduled sync failed:", e);
        });
      });
      console.log("[AutoSync] Daily sync scheduled for 5:00 AM.");
    } catch (e) {
      console.error("[AutoSync] Failed to set up cron schedule:", e);
    }
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

    // Check if last sync was more than 23 hours ago
    const lastSync = await prisma.dataSyncLog.findFirst({
      where: { status: "completed" },
      orderBy: { completedAt: "desc" },
    });

    const staleThreshold = 23 * 60 * 60 * 1000; // 23 hours
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
    const { syncAll, getSyncLock } = await import("@/lib/api/sync");

    // Check if another sync is already running
    if (getSyncLock()) {
      console.log("[AutoSync] Another sync is already in progress, skipping.");
      return;
    }

    // Run sync in background (don't block server startup)
    syncAll().catch((e) => {
      console.error("[AutoSync] Background sync failed:", e);
    });

    console.log("[AutoSync] Background sync started.");
  } catch (e) {
    console.error("[AutoSync] Failed to check sync status:", e);
  }
}
