import { redirect } from "next/navigation";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { getCurrentOrInitialPlan } from "@/domains/aquarium-plans/queries";

export const dynamic = "force-dynamic";

export default async function AquariumCurrentPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const { id } = await params;
  const plan = await getCurrentOrInitialPlan(id, collection.id, user.id);
  if (!plan) redirect(`/aquariums/${id}`);
  redirect(`/aquariums/${id}/plans/${plan.id}`);
}
