import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { isServerAdmin } from "@/domains/auth/permissions";
import { cancelPendingAiJob, retryAiJob } from "@/domains/ai-jobs/queue";
import { serializeUserAiJob } from "@/domains/ai-jobs/serializers";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(); const { id } = await params;
  const job = await prisma.aiJob.findFirst({ where: { id, OR: [{ userId: user.id }, ...(await isServerAdmin(user.id) ? [{}] : [])] } });
  if (!job) return NextResponse.json({ error: "AI job not found." }, { status: 404 });
  return NextResponse.json({ job: serializeUserAiJob(job) });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(); const { id } = await params; const body = await request.json().catch(() => ({}));
  const admin = await isServerAdmin(user.id);
  const job = await prisma.aiJob.findFirst({ where: { id, ...(admin ? {} : { userId: user.id }) } });
  if (!job) return NextResponse.json({ error: "AI job not found." }, { status: 404 });
  if (body.action === "cancel") await cancelPendingAiJob(id, user.id, admin);
  else if (body.action === "retry" && (admin || job.userId === user.id)) await retryAiJob(id);
  else return NextResponse.json({ error: "Unsupported AI job action." }, { status: 400 });
  const updated = await prisma.aiJob.findUniqueOrThrow({ where: { id } });
  return NextResponse.json({ job: serializeUserAiJob(updated) });
}
