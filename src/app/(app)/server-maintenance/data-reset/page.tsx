import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { isServerAdmin } from "@/domains/server/server-admin";
import { appDataCounts } from "@/domains/server/data-reset";
import { resetApplicationDataAction } from "@/domains/server/actions";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

export default async function DataResetPage() {
  const actor = await requireUser(); if (!(await isServerAdmin(actor))) notFound();
  const [counts, users, latestBackup] = await Promise.all([
    appDataCounts(),
    prisma.user.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true, serverRole: true } }),
    prisma.backupRun.findFirst({ where: { status: "COMPLETE" }, orderBy: { finishedAt: "desc" }, select: { finishedAt: true, folderName: true } })
  ]);
  return <div className="space-y-6">
    <PageHeader title="Application Data Reset" eyebrow="Destructive server operation"><Link href="/server-maintenance" className="text-sm font-semibold text-primary underline">Back to maintenance</Link></PageHeader>
    <Card className="border-amber-300 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/20"><CardContent className="space-y-3 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-amber-950 dark:text-amber-100">Create a backup before reset</h2><p className="text-sm text-muted-foreground">The reset is irreversible from the application UI. Backup archive files are preserved unless removed separately.</p></div><Link href="/server-maintenance#backups" className="rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-primary">Open backups</Link></div><div className="text-xs text-muted-foreground">{latestBackup?.finishedAt ? `Latest completed backup: ${format(latestBackup.finishedAt, "MMM d, yyyy h:mm a")} · ${latestBackup.folderName ?? "backup folder"}` : "No completed backup is recorded."}</div></CardContent></Card>
    <div className="grid gap-6 xl:grid-cols-[1fr_430px]">
      <Card><CardHeader><CardTitle>Current application data</CardTitle></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(counts).map(([label, value]) => <div key={label} className="rounded-md bg-muted/45 p-3"><div className="text-xs text-muted-foreground">{label.replaceAll(/([A-Z])/g, " $1").toLowerCase()}</div><div className="font-mono text-xl font-semibold text-primary">{value}</div></div>)}</div><div className="mt-5 rounded-md border border-border p-4 text-sm text-muted-foreground"><strong className="text-primary">Always deleted:</strong> collections, memberships, invitations, aquariums, species and husbandry, locations, sources, inventory, equipment, lighting, medications, events, media database records, schedules/tasks, Eddy/AI records, email logs, QR records, and application audit history.<br/><br/><strong className="text-primary">Preserved by default:</strong> users, sessions, password-reset tokens, operational server metrics/incidents, backup metadata, and all backup archive files.</div></CardContent></Card>
      <Card className="border-red-300 dark:border-red-900"><CardHeader><CardTitle>Reset Fluxpoint</CardTitle></CardHeader><CardContent><form action={resetApplicationDataAction} className="grid gap-5">
        <fieldset className="grid gap-2"><legend className="text-sm font-semibold text-primary">Accounts to preserve</legend><label className="flex items-start gap-2 rounded-md border border-border p-3"><input type="radio" name="preserveMode" value="all" defaultChecked /><span><strong className="block">Preserve all users</strong><span className="text-xs text-muted-foreground">Safest default; keeps every login and authentication record.</span></span></label><label className="flex items-start gap-2 rounded-md border border-border p-3"><input type="radio" name="preserveMode" value="selected" /><span><strong className="block">Preserve selected users only</strong><span className="text-xs text-muted-foreground">Permanently deletes every unselected account after collection data is removed.</span></span></label></fieldset>
        <fieldset className="grid gap-2"><legend className="text-sm font-semibold text-primary">Preserved-user selection</legend><input type="hidden" name="preserveUserEmail" value={actor.email} />{users.map((user) => <label key={user.id} className="flex items-center justify-between gap-3 rounded-md bg-muted/45 p-3 text-sm"><span><strong>{user.name}</strong><span className="block text-xs text-muted-foreground">{user.email} · {user.serverRole === "SERVER_ADMIN" ? "Server Admin" : "Standard User"}</span></span><input type="checkbox" name="preserveUserEmail" value={user.email} defaultChecked disabled={user.id === actor.id} /></label>)}</fieldset>
        <fieldset className="grid gap-2"><legend className="text-sm font-semibold text-primary">Reset options</legend><Check name="createDefaultCollection" label="Create a fresh Home Aquariums collection for a preserved admin" defaultChecked /><Check name="deleteFiles" label="Delete uploaded files, generated labels, and reports (backup files remain)" /><Check name="deleteOperationalData" label="Also delete server metrics, incidents, health checks, and worker history" /><Check name="deleteBackupMetadata" label="Also delete backup database metadata (archive folders remain on disk)" /></fieldset>
        <label className="grid gap-1"><span className="text-sm font-semibold text-primary">Current password</span><Input name="currentPassword" type="password" required autoComplete="current-password" /></label>
        <label className="grid gap-1"><span className="text-sm font-semibold text-red-800 dark:text-red-200">Type RESET FLUXPOINT</span><Input name="confirmation" required autoComplete="off" /></label>
        <Button type="submit" variant="secondary">Permanently reset application data</Button>
      </form></CardContent></Card>
    </div>
  </div>;
}

function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) { return <label className="flex items-start gap-2 rounded-md border border-border p-3 text-sm"><input type="checkbox" name={name} defaultChecked={defaultChecked} /><span>{label}</span></label>; }
