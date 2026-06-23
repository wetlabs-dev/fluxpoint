import { createHash } from "crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { acceptCollectionInvitation } from "@/domains/auth/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FluxpointLogoTile } from "@/components/brand/FluxpointLogo";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [invitation, user] = await Promise.all([prisma.collectionInvitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { collection: true, inviter: true }
  }), getCurrentUser()]);

  if (!invitation) notFound();
  const expired = invitation.expiresAt < new Date();

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <FluxpointLogoTile size={48} className="mb-3" />
          <CardTitle>Fluxpoint invitation</CardTitle>
          <p className="text-sm text-muted-foreground">
            {invitation.inviter?.name ?? "A Fluxpoint keeper"} invited {invitation.email} to {invitation.collection.name}.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="rounded-md bg-muted/55 p-3">
            <div className="text-muted-foreground">Role</div>
            <div className="font-mono font-semibold text-primary">{invitation.role}</div>
          </div>
          {expired || invitation.status !== "PENDING" ? (
            <div className="rounded-md border border-destructive/35 bg-destructive/10 p-3 text-destructive">
              {expired ? "This invitation has expired." : `This invitation is ${invitation.status.toLowerCase()}.`}
            </div>
          ) : user?.email.toLowerCase() === invitation.email.toLowerCase() ? (
            <form action={acceptCollectionInvitation} className="grid gap-3">
              <input type="hidden" name="token" value={token} />
              <Button type="submit">Accept invitation</Button>
            </form>
          ) : user ? (
            <div className="rounded-md border border-destructive/35 bg-destructive/10 p-3 text-destructive">Sign in as {invitation.email} to accept this invitation.</div>
          ) : (
            <div className="rounded-md border border-border bg-background/55 p-3 text-muted-foreground">
              Sign in as {invitation.email}, then reopen this invitation to accept it.
            </div>
          )}
          {!user && <Link className="inline-flex min-h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft transition hover:bg-primary/90" href="/login">Open Fluxpoint</Link>}
        </CardContent>
      </Card>
    </main>
  );
}
