import { existsSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { AlertTriangle, BookOpen, ExternalLink, FileText, Info } from "lucide-react";
import { manualSections } from "@/lib/user-manual";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function screenshotExists(filename: string) {
  return existsSync(join(process.cwd(), "public", "manual", "screenshots", filename));
}

export default function HelpPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="User Guide" eyebrow="Fluxpoint help">
        <a className="inline-flex min-h-10 items-center justify-center rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted/70" href="/manual/USER_MANUAL.md">
          <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
          Markdown manual
        </a>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-water" aria-hidden="true" />
            What is covered
          </CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">
            This guide is generated from Fluxpoint’s typed manual source so the in-app guide and static Markdown reference stay aligned.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {manualSections.map((section) => (
              <a key={section.id} href={`#${section.id}`} className="rounded-md border border-border bg-muted/35 px-3 py-2 text-sm font-semibold text-primary transition hover:bg-muted">
                {section.title}
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-5">
        {manualSections.map((section) => {
          const hasScreenshot = section.screenshot ? screenshotExists(section.screenshot) : false;
          return (
            <Card key={section.id} id={section.id} className="scroll-mt-5">
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="text-2xl">{section.title}</CardTitle>
                    {section.route ? (
                      <Link className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline" href={section.route}>
                        Open page
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    ) : null}
                  </div>
                  {section.route ? <Badge>{section.route}</Badge> : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {section.screenshot ? (
                  hasScreenshot ? (
                    <img
                      src={`/manual/screenshots/${section.screenshot}`}
                      alt={`${section.title} screenshot`}
                      className="w-full rounded-lg border border-border bg-muted object-cover shadow-soft"
                    />
                  ) : (
                    <div className="rounded-lg border border-dashed border-border bg-muted/35 p-5 text-sm text-muted-foreground">
                      Screenshot placeholder: run <code className="rounded bg-background px-1.5 py-0.5">npm run docs:screenshots</code> to generate <code>{section.screenshot}</code>.
                    </div>
                  )
                ) : null}

                <section className="space-y-2">
                  <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-moss">Purpose</h3>
                  <p className="leading-7 text-muted-foreground">{section.purpose}</p>
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-moss">How to use it</h3>
                  <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
                    {section.howTo.map((step) => (
                      <li key={step} className="leading-7">{step}</li>
                    ))}
                  </ol>
                </section>

                {section.notes?.length ? (
                  <section className="rounded-lg border border-water/25 bg-water/10 p-4">
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-primary">
                      <Info className="h-4 w-4" aria-hidden="true" />
                      Notes
                    </h3>
                    <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
                      {section.notes.map((note) => <li key={note}>{note}</li>)}
                    </ul>
                  </section>
                ) : null}

                {section.warnings?.length ? (
                  <section className="rounded-lg border border-amber-500/35 bg-amber-500/10 p-4">
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                      Warnings
                    </h3>
                    <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
                      {section.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                    </ul>
                  </section>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
