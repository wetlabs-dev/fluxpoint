import { NextResponse } from "next/server";
import packageJson from "../../../../package.json";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "fluxpoint",
    timestamp: new Date().toISOString(),
    version: packageJson.version
  });
}
