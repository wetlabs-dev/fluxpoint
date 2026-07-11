"use server";
import { revalidatePath } from "next/cache";
import { requireServerAdmin } from "@/domains/auth/permissions";
import { cancelPendingAiJob, changePendingAiJobPriority, retryAiJob } from "@/domains/ai-jobs/queue";
import { parseAiJobPriority } from "@/domains/ai-jobs/priorities";
export async function adminRetryAiJob(formData: FormData) { const user = await requireServerAdmin(); await retryAiJob(String(formData.get("id")), true, user.id); revalidatePath("/server-maintenance/ai-jobs"); }
export async function adminCancelAiJob(formData: FormData) { const user = await requireServerAdmin(); await cancelPendingAiJob(String(formData.get("id")), user.id, true); revalidatePath("/server-maintenance/ai-jobs"); }
export async function adminChangeAiJobPriority(formData: FormData) { const user = await requireServerAdmin(); const priority = parseAiJobPriority(formData.get("priority")); if (priority !== null) await changePendingAiJobPriority(String(formData.get("id")), priority, user.id); revalidatePath("/server-maintenance/ai-jobs"); }
