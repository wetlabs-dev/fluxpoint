import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function QrAccessDeniedPage() {
  return <main className="grid min-h-screen place-items-center p-4"><Card className="w-full max-w-lg"><CardHeader><ShieldX className="mb-2 h-8 w-8 text-rose-500" /><CardTitle>QR record unavailable</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground"><p>This code is invalid, private, or not published for public viewing. Log in with an authorized Fluxpoint account to view private records.</p><Link className="font-semibold text-primary underline" href="/login">Log in to Fluxpoint</Link></CardContent></Card></main>;
}
