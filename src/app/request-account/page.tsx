import Link from "next/link";
import { submitAccountRequest } from "@/domains/account-requests/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { FluxpointLogoTile } from "@/components/brand/FluxpointLogo";

export const dynamic = "force-dynamic";

export default async function RequestAccountPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const params = await searchParams;
  const sent = params.sent === "1";

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <FluxpointLogoTile size={48} className="mb-3" />
          <CardTitle>Request Fluxpoint access</CardTitle>
          <p className="text-sm text-muted-foreground">Fluxpoint access is approved by the server administrator. This is not open public signup.</p>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4">
              <div className="rounded-md border border-water/30 bg-water/10 p-4 text-sm text-primary">
                Your request was sent. A server administrator will review it.
              </div>
              <Link className="inline-flex min-h-10 items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-primary hover:bg-muted" href="/login">
                Back to login
              </Link>
            </div>
          ) : (
            <form action={submitAccountRequest} className="grid gap-4">
              <label className="grid gap-1 text-sm font-medium">
                <span>Name</span>
                <Input name="name" autoComplete="name" required minLength={2} maxLength={160} />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                <span>Email</span>
                <Input name="email" type="email" autoComplete="email" required maxLength={320} />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                <span>Requested collection <span className="text-muted-foreground">(optional)</span></span>
                <Input name="requestedCollectionName" placeholder="Which aquarium collection are you requesting access to?" maxLength={180} />
                <span className="text-xs text-muted-foreground">Private collection names are not listed publicly.</span>
              </label>
              <label className="grid gap-1 text-sm font-medium">
                <span>Short message / reason for access</span>
                <Textarea name="message" rows={5} maxLength={1200} placeholder="A brief note helps the server administrator recognize your request." />
              </label>
              <Button type="submit" className="w-full">Request account</Button>
              <Link className="text-center text-sm font-semibold text-primary hover:underline" href="/login">
                Back to login
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
