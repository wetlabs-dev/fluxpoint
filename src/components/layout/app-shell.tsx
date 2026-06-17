import Link from "next/link";
import { Waves, LayoutDashboard, Fish, Package, Wrench, ListChecks, Settings, ExternalLink } from "lucide-react";
import { siteConfig } from "@/lib/config/site";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/aquariums", label: "Aquariums", icon: Fish },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/equipment", label: "Equipment", icon: Wrench },
  { href: "/workflows", label: "Workflows", icon: ListChecks },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-b border-border bg-card/76 backdrop-blur lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Waves className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <div className="text-xl font-bold tracking-normal">Fluxpoint</div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Aquarium OS</div>
          </div>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-4 pb-4 lg:block lg:space-y-1 lg:overflow-visible">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-10 shrink-0 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          ))}
          <a
            href={siteConfig.marketingUrl}
            className="flex min-h-10 shrink-0 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            About Fluxpoint
          </a>
        </nav>
      </aside>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
