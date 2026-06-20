import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { isServerAdmin } from "@/domains/server/server-admin";
import { createServerUser, toggleServerUser, updateServerUser } from "@/domains/server/actions";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

export default async function ServerUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const actor = await requireUser();
  if (!(await isServerAdmin(actor))) notFound();
  const q = (await searchParams).q?.trim();
  const users = await prisma.user.findMany({
    where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : undefined,
    include: { collections: true, collectionMemberships: { include: { collection: true } }, _count: { select: { sessions: true } } },
    orderBy: { createdAt: "asc" }
  });
  const adminIds = new Set((await Promise.all(users.map(async (user) => await isServerAdmin(user) ? user.id : null))).filter(Boolean));
  return <div className="space-y-6">
    <PageHeader title="User Management" eyebrow="Server administration"><Link href="/server-maintenance" className="text-sm font-semibold text-primary underline">Back to maintenance</Link></PageHeader>
    <Card><CardContent className="p-4"><form className="flex flex-col gap-3 sm:flex-row"><Input name="q" defaultValue={q ?? ""} placeholder="Search name or email" /><Button type="submit" variant="secondary">Search</Button></form></CardContent></Card>
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <section className="space-y-3">{users.map((user) => {
        const admin = adminIds.has(user.id);
        const collections = new Map([...user.collections.map((collection) => [collection.id, collection.name] as const), ...user.collectionMemberships.map((membership) => [membership.collection.id, membership.collection.name] as const)]);
        return <Card key={user.id}><CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-semibold text-primary">{user.name}</div><div className="text-sm text-muted-foreground">{user.email}</div></div><div className="flex gap-2"><Badge>{admin ? "SERVER ADMIN" : "USER"}</Badge><Badge>{user.disabledAt ? "DISABLED" : "ACTIVE"}</Badge></div></div>
          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3"><span>Created {format(user.createdAt,"MMM d, yyyy")}</span><span>{user.lastLoginAt ? `Last login ${format(user.lastLoginAt,"MMM d, yyyy h:mm a")}` : "Never logged in"}</span><span>{user._count.sessions} active session(s)</span></div>
          <p className="text-sm text-muted-foreground">Collections: {[...collections.values()].join(", ") || "None"}</p>
          <details className="rounded-md border border-border p-3"><summary className="cursor-pointer font-semibold text-primary">Edit user</summary><form action={updateServerUser} className="mt-3 grid gap-3 sm:grid-cols-2"><input type="hidden" name="id" value={user.id} /><Input name="name" defaultValue={user.name} required /><Input name="temporaryPassword" type="password" minLength={12} placeholder="Optional new password" /><Button type="submit">Save user</Button></form></details>
          <form action={toggleServerUser}><input type="hidden" name="id" value={user.id} /><Button type="submit" variant="secondary" disabled={admin && !user.disabledAt}>{user.disabledAt ? "Enable user" : "Disable user"}</Button></form>
        </CardContent></Card>;
      })}</section>
      <Card><CardHeader><CardTitle>Create user</CardTitle></CardHeader><CardContent><form action={createServerUser} className="grid gap-3"><label className="grid gap-1"><span className="text-sm font-medium">Display name</span><Input name="name" required /></label><label className="grid gap-1"><span className="text-sm font-medium">Email</span><Input name="email" type="email" required /></label><label className="grid gap-1"><span className="text-sm font-medium">Temporary password</span><Input name="temporaryPassword" type="password" minLength={12} required /></label><p className="text-xs text-muted-foreground">The user should change this after first login. Password hashes are never displayed.</p><Button type="submit">Create user</Button></form></CardContent></Card>
    </div>
  </div>;
}
