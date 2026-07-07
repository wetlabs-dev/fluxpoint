import Link from "next/link";
import { ShieldCheck, UserCircle2 } from "lucide-react";
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
import { NotificationPreferencesForm } from "@/components/notifications/NotificationPreferencesForm";
import { PushNotificationSettings } from "@/components/notifications/PushNotificationSettings";
import { commonTimeZones, userTimeZone } from "@/lib/dates/user-timezone";
import { Badge } from "@/components/ui/badge";
import { keepAquariumPhotoFromReview, removePhotoFromReview } from "@/domains/media/moderation-actions";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const timezone = userTimeZone(user);
  const managesCollection = await canManageCollection(user.id, collection.id);
  const [invitations, notificationPreference, pushSubscriptions, twoFactor, pendingImageReviews] = await Promise.all([
    managesCollection ? prisma.collectionInvitation.findMany({ where: { collectionId: collection.id }, orderBy: { createdAt: "desc" }, take: 5 }) : [],
    prisma.notificationPreference.findUnique({ where: { userId: user.id } }),
    prisma.pushSubscription.findMany({ where: { userId: user.id, revokedAt: null }, orderBy: { updatedAt: "desc" } }),
    prisma.userTwoFactor.findUnique({ where: { userId: user.id }, include: { recoveryCodes: { where: { usedAt: null }, select: { id: true } } } }),
    prisma.imageModerationReview.findMany({
      where: { uploaderUserId: user.id, status: "PENDING", reviewType: { in: ["NO_AQUARIUM_CONTENT", "UNCERTAIN_AQUARIUM_CONTENT"] } },
      include: { photo: { select: { id: true, originalFilename: true, caption: true, moderationStatus: true, createdAt: true } } },
      orderBy: { createdAt: "desc" },
      take: 10
    })
  ]);

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
            <Info label="Timezone" value={timezone} />
            <form action={updateProfile} className="grid gap-3 rounded-md bg-muted/45 p-3">
              <label className="grid gap-1 text-sm font-medium">
                <span>Display name</span>
                <Input name="name" defaultValue={user.name} required />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                <span>Timezone</span>
                <Select name="timezone" defaultValue={timezone}>
                  {commonTimeZones.map((value) => <option key={value} value={value}>{value.replace("_", " ")}</option>)}
                </Select>
              </label>
              <p className="text-xs text-muted-foreground">Fluxpoint stores timestamps in UTC and displays/logs local wall time using this account timezone.</p>
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
              <p className="text-xs text-muted-foreground">Changing password signs out active sessions.</p>
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
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-water" /> Account security</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Two-factor authentication is {twoFactor?.enabledAt ? "enabled" : "not enabled"}{user.serverRole === "SERVER_ADMIN" ? " and required for Server Admin tools" : ""}.</p>
              {twoFactor?.enabledAt ? <p>{twoFactor.recoveryCodes.length} unused recovery code{twoFactor.recoveryCodes.length === 1 ? "" : "s"} remaining.</p> : null}
              <Link className="inline-flex min-h-10 items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-primary hover:bg-muted/70" href="/account/security">
                Manage two-factor authentication
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Choose a color mode for the authenticated app. System follows your device preference.</p>
              <ThemeToggle />
            </CardContent>
          </Card>
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>Notification preferences</CardTitle><p className="text-sm text-muted-foreground">Choose email and push independently for each Fluxpoint alert.</p></CardHeader><CardContent><NotificationPreferencesForm preference={notificationPreference} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Web Push devices</CardTitle><p className="text-sm text-muted-foreground">Push is optional and can be enabled separately on each supported browser or installed PWA.</p></CardHeader><CardContent><PushNotificationSettings enabled={process.env.NEXT_PUBLIC_ENABLE_WEB_PUSH === "true"} publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""} devices={pushSubscriptions.map((subscription) => ({ id: subscription.id, endpoint: subscription.endpoint, deviceLabel: subscription.deviceLabel, userAgent: subscription.userAgent, enabled: subscription.enabled, createdAt: subscription.createdAt.toISOString(), lastSeenAt: subscription.lastSeenAt?.toISOString() || null }))} /></CardContent></Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Photo moderation reviews</CardTitle>
          <p className="text-sm text-muted-foreground">Fluxpoint may ask you to confirm uploads when Eddy cannot clearly see aquarium-related content.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendingImageReviews.length ? pendingImageReviews.map((review) => (
            <div key={review.id} className="grid gap-3 rounded-md border border-border bg-background/55 p-3 text-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-primary">{review.photo.caption || review.photo.originalFilename}</span>
                  <Badge>{review.reviewType === "NO_AQUARIUM_CONTENT" ? "not aquarium" : "uncertain"}</Badge>
                  <Badge>{review.photo.moderationStatus.toLowerCase().replaceAll("_", " ")}</Badge>
                </div>
                <p className="text-muted-foreground">{review.reason || "Fluxpoint could not confidently classify this upload as aquarium-related."}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <form action={keepAquariumPhotoFromReview}>
                  <input type="hidden" name="reviewId" value={review.id} />
                  <Button type="submit" variant="secondary">Keep photo</Button>
                </form>
                <form action={removePhotoFromReview}>
                  <input type="hidden" name="reviewId" value={review.id} />
                  <Button type="submit" variant="secondary">Remove photo</Button>
                </form>
              </div>
            </div>
          )) : <EmptyLine text="No photo reviews need your attention." />}
        </CardContent>
      </Card>
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
