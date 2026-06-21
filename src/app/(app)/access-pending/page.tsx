import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AccessPendingPage() {
  return <div className="mx-auto max-w-2xl space-y-6">
    <PageHeader eyebrow="Collection access" title="Your account is ready" />
    <Card><CardHeader><CardTitle>No collection assigned yet</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground"><p>A server administrator needs to add this account to a collection before aquarium records are available.</p><p>You can keep this page open and refresh after access is assigned.</p></CardContent></Card>
  </div>;
}
