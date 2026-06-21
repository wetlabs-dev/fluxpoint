import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { EddyFeatureDisabledError, EddyRateLimitError } from "@/domains/eddy/rate-limits";
import { runSpeciesMagicFill } from "@/domains/species/species-magic-fill";

export async function POST(request: Request) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  try {
    const body = await request.json();
    const result = await runSpeciesMagicFill({
      userId: user.id,
      collectionId: collection.id,
      speciesDefinitionId: body?.speciesDefinitionId ? String(body.speciesDefinitionId) : null,
      input: body?.input ?? {}
    });
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof EddyRateLimitError ? 429 : error instanceof EddyFeatureDisabledError ? 403 : error instanceof ZodError ? 400 : 500;
    const message = error instanceof ZodError ? "Review the species fields and try again." : error instanceof Error ? error.message : "Eddy could not prepare a species draft.";
    return NextResponse.json({ error: message, ...((error instanceof EddyRateLimitError || error instanceof EddyFeatureDisabledError) ? { rateLimit: error.usage } : {}) }, { status });
  }
}
