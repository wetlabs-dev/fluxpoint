"use server";
import { revalidatePath } from "next/cache";
import { requireServerAdmin } from "@/domains/auth/permissions";
import { cancelPendingAiJob, retryAiJob } from "@/domains/ai-jobs/queue";
export async function adminRetryAiJob(formData: FormData) { await requireServerAdmin(); await retryAiJob(String(formData.get("id"))); revalidatePath("/server-maintenance/ai-jobs"); }
export async function adminCancelAiJob(formData: FormData) { const user = await requireServerAdmin(); await cancelPendingAiJob(String(formData.get("id")), user.id, true); revalidatePath("/server-maintenance/ai-jobs"); }
