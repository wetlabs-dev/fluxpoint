import { NextResponse } from "next/server";
import { eddyActions, type EddyAction } from "@/domains/eddy/eddy-types";
import { EddyValidationError, runEddyRequest } from "@/domains/eddy/eddy-service";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { EddyFeatureDisabledError, EddyRateLimitError, getRemainingEddyUsage } from "@/domains/eddy/rate-limits";
import { assertCanQueueAquariumCover } from "@/domains/ai-jobs/permissions";
import { coverJobIdempotencyKey, enqueueAiJob } from "@/domains/ai-jobs/queue";
import { serializeUserAiJob } from "@/domains/ai-jobs/serializers";

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
      const input = body.input && typeof body.input === "object" ? body.input as Record<string, unknown> : {};
      const tags = Array.isArray(input.selectedConceptTags) ? input.selectedConceptTags.map(String).slice(0, 8) : [];
      const payload = {
        aquariumId,
        selectedConceptId: typeof input.selectedConceptId === "string" ? input.selectedConceptId : null,
        selectedConceptTitle: typeof input.selectedConceptTitle === "string" ? input.selectedConceptTitle : null,
        selectedConceptDescription: typeof input.selectedConceptDescription === "string" ? input.selectedConceptDescription : null,
        selectedConceptPrompt: typeof input.selectedConceptPrompt === "string" ? input.selectedConceptPrompt : null,
        selectedConceptTags: tags,
        customPrompt: typeof input.customPrompt === "string" ? input.customPrompt : null,
        expectedCoverMediaAssetId: (await assertCanQueueAquariumCover(user.id, collection.id, aquariumId)).coverMediaAssetId,
        setAsCover: true
      };
      const job = await enqueueAiJob({ collectionId: collection.id, userId: user.id, jobType: "AQUARIUM_COVER_IMAGE_GENERATION", payload, idempotencyKey: coverJobIdempotencyKey(collection.id, aquariumId, payload) });
      const usage = await getRemainingEddyUsage({ userId: user.id, collectionId: collection.id, featureKey: "COVER_IMAGE_GENERATION" });
      return NextResponse.json({ job: serializeUserAiJob(job), usage }, { status: 202 });
    }
    const result = await runEddyRequest({ action: action as EddyAction, userId: user.id, collectionId: collection.id, aquariumId: body.aquariumId ? String(body.aquariumId) : null, speciesDefinitionId: body.speciesDefinitionId ? String(body.speciesDefinitionId) : null, page: body.page ? String(body.page) : undefined, input: body.input && typeof body.input === "object" ? body.input : {} });
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof EddyRateLimitError ? 429 : error instanceof EddyFeatureDisabledError ? 403 : error instanceof EddyValidationError ? 400 : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Eddy could not complete that request.", ...((error instanceof EddyRateLimitError || error instanceof EddyFeatureDisabledError) ? { rateLimit: error.usage } : {}) }, { status });
  }
}
