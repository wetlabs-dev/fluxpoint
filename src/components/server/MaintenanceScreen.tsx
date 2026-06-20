import { format } from "date-fns";
import { Waves, Wrench } from "lucide-react";
import { logout } from "@/domains/auth/actions";
import { Button } from "@/components/ui/button";

export function MaintenanceScreen({ message, expectedReturnAt }: { message?: string | null; expectedReturnAt?: Date | null }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-12">
      <div className="w-full max-w-xl rounded-xl border border-border bg-card p-8 text-center shadow-soft">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-water/15 text-primary"><Wrench className="h-7 w-7" /></div>
        <div className="mt-5 flex items-center justify-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground"><Waves className="h-4 w-4" /> Fluxpoint</div>
        <h1 className="mt-3 font-display text-4xl text-primary">A little tank maintenance</h1>
        <p className="mt-4 text-muted-foreground">{message || "Fluxpoint is temporarily paused while the keeper completes server maintenance."}</p>
        {expectedReturnAt ? <p className="mt-5 rounded-md bg-muted p-3 font-mono text-sm">Expected back {format(expectedReturnAt, "MMM d, yyyy 'at' h:mm a")}</p> : null}
        <form action={logout} className="mt-6"><Button type="submit" variant="secondary">Sign out</Button></form>
      </div>
    </main>
  );
}
