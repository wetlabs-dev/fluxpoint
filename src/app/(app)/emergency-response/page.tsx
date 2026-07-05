import Link from "next/link";
import { AlertTriangle, Bell, CheckCircle2, ClipboardList, LifeBuoy, Siren } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import {
  addEmergencyLog,
  archiveEmergencyPlan,
  createEddyEmergencyGuidance,
  emergencyPhases,
  emergencySeverities,
  emergencyStatuses,
  emergencyTypes,
  ensureDefaultEmergencyPlans,
  formatEmergencyLabel,
  planTextareas,
  saveEmergencyPlan,
  startEmergencyIncident,
  updateEmergencyIncidentStatus,
  updateEmergencyStepStatus
} from "@/domains/emergencies/emergency-response";
import { getCollectionRole } from "@/domains/auth/permissions";

export const dynamic = "force-dynamic";

const activeStatuses = ["ACTIVE", "STABILIZING", "RECOVERING", "VERIFYING"] as const;

export default async function EmergencyResponsePage({ searchParams }: { searchParams?: Promise<{ planId?: string; createPlan?: string }> }) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  await ensureDefaultEmergencyPlans(collection.id, user.id);
  const role = await getCollectionRole(user.id, collection.id);
  const canManagePlans = role === "COLLECTION_OWNER";
  const params = await searchParams;

  const [plans, aquariums, activeIncidents, resolvedIncidents, selectedPlan] = await Promise.all([
    prisma.emergencyPlan.findMany({ where: { collectionId: collection.id }, orderBy: [{ isActive: "desc" }, { emergencyType: "asc" }, { title: "asc" }] }),
    prisma.aquarium.findMany({ where: { collectionId: collection.id, status: { not: "ARCHIVED" } }, orderBy: { name: "asc" } }),
    prisma.emergencyIncident.findMany({
      where: { collectionId: collection.id, status: { in: [...activeStatuses] } },
      include: {
        emergencyPlan: true,
        aquariums: { include: { aquarium: true }, orderBy: { createdAt: "asc" } },
        steps: { include: { careTask: true }, orderBy: [{ phase: "asc" }, { sortOrder: "asc" }] },
        logs: { include: { aquarium: true, createdBy: true }, orderBy: { loggedAt: "desc" }, take: 8 }
      },
      orderBy: [{ severity: "desc" }, { startedAt: "desc" }]
    }),
    prisma.emergencyIncident.findMany({
      where: { collectionId: collection.id, status: { in: ["RESOLVED", "CANCELLED"] } },
      include: { aquariums: { include: { aquarium: true } } },
      orderBy: { startedAt: "desc" },
      take: 12
    }),
    params?.planId ? prisma.emergencyPlan.findFirst({ where: { id: params.planId, collectionId: collection.id } }) : null
  ]);

  const planForForm = selectedPlan ?? (params?.createPlan ? null : plans.find((plan) => plan.isActive) ?? null);

  return (
    <div className="space-y-6">
      <PageHeader title="Emergency Response" eyebrow="Urgent aquarium operations">
        <Badge className={activeIncidents.some((incident) => incident.severity === "CRITICAL") ? "border-destructive/40 bg-destructive/15 text-destructive" : "bg-card text-primary"}>
          {activeIncidents.length} active
        </Badge>
      </PageHeader>

      <Card className="border-amber-500/35 bg-amber-500/10">
        <CardContent className="flex flex-col gap-3 p-5 text-sm text-muted-foreground sm:flex-row sm:items-start">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
          <p>
            Emergencies put livestock, people, and property at risk. Fluxpoint helps track response steps and reminders, but do not handle wet electrical equipment,
            do not rely on AI for veterinary certainty, and call local professionals for severe electrical, flooding, structural, or animal-health hazards.
          </p>
        </CardContent>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <StartIncidentCard plans={plans.filter((plan) => plan.isActive)} aquariums={aquariums} />
        <PlanEditorCard plan={planForForm} canManagePlans={canManagePlans} />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold text-primary">Active incidents</h2>
          <Badge>{activeIncidents.filter((incident) => incident.severity === "CRITICAL").length} critical</Badge>
        </div>
        {activeIncidents.length ? (
          <div className="space-y-5">
            {activeIncidents.map((incident) => <IncidentWorkspace key={incident.id} incident={incident} aquariums={aquariums} />)}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">No active emergency incidents. May the pumps hum peacefully.</CardContent>
          </Card>
        )}
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-water" /> Emergency plans</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {plans.map((plan) => (
              <div key={plan.id} className="rounded-md border border-border bg-background/55 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-primary">{plan.title}</h3>
                    <p className="text-xs text-muted-foreground">{formatEmergencyLabel(plan.emergencyType)} · default {plan.severityDefault.toLowerCase()}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge>{plan.isActive ? "active" : "archived"}</Badge>
                    {canManagePlans ? <Link className="text-sm font-semibold text-primary underline" href={`/emergency-response?planId=${plan.id}`}>Edit</Link> : null}
                  </div>
                </div>
                {plan.description ? <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p> : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resolved incidents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {resolvedIncidents.length ? resolvedIncidents.map((incident) => (
              <div key={incident.id} className="rounded-md border border-border bg-background/55 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-primary">{incident.title}</h3>
                    <p className="text-xs text-muted-foreground">{formatEmergencyLabel(incident.emergencyType)} · {incident.status.toLowerCase()} · {incident.startedAt.toLocaleString()}</p>
                  </div>
                  <Badge>{incident.severity.toLowerCase()}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{incident.outcomeNotes ?? incident.summary ?? "No outcome notes recorded."}</p>
                {incident.aquariums.length ? <p className="mt-2 text-xs text-muted-foreground">Affected: {incident.aquariums.map((entry) => entry.aquarium.name).join(", ")}</p> : <p className="mt-2 text-xs text-muted-foreground">Collection-wide incident.</p>}
              </div>
            )) : <p className="text-sm text-muted-foreground">No resolved incidents yet.</p>}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function StartIncidentCard({ plans, aquariums }: { plans: Awaited<ReturnType<typeof prisma.emergencyPlan.findMany>>; aquariums: Awaited<ReturnType<typeof prisma.aquarium.findMany>> }) {
  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Siren className="h-5 w-5 text-destructive" /> Start incident</CardTitle>
        <p className="text-sm text-muted-foreground">Start from a plan or create a collection-wide incident without an aquarium.</p>
      </CardHeader>
      <CardContent>
        <form action={startEmergencyIncident} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-semibold">Plan</span>
              <Select name="emergencyPlanId">
                <option value="">No plan / custom</option>
                {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.title}</option>)}
              </Select>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-semibold">Emergency type</span>
              <Select name="emergencyType">{emergencyTypes.map((type) => <option key={type} value={type}>{formatEmergencyLabel(type)}</option>)}</Select>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-semibold">Severity</span>
              <Select name="severity" defaultValue="HIGH">{emergencySeverities.map((severity) => <option key={severity} value={severity}>{formatEmergencyLabel(severity)}</option>)}</Select>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-semibold">Started at</span>
              <Input name="startedAt" type="datetime-local" />
            </label>
          </div>
          <label className="space-y-1">
            <span className="text-sm font-semibold">Incident title</span>
            <Input name="title" placeholder="Power outage — July 4" />
          </label>
          <fieldset className="rounded-md border border-border p-3">
            <legend className="px-1 text-sm font-semibold">Affected aquariums</legend>
            <p className="mb-2 text-xs text-muted-foreground">Leave all unchecked for collection-wide emergencies.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {aquariums.map((aquarium) => (
                <label key={aquarium.id} className="flex items-center gap-2 rounded-md bg-muted/35 p-2 text-sm">
                  <input type="checkbox" name="aquariumIds" value={aquarium.id} />
                  {aquarium.name}
                </label>
              ))}
            </div>
          </fieldset>
          <Textarea name="initialNotes" placeholder="Initial observations, safety concerns, affected equipment, first actions..." />
          <Button type="submit" className="w-full">Start emergency response</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PlanEditorCard({ plan, canManagePlans }: { plan: any; canManagePlans: boolean }) {
  const textareas = plan ? planTextareas(plan) : { immediateSteps: "", stabilizationSteps: "", recoverySteps: "", verificationSteps: "" };
  if (!canManagePlans) {
    return (
      <Card>
        <CardHeader><CardTitle>Plan builder</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">Collection Owner access is required to create, edit, or archive emergency plans.</CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{plan ? "Edit emergency plan" : "Create emergency plan"}</CardTitle>
        <p className="text-xs text-muted-foreground">Step syntax: title | optional description | optional due offset minutes | alert</p>
      </CardHeader>
      <CardContent>
        <form action={saveEmergencyPlan} className="space-y-3">
          {plan ? <input type="hidden" name="id" value={plan.id} /> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Input name="title" defaultValue={plan?.title ?? ""} placeholder="Power outage plan" required />
            <Select name="emergencyType" defaultValue={plan?.emergencyType ?? "POWER_OUTAGE"}>{emergencyTypes.map((type) => <option key={type} value={type}>{formatEmergencyLabel(type)}</option>)}</Select>
            <Select name="severityDefault" defaultValue={plan?.severityDefault ?? "HIGH"}>{emergencySeverities.map((severity) => <option key={severity} value={severity}>{formatEmergencyLabel(severity)}</option>)}</Select>
            <Input name="supplies" defaultValue={Array.isArray(plan?.supplies) ? plan.supplies.join(", ") : ""} placeholder="Battery air pump, towels, spare heater" />
          </div>
          <Textarea name="description" defaultValue={plan?.description ?? ""} placeholder="When to use this plan and what it is meant to protect." />
          <PhaseTextarea label="Immediate response" name="immediateSteps" defaultValue={textareas.immediateSteps} />
          <PhaseTextarea label="Stabilization" name="stabilizationSteps" defaultValue={textareas.stabilizationSteps} />
          <PhaseTextarea label="Recovery" name="recoverySteps" defaultValue={textareas.recoverySteps} />
          <PhaseTextarea label="Verification" name="verificationSteps" defaultValue={textareas.verificationSteps} />
          <Textarea name="notes" defaultValue={plan?.notes ?? ""} placeholder="Plan notes, safety constraints, local supplies..." />
          <div className="flex flex-wrap gap-2">
            <Button type="submit">{plan ? "Save plan" : "Create plan"}</Button>
            <Link className="inline-flex min-h-10 items-center justify-center rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted/70" href="/emergency-response?createPlan=1">New blank plan</Link>
          </div>
        </form>
        {plan ? (
          <form action={archiveEmergencyPlan} className="mt-2">
            <input type="hidden" name="id" value={plan.id} />
            <Button type="submit" variant="secondary" className="w-full">Archive plan</Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PhaseTextarea({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-semibold">{label}</span>
      <Textarea name={name} defaultValue={defaultValue} className="min-h-28 font-mono text-xs" />
    </label>
  );
}

function IncidentWorkspace({ incident, aquariums }: { incident: any; aquariums: any[] }) {
  const currentPhase = incident.status === "STABILIZING" ? "STABILIZATION" : incident.status === "RECOVERING" ? "RECOVERY" : incident.status === "VERIFYING" ? "VERIFICATION" : "IMMEDIATE";
  return (
    <Card className={incident.severity === "CRITICAL" ? "border-destructive/40" : ""}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><LifeBuoy className="h-5 w-5 text-water" /> {incident.title}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatEmergencyLabel(incident.emergencyType)} · {formatEmergencyLabel(incident.status)} · started {incident.startedAt.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Affected: {incident.aquariums.length ? incident.aquariums.map((entry: any) => entry.aquarium.name).join(", ") : "Collection-wide"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className={incident.severity === "CRITICAL" ? "border-destructive/40 bg-destructive/15 text-destructive" : ""}>{incident.severity.toLowerCase()}</Badge>
            <Badge>{currentPhase.toLowerCase()}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {incident.summary ? <p className="rounded-md bg-muted/45 p-3 text-sm text-muted-foreground">{incident.summary}</p> : null}
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {emergencyPhases.map((phase) => {
              const steps = incident.steps.filter((step: any) => step.phase === phase);
              if (!steps.length) return null;
              return (
                <section key={phase} className={phase === currentPhase ? "rounded-lg border border-water/35 bg-water/10 p-3" : "rounded-lg border border-border p-3"}>
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-moss">{formatEmergencyLabel(phase)}</h3>
                  <div className="space-y-2">
                    {steps.map((step: any) => <StepRow key={step.id} step={step} />)}
                  </div>
                </section>
              );
            })}
          </div>
          <div className="space-y-4">
            <StatusForm incident={incident} />
            <LogForm incident={incident} aquariums={aquariums} />
            <EddyGuidanceForm incident={incident} />
          </div>
        </div>
        <section className="space-y-2">
          <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-moss">Incident log</h3>
          {incident.logs.length ? incident.logs.map((log: any) => (
            <div key={log.id} className="rounded-md border border-border bg-background/55 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge>{log.logType.toLowerCase()}</Badge>
                <time className="font-mono text-xs text-muted-foreground">{log.loggedAt.toLocaleString()}</time>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{log.message}</p>
              {log.aquarium ? <p className="mt-1 text-xs text-muted-foreground">Aquarium: {log.aquarium.name}</p> : null}
            </div>
          )) : <p className="text-sm text-muted-foreground">No log entries yet.</p>}
        </section>
      </CardContent>
    </Card>
  );
}

function StepRow({ step }: { step: any }) {
  return (
    <div className="rounded-md border border-border bg-background/65 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {step.status === "DONE" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : step.dueAt && step.dueAt <= new Date() ? <Bell className="h-4 w-4 text-amber-600" /> : null}
            <h4 className="font-semibold text-primary">{step.title}</h4>
          </div>
          {step.description ? <p className="mt-1 text-sm text-muted-foreground">{step.description}</p> : null}
          {step.dueAt ? <p className="mt-1 text-xs text-muted-foreground">Due {step.dueAt.toLocaleString()}</p> : null}
        </div>
        <Badge>{step.status.toLowerCase().replaceAll("_", " ")}</Badge>
      </div>
      <form action={updateEmergencyStepStatus} className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <input type="hidden" name="id" value={step.id} />
        <Input name="notes" placeholder="Step notes" defaultValue={step.notes ?? ""} />
        <Button type="submit" name="status" value="IN_PROGRESS" variant="secondary">Start</Button>
        <Button type="submit" name="status" value="DONE">Done</Button>
        <Button type="submit" name="status" value="SKIPPED" variant="secondary">Skip</Button>
      </form>
    </div>
  );
}

function StatusForm({ incident }: { incident: any }) {
  return (
    <form action={updateEmergencyIncidentStatus} className="space-y-2 rounded-md border border-border bg-background/55 p-3">
      <input type="hidden" name="id" value={incident.id} />
      <label className="space-y-1">
        <span className="text-sm font-semibold">Move phase / status</span>
        <Select name="status" defaultValue={incident.status}>{emergencyStatuses.map((status) => <option key={status} value={status}>{formatEmergencyLabel(status)}</option>)}</Select>
      </label>
      <Input name="rootCause" placeholder="Root cause, if known" defaultValue={incident.rootCause ?? ""} />
      <Textarea name="outcomeNotes" placeholder="Outcome notes for resolution" defaultValue={incident.outcomeNotes ?? ""} />
      <Button type="submit" className="w-full">Update incident</Button>
    </form>
  );
}

function LogForm({ incident, aquariums }: { incident: any; aquariums: any[] }) {
  const affected = new Set(incident.aquariums.map((entry: any) => entry.aquariumId));
  const choices = aquariums.filter((aquarium) => affected.size === 0 || affected.has(aquarium.id));
  return (
    <form action={addEmergencyLog} className="space-y-2 rounded-md border border-border bg-background/55 p-3">
      <input type="hidden" name="incidentId" value={incident.id} />
      <Select name="logType" defaultValue="NOTE">
        {["NOTE", "ACTION", "METRIC", "EQUIPMENT", "LOSS", "RECOVERY_CHECK"].map((type) => <option key={type} value={type}>{formatEmergencyLabel(type)}</option>)}
      </Select>
      <Select name="aquariumId" defaultValue="">
        <option value="">Collection-wide / no tank</option>
        {choices.map((aquarium) => <option key={aquarium.id} value={aquarium.id}>{aquarium.name}</option>)}
      </Select>
      <Textarea name="message" placeholder="Log note, action, behavior, equipment change, or recovery check..." />
      <div className="grid grid-cols-2 gap-2">
        <Input name="temperature" placeholder="Temp" />
        <Input name="ammonia" placeholder="Ammonia" />
        <Input name="nitrite" placeholder="Nitrite" />
        <Input name="nitrate" placeholder="Nitrate" />
        <Input name="ph" placeholder="pH" />
        <Input name="dissolvedOxygen" placeholder="Dissolved O₂" />
        <Input name="salinity" placeholder="Salinity" />
        <Input name="tds" placeholder="TDS" />
      </div>
      <Button type="submit" className="w-full">Add log</Button>
    </form>
  );
}

function EddyGuidanceForm({ incident }: { incident: any }) {
  return (
    <form action={createEddyEmergencyGuidance} className="space-y-2 rounded-md border border-water/30 bg-water/10 p-3">
      <input type="hidden" name="incidentId" value={incident.id} />
      <div className="text-sm font-semibold text-primary">Eddy emergency guidance</div>
      <p className="text-xs text-muted-foreground">Guarded, practical prompts only. Review before acting.</p>
      <div className="grid gap-2">
        <Button type="submit" name="mode" value="respond" variant="secondary">Help me respond</Button>
        <Button type="submit" name="mode" value="monitor" variant="secondary">What to monitor next</Button>
        <Button type="submit" name="mode" value="summary" variant="secondary">Summarize incident</Button>
      </div>
    </form>
  );
}
