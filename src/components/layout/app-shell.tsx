import Link from "next/link";
import { LayoutDashboard, Fish, Package, Wrench, ListChecks, Settings, ExternalLink, Leaf, CalendarClock, FolderKanban, UserCircle, Lightbulb, Activity, Pill, Archive, ShieldAlert, HeartPulse, QrCode, Sprout, BookOpen, Siren, ClipboardList, BrainCircuit } from "lucide-react";
import { siteConfig } from "@/lib/config/site";
import { logout } from "@/domains/auth/actions";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { EddyPanel } from "@/components/eddy/EddyPanel";
import { Fragment } from "react";
import { MobileAccountMenu } from "@/components/layout/MobileAccountMenu";
import { FluxpointLogoTile } from "@/components/brand/FluxpointLogo";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/aquariums", label: "Aquariums", icon: Fish },
  { href: "/intelligence", label: "Intelligence", icon: BrainCircuit },
  { href: "/planning", label: "Planning", icon: ClipboardList },
  { href: "/conditions", label: "Conditions", icon: HeartPulse },
  { href: "/species", label: "Species", icon: Leaf },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/storage", label: "Storage", icon: Archive },
  { href: "/quarantine", label: "Quarantine", icon: ShieldAlert },
  { href: "/emergency-response", label: "Emergency Response", icon: Siren },
  { href: "/breeding", label: "Breeding", icon: Sprout },
  { href: "/equipment", label: "Equipment", icon: Wrench },
  { href: "/schedules", label: "Schedules", icon: CalendarClock },
  { href: "/lighting-schedules", label: "Lighting", icon: Lightbulb },
  { href: "/medications", label: "Medications", icon: Pill },
  { href: "/metrics", label: "Metrics", icon: Activity },
  { href: "/workflows", label: "Workflows", icon: ListChecks },
  { href: "/labels", label: "Labels", icon: QrCode },
  { href: "/collection", label: "Collection", icon: FolderKanban },
  { href: "/account", label: "Account", icon: UserCircle },
  { href: "/help", label: "User Guide", icon: BookOpen },
  { href: "/server-maintenance", label: "Server Maintenance", icon: Settings, adminOnly: true }
];

export function AppShell({ children, user, isServerAdmin }: { children: React.ReactNode; user: { name: string; email: string }; isServerAdmin: boolean }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="border-b border-border bg-card/76 backdrop-blur lg:sticky lg:top-0 lg:flex lg:h-screen lg:min-h-0 lg:self-start lg:flex-col lg:overflow-hidden lg:border-b-0 lg:border-r">
        <div className="relative flex items-center justify-between gap-3 px-5 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] lg:py-5">
          <Link href="/dashboard" aria-label="Fluxpoint dashboard" className="flex min-w-0 items-center gap-3 rounded-md transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <FluxpointLogoTile size={44} />
            <div className="min-w-0">
              <div className="text-xl font-bold tracking-normal">Fluxpoint</div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Aquarium OS</div>
            </div>
          </Link>
          <MobileAccountMenu user={user} />
        </div>
        <nav className="flex gap-2 overflow-x-auto px-4 pb-4 lg:block lg:min-h-0 lg:flex-1 lg:space-y-1 lg:overflow-y-auto lg:overscroll-contain">
          {nav.filter((item) => !item.adminOnly || isServerAdmin).map((item, index) => (
            <Fragment key={item.href}>
              <Link
                href={item.href}
                className="flex min-h-10 shrink-0 items-center gap-3 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </Link>
              {index === 0 ? <div className="contents lg:block lg:my-2 lg:border-y lg:border-water/20 lg:py-2"><EddyPanel /></div> : null}
            </Fragment>
          ))}
          <a
            href={siteConfig.marketingUrl}
            className="flex min-h-10 shrink-0 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            About Fluxpoint
          </a>
        </nav>
        <div className="hidden shrink-0 border-t border-border bg-card/95 px-5 py-4 lg:block">
          <div className="mb-3 rounded-md bg-muted/55 p-3">
            <div className="text-sm font-semibold text-primary">{user.name}</div>
            <div className="truncate text-xs text-muted-foreground">{user.email}</div>
          </div>
          <div className="mb-3">
            <ThemeToggle compact />
          </div>
          <form action={logout}>
            <Button type="submit" variant="secondary" className="w-full">Log out</Button>
          </form>
        </div>
      </aside>
      <main className="mx-auto min-w-0 w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">{children}</main>
    </div>
  );
}
