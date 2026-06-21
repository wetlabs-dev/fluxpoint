import { UserCircle2 } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { changePassword, logout, updateProfile } from "@/domains/auth/actions";
import { sendCollectionInvitation } from "@/domains/management/actions";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { canManageCollection } from "@/domains/auth/permissions";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const managesCollection = await canManageCollection(user.id, collection.id);
  const invitations = managesCollection ? await prisma.collectionInvitation.findMany({ where: { collectionId: collection.id }, orderBy: { createdAt: "desc" }, take: 5 }) : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Account Settings" eyebrow="Keeper profile" />
      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserCircle2 className="h-5 w-5 text-water" /> Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <Info label="User" value={user.name} />
            <Info label="Email" value={user.email} />
            <form action={updateProfile} className="grid gap-3 rounded-md bg-muted/45 p-3">
              <label className="grid gap-1 text-sm font-medium">
                <span>Display name</span>
                <Input name="name" defaultValue={user.name} required />
              </label>
              <Button type="submit" variant="secondary">Save profile</Button>
            </form>
            <form action={changePassword} className="grid gap-3 rounded-md bg-muted/45 p-3">
              <label className="grid gap-1 text-sm font-medium">
                <span>Current password</span>
                <Input name="currentPassword" type="password" required />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                <span>New password</span>
                <Input name="newPassword" type="password" minLength={12} required />
              </label>
              <Button type="submit" variant="secondary">Change password</Button>
              <p className="text-xs text-muted-foreground">Changing password signs out active sessions. 2FA is not wired yet.</p>
            </form>
            <form action={logout}>
              <Button type="submit" variant="secondary" className="w-full">Log out</Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-5">
          {managesCollection && <Card>
            <CardHeader><CardTitle>Invitations</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <form action={sendCollectionInvitation} className="grid gap-3 rounded-md bg-muted/45 p-3 md:grid-cols-[1fr_180px_auto]">
                <Input name="email" type="email" placeholder="keeper@example.com" required />
                <Select name="role" defaultValue="VIEWER">
                  <option value="VIEWER">Viewer</option>
                  <option value="FISHKEEPER">Fishkeeper</option>
                  <option value="AQUARIST">Aquarist</option>
                </Select>
                <Button type="submit" variant="secondary">Send invitation</Button>
              </form>
              <div className="grid gap-2">
                {invitations.length ? invitations.map((invitation) => (
                  <div key={invitation.id} className="rounded-md border border-border bg-background/55 p-3">
                    <div className="font-semibold text-primary">{invitation.email}</div>
                    <div className="font-mono text-xs text-muted-foreground">{invitation.role} · {invitation.status}</div>
                  </div>
                )) : <EmptyLine text="No invitations have been sent yet." />}
              </div>
            </CardContent>
          </Card>}
          <Card>
            <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Choose a color mode for the authenticated app. System follows your device preference.</p>
              <ThemeToggle />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-md bg-muted/55 p-3">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-mono font-semibold text-primary">{value ?? "Not set"}</div>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">{text}</div>;
}
