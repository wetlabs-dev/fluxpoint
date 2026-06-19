import { NextResponse } from "next/server";
import { eddyActions, type EddyAction } from "@/domains/eddy/eddy-types";
import { runEddyRequest } from "@/domains/eddy/eddy-service";
import { getUserCollection, requireUser } from "@/lib/auth/session";

export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const { action } = await params;
  if (!eddyActions.includes(action as EddyAction)) return NextResponse.json({ error: "Unknown Eddy request." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  try {
    const result = await runEddyRequest({ action: action as EddyAction, userId: user.id, collectionId: collection.id, aquariumId: body.aquariumId ? String(body.aquariumId) : null, speciesDefinitionId: body.speciesDefinitionId ? String(body.speciesDefinitionId) : null, page: body.page ? String(body.page) : undefined, input: body.input && typeof body.input === "object" ? body.input : {} });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Eddy could not complete that request." }, { status: 500 });
  }
}
