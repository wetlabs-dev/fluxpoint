import { resolveQrScan } from "@/domains/qr/scan";
export async function GET(_request: Request, { params }: { params: Promise<{ publicCode: string }> }) { const { publicCode } = await params; return resolveQrScan("TANK", publicCode); }
