import { ChevronDown, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function CreatePanel({ title, children, icon, defaultOpen = false, docsTarget }: { title: string; children: React.ReactNode; icon?: React.ReactNode; defaultOpen?: boolean; docsTarget?: string }) {
  return (
    <Card data-docs-target={docsTarget}>
      <details className="group" open={defaultOpen}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:content-none">
          <span className="flex items-center gap-2 font-semibold text-primary">{icon ?? <Plus className="h-5 w-5 text-water" />}{title}</span>
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Open form <ChevronDown className="h-4 w-4 transition group-open:rotate-180" /></span>
        </summary>
        <CardContent className="border-t border-border pt-5">{children}</CardContent>
      </details>
    </Card>
  );
}
