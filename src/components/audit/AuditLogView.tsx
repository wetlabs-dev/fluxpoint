import Link from "next/link";
import { format } from "date-fns";
import type { AuditLog, Collection, User } from "@prisma/client";
import { Search, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import type { AuditLogFilters } from "@/domains/audit/audit-types";

type AuditRow = AuditLog & {
  actor: Pick<User, "id" | "name" | "email"> | null;
  collection: Pick<Collection, "id" | "name"> | null;
};

type Option = { value: string; label: string };

export function AuditLogView({
  logs,
  total,
  page,
  pageCount,
  filters,
  basePath,
  serverView,
  collections = [],
  entityTypes = [],
  actions = []
}: {
  logs: AuditRow[];
  total: number;
  page: number;
  pageCount: number;
  filters: AuditLogFilters;
  basePath: string;
  serverView: boolean;
  collections?: Option[];
  entityTypes?: string[];
  actions?: string[];
}) {
  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== "" && key !== "page") params.set(key, String(value));
    params.set("page", String(nextPage));
    return `${basePath}?${params.toString()}`;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-water" /> Filter events</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="relative md:col-span-2 xl:col-span-4"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" name="search" defaultValue={filters.search} placeholder="Search summaries, actors, actions, entities, or collections" /></label>
            <Input name="from" type="date" defaultValue={filters.from} aria-label="From date" />
            <Input name="to" type="date" defaultValue={filters.to} aria-label="To date" />
            <Select name="scope" defaultValue={filters.scope}><option value="">All scopes</option>{["SERVER", "COLLECTION", "USER", "SYSTEM"].map((value) => <option key={value}>{value}</option>)}</Select>
            <Select name="severity" defaultValue={filters.severity}><option value="">All severities</option>{["INFO", "WARNING", "CRITICAL"].map((value) => <option key={value}>{value}</option>)}</Select>
            {serverView ? <Select name="collectionId" defaultValue={filters.collectionId}><option value="">All collections</option>{collections.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select> : null}
            <Input name="actor" defaultValue={filters.actor} placeholder="Actor name or email" />
            <Select name="entityType" defaultValue={filters.entityType}><option value="">All entity types</option>{entityTypes.map((value) => <option key={value}>{value}</option>)}</Select>
            <Select name="action" defaultValue={filters.action}><option value="">All actions</option>{actions.map((value) => <option key={value}>{value}</option>)}</Select>
            <div className="flex gap-2 md:col-span-2 xl:col-span-4"><Button type="submit">Apply filters</Button><Link className="inline-flex min-h-10 items-center rounded-md border border-border bg-card px-4 text-sm font-semibold text-primary hover:bg-muted" href={basePath}>Clear</Link></div>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground"><span>{total.toLocaleString()} event{total === 1 ? "" : "s"}</span><span>Page {page} of {pageCount}</span></div>

      {logs.length ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-soft">
          <div className="hidden grid-cols-[150px_150px_170px_minmax(180px,1fr)_130px] gap-3 border-b border-border bg-muted/55 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground lg:grid">
            <span>Time</span><span>Actor</span><span>Action / entity</span><span>Summary</span><span>Scope</span>
          </div>
          <div className="divide-y divide-border">
            {logs.map((log) => {
              const detail = log.details ?? (log.before || log.after ? { before: log.before, after: log.after } : null);
              const entityHref = entityLink(log, serverView);
              return (
                <article key={log.id} className="grid gap-2 px-3 py-3 text-sm transition hover:bg-muted/30 lg:grid-cols-[150px_150px_170px_minmax(180px,1fr)_130px] lg:gap-3">
                  <div className="font-mono text-xs text-muted-foreground"><time dateTime={log.createdAt.toISOString()}>{format(log.createdAt, "MMM d, yyyy")}<br />{format(log.createdAt, "h:mm:ss a")}</time></div>
                  <div className="min-w-0"><div className="truncate font-semibold text-primary">{serverView && log.actorUserId ? <Link className="hover:underline" href="/server-maintenance/users">{log.actorDisplayName || log.actor?.name || "Deleted user"}</Link> : log.actorDisplayName || log.actor?.name || "System"}</div><div className="truncate text-xs text-muted-foreground">{log.actorEmail || log.actor?.email || log.actorRole || "worker / system"}</div></div>
                  <div className="min-w-0"><div className="break-words font-mono text-xs font-semibold text-primary">{log.action}</div><div className="mt-1 truncate text-xs text-muted-foreground">{entityHref ? <Link className="hover:underline" href={entityHref}>{log.entityType}{log.entityId ? ` · ${shortId(log.entityId)}` : ""}</Link> : <>{log.entityType}{log.entityId ? ` · ${shortId(log.entityId)}` : ""}</>}</div></div>
                  <div className="min-w-0"><p className="text-primary">{log.summary}</p>{detail || log.metadata ? <details className="mt-2"><summary className="cursor-pointer text-xs font-semibold text-water">Structured details</summary><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border bg-background/70 p-3 text-[11px] text-muted-foreground">{JSON.stringify({ ...(detail ? { details: detail } : {}), ...(log.metadata ? { metadata: log.metadata } : {}), ...(log.requestId ? { requestId: log.requestId } : {}) }, null, 2)}</pre></details> : null}</div>
                  <div className="flex flex-wrap content-start gap-1 lg:block"><Badge className={severityClass(log.severity)}>{log.severity}</Badge><div className="mt-1 text-xs text-muted-foreground">{log.scope.toLowerCase()}</div><div className="truncate text-xs text-muted-foreground">{log.collection ? <Link className="hover:underline" href={serverView ? "/server-maintenance/collections" : "/collection"}>{log.collection.name}</Link> : log.scope === "COLLECTION" ? "deleted collection" : ""}</div></div>
                </article>
              );
            })}
          </div>
        </div>
      ) : <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No audit events match these filters.</CardContent></Card>}

      <div className="flex justify-between gap-3"><Link aria-disabled={page <= 1} className={`rounded-md border border-border px-4 py-2 text-sm font-semibold ${page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-muted"}`} href={pageHref(Math.max(1, page - 1))}>Previous</Link><Link aria-disabled={page >= pageCount} className={`rounded-md border border-border px-4 py-2 text-sm font-semibold ${page >= pageCount ? "pointer-events-none opacity-40" : "hover:bg-muted"}`} href={pageHref(Math.min(pageCount, page + 1))}>Next</Link></div>
    </div>
  );
}

function shortId(id: string) { return id.length > 18 ? `${id.slice(0, 8)}…` : id; }

function severityClass(severity: string) {
  if (severity === "CRITICAL") return "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/35 dark:text-red-200";
  if (severity === "WARNING") return "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-200";
  return "border-water/30 bg-water/10 text-primary";
}

function entityLink(log: AuditRow, serverView: boolean) {
  if (!log.entityId) return null;
  if (log.entityType === "Aquarium") return `/aquariums/${log.entityId}`;
  if (log.entityType === "SpeciesDefinition") return `/species/${log.entityId}`;
  if (log.entityType === "Collection") return serverView ? "/server-maintenance/collections" : "/collection";
  if (log.entityType === "User" && serverView) return "/server-maintenance/users";
  return null;
}
