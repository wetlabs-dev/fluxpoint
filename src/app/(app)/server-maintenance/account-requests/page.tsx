import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { isServerAdmin } from "@/domains/server/server-admin";
import { collectionRoleLabels } from "@/domains/auth/permissions";
import { approveAccountRequest, rejectAccountRequest } from "@/domains/account-requests/actions";
import { emailProviderStatus } from "@/domains/email/email-service";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";

export const dynamic = "force-dynamic";

const collectionRoles = ["COLLECTION_OWNER", "AQUARIST", "FISHKEEPER", "VIEWER"] as const;

export default async function AccountRequestsPage({ searchParams }: { searchParams: Promise<{ status?: string; request?: string }> }) {
  const actor = await requireUser();
  if (!(await isServerAdmin(actor))) notFound();
  const params = await searchParams;
  const status = params.status === "history" ? "history" : "pending";
  const [pending, history, collections] = await Promise.all([
    prisma.accountRequest.findMany({
      where: { status: "PENDING" },
      include: { requestedCollection: true, reviewedBy: true, approvedCollection: true, invitation: true, invitedUser: true },
      orderBy: { requestedAt: "asc" }
    }),
    prisma.accountRequest.findMany({
      where: { status: { not: "PENDING" } },
      include: { requestedCollection: true, reviewedBy: true, approvedCollection: true, invitation: true, invitedUser: true },
      orderBy: { reviewedAt: "desc" },
      take: 50
    }),
    prisma.collection.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } })
  ]);
  const emailStatus = emailProviderStatus();
  const rows = status === "pending" ? pending : history;

  return (
    <div className="space-y-6">
      <PageHeader title="Account Requests" eyebrow="Server administration">
        <div className="flex flex-wrap gap-2">
          <Link href="/server-maintenance/users" className="text-sm font-semibold text-primary underline">Users</Link>
          <Link href="/server-maintenance" className="text-sm font-semibold text-primary underline">Back to maintenance</Link>
        </div>
      </PageHeader>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex flex-wrap gap-2">
            <Link href="/server-maintenance/account-requests" className={`rounded-md px-3 py-2 text-sm font-semibold ${status === "pending" ? "bg-primary text-primary-foreground" : "border border-border text-primary"}`}>Pending ({pending.length})</Link>
            <Link href="/server-maintenance/account-requests?status=history" className={`rounded-md px-3 py-2 text-sm font-semibold ${status === "history" ? "bg-primary text-primary-foreground" : "border border-border text-primary"}`}>History</Link>
          </div>
          <Badge className={emailStatus.configured ? "" : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100"}>
            Email {emailStatus.configured ? "configured" : "not configured"}
          </Badge>
        </CardContent>
      </Card>

      {!emailStatus.configured ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          Requests can still be reviewed, but Fluxpoint cannot deliver approval or rejection emails until email delivery is configured.
        </div>
      ) : null}

      <section className="space-y-4">
        {rows.length ? rows.map((request) => (
          <Card key={request.id} className={params.request === request.id ? "border-water" : ""}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>{request.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{request.email}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge>{request.status}</Badge>
                  <Badge>{format(request.requestedAt, "MMM d, yyyy h:mm a")}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 text-sm md:grid-cols-3">
                <Info label="Requested collection" value={request.requestedCollection?.name || request.requestedCollectionName || "Not specified"} />
                <Info label="Reviewed by" value={request.reviewedBy?.email || "Not reviewed"} />
                <Info label="Result" value={request.approvedCollection ? `${request.approvedCollection.name} · ${request.approvedCollectionRole ? collectionRoleLabels[request.approvedCollectionRole] : "role not set"}` : request.rejectionReason || "Pending"} />
              </div>
              <div className="rounded-md border border-border bg-muted/35 p-3 text-sm">
                {request.message || "No message provided."}
              </div>

              {request.status === "PENDING" ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <form action={approveAccountRequest} className="grid gap-3 rounded-md border border-border p-3">
                    <input type="hidden" name="id" value={request.id} />
                    <h3 className="font-semibold text-primary">Approve</h3>
                    <label className="grid gap-1 text-sm font-medium">
                      <span>Site role</span>
                      <Select name="serverRole" defaultValue="STANDARD_USER">
                        <option value="STANDARD_USER">Standard user</option>
                        <option value="SERVER_ADMIN">Server admin</option>
                      </Select>
                    </label>
                    <label className="grid gap-1 text-sm font-medium">
                      <span>Collection</span>
                      <Select name="collectionId" required defaultValue="">
                        <option value="" disabled>Choose collection</option>
                        {collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
                      </Select>
                    </label>
                    <label className="grid gap-1 text-sm font-medium">
                      <span>Collection role</span>
                      <Select name="collectionRole" defaultValue="VIEWER">
                        {collectionRoles.map((role) => <option key={role} value={role}>{collectionRoleLabels[role]}</option>)}
                      </Select>
                    </label>
                    <Textarea name="approvalNotes" placeholder="Internal approval notes" />
                    <Button type="submit" disabled={!collections.length}>Approve and invite</Button>
                    {!collections.length ? <p className="text-xs text-muted-foreground">Create a collection before approving account requests.</p> : null}
                  </form>

                  <form action={rejectAccountRequest} className="grid content-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                    <input type="hidden" name="id" value={request.id} />
                    <h3 className="font-semibold text-destructive">Reject</h3>
                    <Textarea name="rejectionReason" placeholder="Optional rejection reason" />
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="notify" />
                      Email requester with this reason
                    </label>
                    <Button type="submit" variant="secondary">Reject request</Button>
                  </form>
                </div>
              ) : (
                <div className="grid gap-3 text-sm md:grid-cols-3">
                  <Info label="Reviewed" value={request.reviewedAt ? format(request.reviewedAt, "MMM d, yyyy h:mm a") : "Unknown"} />
                  <Info label="Invitation" value={request.invitation ? request.invitation.status : "None"} />
                  <Info label="User" value={request.invitedUser?.email || "Not linked"} />
                </div>
              )}
            </CardContent>
          </Card>
        )) : (
          <Card><CardContent className="p-5 text-sm text-muted-foreground">No {status === "pending" ? "pending account requests" : "reviewed account requests"}.</CardContent></Card>
        )}
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/45 p-3">
      <div className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">{label}</div>
      <div className="mt-1 break-words font-semibold text-primary">{value}</div>
    </div>
  );
}
