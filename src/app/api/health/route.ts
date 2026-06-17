import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import packageJson from "../../../../package.json";

export const dynamic = "force-dynamic";

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      service: "fluxpoint",
      timestamp,
      version: packageJson.version,
      database: "ok"
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        service: "fluxpoint",
        timestamp,
        version: packageJson.version,
        database: "error"
      },
      { status: 503 }
    );
  }
}
