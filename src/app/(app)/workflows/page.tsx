import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function WorkflowsPage() {
  const templates = await prisma.workflowTemplate.findMany({
    include: { steps: { orderBy: { order: "asc" } } },
    orderBy: { name: "asc" }
  });

  return (
    <div>
      <PageHeader title="Workflows" eyebrow="Care routines" />
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <CardTitle>{template.name}</CardTitle>
                <Badge>{template.category}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{template.description}</p>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2 text-sm">
                {template.steps.map((step) => (
                  <li key={step.id} className="rounded-md bg-muted/55 p-3">
                    <span className="font-semibold">{step.order}. {step.title}</span>
                    <span className="block text-muted-foreground">{step.stepType}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
