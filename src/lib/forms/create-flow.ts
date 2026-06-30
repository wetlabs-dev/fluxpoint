import "server-only";

import { redirect } from "next/navigation";
import { setFormFlash } from "@/lib/forms/form-flash";
import { createAndAddAnotherIntentValue, createIntentName, createIntentValue } from "@/lib/forms/create-flow-constants";

export function wantsCreateAndAddAnother(formData: FormData) {
  return String(formData.get(createIntentName) || createIntentValue) === createAndAddAnotherIntentValue;
}

export async function finishCreateFlow(formData: FormData, options: { detailUrl?: string | null; addAnotherUrl: string; createdMessage: string; addAnotherMessage?: string }) {
  const addAnother = wantsCreateAndAddAnother(formData);
  await setFormFlash(addAnother ? options.addAnotherMessage ?? `${options.createdMessage} Ready for another.` : options.createdMessage);
  redirect(addAnother ? options.addAnotherUrl : options.detailUrl ?? options.addAnotherUrl);
}
