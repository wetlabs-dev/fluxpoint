import { Pill } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { createMedicationDefinition, deleteMedicationDefinition, updateMedicationDefinition } from "@/domains/management/actions";

export const dynamic = "force-dynamic";

const medicationTypes = ["ANTIBIOTIC", "ANTIPARASITIC", "ANTIFUNGAL", "ANTISEPTIC", "WATER_TREATMENT", "OTHER"];

export default async function MedicationsPage() {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const definitions = await prisma.medicationDefinition.findMany({
    where: { collectionId: collection.id },
    include: { courses: true },
    orderBy: { name: "asc" }
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Medications" eyebrow="Care library" />
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Pill className="h-5 w-5 text-water" /> Add medication definition</CardTitle></CardHeader>
        <CardContent><MedicationDefinitionForm /></CardContent>
      </Card>
        <Card>
          <CardHeader><CardTitle>Medication Definitions</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {definitions.length ? definitions.map((definition) => (
              <div key={definition.id} className="rounded-md border border-border bg-background/55 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-primary">{definition.name}</div>
                    <div className="text-sm text-muted-foreground">{definition.manufacturer ?? "No manufacturer"} · {definition.activeIngredients ?? "No active ingredients recorded"}</div>
                  </div>
                  <Badge>{definition.medicationType}</Badge>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <Info label="Concentration" value={definition.concentration} />
                  <Info label="Dose" value={definition.defaultDoseAmount ? `${definition.defaultDoseAmount}${definition.defaultDoseUnit ?? ""}` : null} />
                  <Info label="Dose basis" value={(definition.dosePerVolume ?? definition.dosePerGallons) ? `${definition.dosePerVolume ?? definition.dosePerGallons} ${definition.doseVolumeUnit === "LITER" ? "L" : "gal"}` : null} />
                  <Info label="Repeat" value={definition.repeatIntervalHours ? `Every ${definition.repeatIntervalHours} hours` : null} />
                  <Info label="Course" value={definition.courseLengthDays ? `${definition.courseLengthDays} days` : null} />
                  <Info label="Water changes" value={definition.waterChangeGuidance} />
                </div>
                <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">Verify medication label directions before dosing. Stored values are planning aids, not medical instructions.</div>
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-semibold text-primary">Edit definition</summary>
                  <div className="mt-3">
                    <MedicationDefinitionForm definition={definition} />
                    {definition.courses.length === 0 ? (
                      <form action={deleteMedicationDefinition} className="mt-3">
                        <input type="hidden" name="id" value={definition.id} />
                        <Button type="submit" variant="ghost">Delete definition</Button>
                      </form>
                    ) : <p className="mt-3 text-xs text-muted-foreground">Definitions with medication courses are retained for history.</p>}
                  </div>
                </details>
              </div>
            )) : <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">No medication definitions yet. Add one before starting a tank medication course.</div>}
          </CardContent>
        </Card>
    </div>
  );
}

function MedicationDefinitionForm({ definition }: { definition?: any }) {
  return (
    <form action={definition ? updateMedicationDefinition : createMedicationDefinition} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {definition ? <input type="hidden" name="id" value={definition.id} /> : null}
      <FormField label="Medication name"><Input name="name" defaultValue={definition?.name ?? ""} required /></FormField>
      <FormField label="Manufacturer"><Input name="manufacturer" defaultValue={definition?.manufacturer ?? ""} /></FormField>
      <FormField label="Medication type"><Select name="medicationType" defaultValue={definition?.medicationType ?? "OTHER"}>
        {medicationTypes.map((type) => <option key={type}>{type}</option>)}
      </Select></FormField>
      <FormField label="Active ingredients"><Input name="activeIngredients" defaultValue={definition?.activeIngredients ?? ""} /></FormField>
      <FormField label="Concentration"><Input name="concentration" defaultValue={definition?.concentration ?? ""} /></FormField>
      <FormField label="Dose amount"><Input name="defaultDoseAmount" type="number" step="0.01" defaultValue={definition?.defaultDoseAmount ?? ""} /></FormField>
      <FormField label="Dose unit"><Input name="defaultDoseUnit" placeholder="mL, tablet, scoop…" defaultValue={definition?.defaultDoseUnit ?? ""} /></FormField>
      <FormField label="Per volume"><Input name="dosePerVolume" type="number" step="0.1" defaultValue={definition?.dosePerVolume ?? definition?.dosePerGallons ?? ""} /></FormField>
      <FormField label="Volume unit"><Select name="doseVolumeUnit" defaultValue={definition?.doseVolumeUnit ?? "GALLON"}><option value="GALLON">Gallons</option><option value="LITER">Liters</option></Select></FormField>
      <FormField label="Repeat every (hours)"><Input name="repeatIntervalHours" type="number" min="1" defaultValue={definition?.repeatIntervalHours ?? ""} /></FormField>
      <FormField label="Course length (days)"><Input name="courseLengthDays" type="number" min="1" defaultValue={definition?.courseLengthDays ?? ""} /></FormField>
      <FormField label="Schedule notes" wide><Textarea name="scheduleNotes" defaultValue={definition?.scheduleNotes ?? ""} /></FormField>
      <FormField label="Water-change guidance" wide><Textarea name="waterChangeGuidance" defaultValue={definition?.waterChangeGuidance ?? ""} /></FormField>
      <FormField label="Safety notes" wide><Textarea name="safetyNotes" defaultValue={definition?.safetyNotes ?? ""} /></FormField>
      <FormField label="Contraindications" wide><Textarea name="contraindications" defaultValue={definition?.contraindications ?? ""} /></FormField>
      <Button className="sm:col-span-2 lg:col-span-3" type="submit">{definition ? "Save medication" : "Create medication"}</Button>
    </form>
  );
}

function FormField({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={`grid min-w-0 gap-1 ${wide ? "sm:col-span-2 lg:col-span-3" : ""}`}><span className="text-sm font-medium">{label}</span>{children}</label>;
}

function Info({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="rounded-md bg-muted/55 p-3">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="font-mono text-sm text-primary">{value ?? "Not set"}</div>
    </div>
  );
}
