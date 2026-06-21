import type { NotificationPreference } from "@prisma/client";
import { updateNotificationPreferences } from "@/domains/notifications/actions";
import { notificationRows } from "@/domains/notifications/preferences";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function NotificationPreferencesForm({ preference }: { preference: NotificationPreference | null }) {
  return <form action={updateNotificationPreferences} className="grid gap-4">
    <div className="grid gap-3 sm:grid-cols-3"><label className="grid gap-1 text-sm font-medium sm:col-span-1"><span>Timezone</span><Input name="timezone" defaultValue={preference?.timezone || "America/New_York"} required /></label><label className="grid gap-1 text-sm font-medium"><span>Push quiet hours start</span><Input name="quietHoursStart" type="time" defaultValue={preference?.quietHoursStart || ""} /></label><label className="grid gap-1 text-sm font-medium"><span>Push quiet hours end</span><Input name="quietHoursEnd" type="time" defaultValue={preference?.quietHoursEnd || ""} /></label></div>
    <p className="text-xs text-muted-foreground">Quiet hours defer push alerts. Email delivery is unaffected.</p>
    <div className="overflow-hidden rounded-md border border-border"><div className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] gap-2 bg-muted/55 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><span>Alert type</span><span>Email</span><span>Push</span></div>{notificationRows.map((row) => <div key={row.type} className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] items-center gap-2 border-t border-border px-3 py-3 text-sm"><span>{row.label}</span><label><input type="checkbox" name={row.email} defaultChecked={preference ? Boolean(preference[row.email]) : !row.type.includes("EDDY")} /><span className="sr-only">Email {row.label}</span></label><label><input type="checkbox" name={row.push} defaultChecked={preference ? Boolean(preference[row.push]) : false} /><span className="sr-only">Push {row.label}</span></label></div>)}</div>
    <Button type="submit" className="w-fit">Save notification preferences</Button>
  </form>;
}
