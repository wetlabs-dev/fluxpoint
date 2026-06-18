import { createHash } from "crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await prisma.collectionInvitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { collection: true, inviter: true }
  });

  if (!invitation) notFound();
  const expired = invitation.expiresAt < new Date();

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">≈</div>
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
          {expired ? (
            <div className="rounded-md border border-destructive/35 bg-destructive/10 p-3 text-destructive">
              This invitation has expired.
            </div>
          ) : (
            <div className="rounded-md border border-border bg-background/55 p-3 text-muted-foreground">
              Invitation acceptance is ready for the email flow. Full collection role enforcement will land with the multi-user sharing pass.
            </div>
          )}
          <Link className="inline-flex min-h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft transition hover:bg-primary/90" href="/login">
            Open Fluxpoint
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
