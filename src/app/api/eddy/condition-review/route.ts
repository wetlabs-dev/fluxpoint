import { NextResponse } from "next/server";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { reviewConditionWithEddy } from "@/domains/conditions/eddy-condition";
import { EddyFeatureDisabledError, EddyRateLimitError } from "@/domains/eddy/rate-limits";

export async function POST(request: Request) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const body = await request.json().catch(() => ({}));
  try {
    const conditionId = String(body.conditionId || "");
    if (!conditionId) return NextResponse.json({ error: "Choose a condition." }, { status: 400 });
    return NextResponse.json(await reviewConditionWithEddy({ conditionId, userId: user.id, collectionId: collection.id }));
  } catch (error) {
    const status = error instanceof EddyRateLimitError ? 429 : error instanceof EddyFeatureDisabledError ? 403 : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Eddy could not review this condition." }, { status });
  }
}
