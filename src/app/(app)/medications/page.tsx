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
      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
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
    </div>
  );
}

function MedicationDefinitionForm({ definition }: { definition?: any }) {
  return (
    <form action={definition ? updateMedicationDefinition : createMedicationDefinition} className="grid gap-3">
      {definition ? <input type="hidden" name="id" value={definition.id} /> : null}
      <Input name="name" placeholder="Medication name" defaultValue={definition?.name ?? ""} required />
      <Input name="manufacturer" placeholder="Manufacturer" defaultValue={definition?.manufacturer ?? ""} />
      <Select name="medicationType" defaultValue={definition?.medicationType ?? "OTHER"}>
        {medicationTypes.map((type) => <option key={type}>{type}</option>)}
      </Select>
      <Input name="activeIngredients" placeholder="Active ingredients" defaultValue={definition?.activeIngredients ?? ""} />
      <Input name="concentration" placeholder="Concentration" defaultValue={definition?.concentration ?? ""} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="defaultDoseAmount" type="number" step="0.01" placeholder="Dose amount" defaultValue={definition?.defaultDoseAmount ?? ""} />
        <Input name="defaultDoseUnit" placeholder="Dose unit" defaultValue={definition?.defaultDoseUnit ?? ""} />
        <label className="grid gap-1"><span className="text-sm font-medium">Per volume</span><Input name="dosePerVolume" type="number" step="0.1" placeholder="10" defaultValue={definition?.dosePerVolume ?? definition?.dosePerGallons ?? ""} /></label>
        <label className="grid gap-1"><span className="text-sm font-medium">Volume unit</span><Select name="doseVolumeUnit" defaultValue={definition?.doseVolumeUnit ?? "GALLON"}><option value="GALLON">Gallons</option><option value="LITER">Liters</option></Select></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="repeatIntervalHours" type="number" min="1" placeholder="Repeat every hours" defaultValue={definition?.repeatIntervalHours ?? ""} />
        <Input name="courseLengthDays" type="number" min="1" placeholder="Course length days" defaultValue={definition?.courseLengthDays ?? ""} />
      </div>
      <Textarea name="scheduleNotes" placeholder="Schedule notes" defaultValue={definition?.scheduleNotes ?? ""} />
      <Textarea name="waterChangeGuidance" placeholder="Water-change guidance" defaultValue={definition?.waterChangeGuidance ?? ""} />
      <Textarea name="safetyNotes" placeholder="Safety notes" defaultValue={definition?.safetyNotes ?? ""} />
      <Textarea name="contraindications" placeholder="Contraindications" defaultValue={definition?.contraindications ?? ""} />
      <Button type="submit">{definition ? "Save medication" : "Create medication"}</Button>
    </form>
  );
}

function Info({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="rounded-md bg-muted/55 p-3">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="font-mono text-sm text-primary">{value ?? "Not set"}</div>
    </div>
  );
}
