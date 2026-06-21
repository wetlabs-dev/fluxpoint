import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { isServerAdmin } from "@/domains/server/server-admin";
import { createServerUser, deleteServerUser, toggleServerUser, updateServerUser } from "@/domains/server/actions";
import { collectionRoleLabels } from "@/domains/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

export const dynamic = "force-dynamic";

export default async function ServerUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const actor = await requireUser();
  if (!(await isServerAdmin(actor))) notFound();
  const params = await searchParams;
  const q = params.q?.trim();
  const users = await prisma.user.findMany({
    where: {
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }] } : {}),
      ...(params.status === "enabled" ? { disabledAt: null } : params.status === "disabled" ? { disabledAt: { not: null } } : {})
    },
    include: { collections: true, collectionMemberships: { include: { collection: true }, orderBy: { createdAt: "asc" } }, _count: { select: { sessions: true } } },
    orderBy: { createdAt: "asc" }
  });
  const enabledAdminCount = await prisma.user.count({ where: { serverRole: "SERVER_ADMIN", disabledAt: null } });
  return <div className="space-y-6">
    <PageHeader title="User Management" eyebrow="Server administration"><Link href="/server-maintenance" className="text-sm font-semibold text-primary underline">Back to maintenance</Link></PageHeader>
    <Card><CardContent className="p-4"><form className="grid gap-3 sm:grid-cols-[1fr_11rem_auto]"><Input name="q" defaultValue={q ?? ""} placeholder="Search name or email" /><Select name="status" defaultValue={params.status ?? "all"}><option value="all">All users</option><option value="enabled">Enabled</option><option value="disabled">Disabled</option></Select><Button type="submit" variant="secondary">Filter</Button></form></CardContent></Card>
    <div className="grid gap-6 xl:grid-cols-[1fr_390px]">
      <section className="space-y-3">{users.map((user) => {
        const collections = new Map([...user.collections.map((collection) => [collection.id, `${collection.name} (primary owner)`] as const), ...user.collectionMemberships.map((membership) => [membership.collection.id, `${membership.collection.name} (${collectionRoleLabels[membership.role]})`] as const)]);
        const protectedAdmin = user.serverRole === "SERVER_ADMIN" && !user.disabledAt && enabledAdminCount <= 1;
        return <Card key={user.id}><CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-semibold text-primary">{user.name}</div><div className="text-sm text-muted-foreground">{user.email}</div></div><div className="flex flex-wrap gap-2"><Badge>{user.serverRole === "SERVER_ADMIN" ? "Server Admin" : "Standard User"}</Badge><Badge>{user.disabledAt ? "Disabled" : "Enabled"}</Badge>{user.id === actor.id ? <Badge>Current account</Badge> : null}</div></div>
          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3"><span>Created {format(user.createdAt, "MMM d, yyyy")}</span><span>{user.lastLoginAt ? `Last login ${format(user.lastLoginAt, "MMM d, yyyy h:mm a")}` : "Never logged in"}</span><span>{user._count.sessions} active session(s)</span></div>
          <p className="text-sm text-muted-foreground">Collections: {[...collections.values()].join(", ") || "None"}</p>
          <details className="rounded-md border border-border p-3"><summary className="cursor-pointer font-semibold text-primary">Edit account and credentials</summary><form action={updateServerUser} className="mt-3 grid gap-3 sm:grid-cols-2"><input type="hidden" name="id" value={user.id} /><label className="grid gap-1"><span className="text-sm font-medium">Display name</span><Input name="name" defaultValue={user.name} required /></label><label className="grid gap-1"><span className="text-sm font-medium">Server role</span><Select name="serverRole" defaultValue={user.serverRole}><option value="STANDARD_USER">Standard User</option><option value="SERVER_ADMIN">Server Admin</option></Select></label><label className="grid gap-1 sm:col-span-2"><span className="text-sm font-medium">New temporary password</span><Input name="temporaryPassword" type="password" minLength={12} placeholder="Leave blank to keep current password" /></label><Button type="submit">Save user</Button></form></details>
          <div className="flex flex-wrap gap-2"><form action={toggleServerUser}><input type="hidden" name="id" value={user.id} /><Button type="submit" variant="secondary" disabled={(user.id === actor.id && !user.disabledAt) || protectedAdmin}>{user.disabledAt ? "Enable user" : "Disable user"}</Button></form></div>
          <details className="rounded-md border border-red-300 bg-red-50/70 p-3 dark:border-red-900 dark:bg-red-950/20"><summary className="cursor-pointer text-sm font-semibold text-red-800 dark:text-red-200">Delete user permanently</summary><p className="mt-2 text-xs text-muted-foreground">Blocked for your own account, the last enabled Server Admin, or users who still own collections. Historical authored records retain a null actor.</p><form action={deleteServerUser} className="mt-3 flex flex-col gap-2 sm:flex-row"><input type="hidden" name="id" value={user.id} /><Input name="confirmation" placeholder={`Type DELETE ${user.email}`} required /><Button type="submit" variant="secondary" disabled={user.id === actor.id || protectedAdmin || user.collections.length > 0}>Delete permanently</Button></form></details>
        </CardContent></Card>;
      })}</section>
      <Card><CardHeader><CardTitle>Create user</CardTitle></CardHeader><CardContent><form action={createServerUser} className="grid gap-3"><label className="grid gap-1"><span className="text-sm font-medium">Display name</span><Input name="name" required /></label><label className="grid gap-1"><span className="text-sm font-medium">Email</span><Input name="email" type="email" required /></label><label className="grid gap-1"><span className="text-sm font-medium">Server role</span><Select name="serverRole" defaultValue="STANDARD_USER"><option value="STANDARD_USER">Standard User</option><option value="SERVER_ADMIN">Server Admin</option></Select></label><label className="grid gap-1"><span className="text-sm font-medium">Temporary password</span><Input name="temporaryPassword" type="password" minLength={12} required /></label><p className="text-xs text-muted-foreground">Server Admin grants sitewide administration. Collection access is managed separately through memberships.</p><Button type="submit">Create user</Button></form></CardContent></Card>
    </div>
  </div>;
}
