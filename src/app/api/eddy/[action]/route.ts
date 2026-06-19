import { NextResponse } from "next/server";
import { eddyActions, type EddyAction } from "@/domains/eddy/eddy-types";
import { EddyValidationError, runEddyRequest } from "@/domains/eddy/eddy-service";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { generateAiCoverImageForAquarium } from "@/domains/aquariums/actions";
import { EddyFeatureDisabledError, EddyRateLimitError, getRemainingEddyUsage } from "@/domains/eddy/rate-limits";

export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const { action } = await params;
  if (!eddyActions.includes(action as EddyAction)) return NextResponse.json({ error: "Unknown Eddy request." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  try {
    if (action === "cover-image-generation") {
      const aquariumId = String(body.aquariumId || "");
      if (!aquariumId) throw new EddyValidationError("Choose an aquarium before generating a cover image.");
      const cover = await generateAiCoverImageForAquarium(aquariumId);
      const usage = await getRemainingEddyUsage({ userId: user.id, collectionId: collection.id, featureKey: "COVER_IMAGE_GENERATION" });
      return NextResponse.json({ cover, usage });
    }
    const result = await runEddyRequest({ action: action as EddyAction, userId: user.id, collectionId: collection.id, aquariumId: body.aquariumId ? String(body.aquariumId) : null, speciesDefinitionId: body.speciesDefinitionId ? String(body.speciesDefinitionId) : null, page: body.page ? String(body.page) : undefined, input: body.input && typeof body.input === "object" ? body.input : {} });
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof EddyRateLimitError ? 429 : error instanceof EddyFeatureDisabledError ? 403 : error instanceof EddyValidationError ? 400 : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Eddy could not complete that request.", ...((error instanceof EddyRateLimitError || error instanceof EddyFeatureDisabledError) ? { rateLimit: error.usage } : {}) }, { status });
  }
}
