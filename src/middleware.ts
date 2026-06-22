import { NextResponse } from "next/server";

export function middleware() {
  return new NextResponse("Not found", { status: 404 });
}

export const config = { matcher: ["/labels/:path*"] };
