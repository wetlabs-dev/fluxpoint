import { NextResponse } from "next/server";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { runAquariumParameterAdvisor } from "@/domains/aquariums/parameter-advisor";
import { EddyFeatureDisabledError, EddyRateLimitError } from "@/domains/eddy/rate-limits";

export async function POST(request: Request) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  try {
    const body = await request.json().catch(() => ({}));
    const aquariumId = String(body.aquariumId || "");
    if (!aquariumId) return NextResponse.json({ error: "Choose an aquarium to review." }, { status: 400 });
    return NextResponse.json(await runAquariumParameterAdvisor({ aquariumId, userId: user.id, collectionId: collection.id }));
  } catch (error) {
    const status = error instanceof EddyRateLimitError ? 429 : error instanceof EddyFeatureDisabledError ? 403 : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Eddy could not review these parameters.", ...((error instanceof EddyRateLimitError || error instanceof EddyFeatureDisabledError) ? { rateLimit: error.usage } : {}) }, { status });
  }
}
