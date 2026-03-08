import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
    });
  } catch (error) {
    console.error("[GET /api/health]", error);
    return NextResponse.json(
      { status: "error", db: "disconnected", timestamp: new Date().toISOString() },
      { status: 503 }
    );
  }
}
