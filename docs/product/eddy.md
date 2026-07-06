# Eddy

## Condition reviews

Condition detail pages provide a rate-limited Eddy review. The request contains only the condition, recent observations, open follow-ups, aquarium context, and user-entered medication context. The Responses API uses strict JSON Schema output for a summary, observation checklist, causes to investigate, follow-up cadence, and safety note. Mock-provider mode returns the same shape without claiming external research.

Eddy must not diagnose, prescribe, or claim certainty. It respects medication labels and doses exactly as entered, recommends professional help for severe distress, rapid losses, or breathing difficulty, and reinforces that aquarium organisms must never be released into the wild. Every request creates an AI request log and condition-scoped audit event and consumes the `CONDITION_REVIEW` rate limit.

Eddy is Fluxpoint's structured aquarium assistant, not a general chatbot. Each entry point launches a focused tool that is tied to the current aquarium, species, collection care queue, or tank identity workflow.

Supported tools include tank summaries, compatibility checks, stocking suggestions, care recommendations and digests, name and cover concepts, moderated cover image generation, troubleshooting questions, husbandry drafts, Species Magic Fill, and species care summaries.

Concise tank summaries are deterministic and available without AI. They can be copied into an Eddy prompt or future polishing workflow, but the saved-record summary remains the source of truth and Eddy should not invent missing tank data.

Eddy name ideas are suggestions for the aquarium’s canonical Display name. When a keeper chooses **Use as display name**, Fluxpoint requires confirmation before replacing an existing non-empty tank name, writes the accepted value to `Aquarium.name`, and audits the rename as an Eddy name-suggestion action. There is no separate Generated Name field in the aquarium UI.

## Aquarium cover concepts and image generation

On aquarium detail pages, Eddy Studio can draft selectable cover concepts before generating a cover image. A concept includes a title, short description, mood/style tags, palette notes, composition notes, cautions, and a generation prompt. The keeper can select one concept or enter a custom prompt override. If the custom prompt is filled, it replaces the selected concept as the image direction.

Cover image generation uses the dedicated cover-image workflow rather than the normal Eddy Responses flow. The server validates the authenticated user, collection role, aquarium access, feature availability, rate limit, text moderation, image provider call, file storage, generated-image moderation, and aquarium cover assignment. In OpenAI mode this calls the Images API using `OPENAI_IMAGE_MODEL` or the default image model fallback, and logs the call as image-specific. In mock mode it creates a local generated PNG so the workflow can still be tested without OpenAI.

Successful generations are stored under Fluxpoint uploads, converted into an approved `MediaAsset`, and assigned to the aquarium through `coverMediaAssetId` plus `coverImageUrl`. This makes the cover visible in the aquarium header immediately after refresh and persistent after reload. Failed preflight checks, moderation failures, rate limits, provider errors, and storage/assignment failures are surfaced to the UI without exposing secrets.

Stocking Pressure is a separate, manual aquarium estimate based on saved volume, active livestock, plants, and attached filtration. It saves qualitative history, confidence, concise flags, and reasoning without exposing percentages or claiming an exact carrying capacity. A fingerprint marks the latest estimate stale when relevant tank inputs change; Eddy never refreshes it automatically. General aquarium Eddy context receives the latest saved level and whether it is current.

Species Magic Fill produces a structured draft of the complete supported species definition: canonical taxonomy and author citation, verified exact-taxon reference links, aliases, salinity and habitat inputs, species-level TDS, aquarium care ranges, flow requirement, and locality-aware regional context. Unknown or unverifiable fields remain blank rather than being invented. The keeper reviews confidence, category-mismatch warnings, and each proposed value before applying it to the form; applying a draft never saves the species automatically.

Husbandry Magic Fill drafts guide-only fields such as diet, behavior, health, breeding, aquascape needs, and plant compatibility. It does not return TDS range or current preference because TDS and flow requirement live on the Species Definition.

Eddy uses the canonical inline icon for compact controls. Larger assistant callouts use the full character artwork, with the left or right version chosen so Eddy faces inward toward the content.

All tools require authentication and collection-scoped authorization. Results remain advisory: missing records are called out, disease is not presented as definitively diagnosed, and medication guidance reminds keepers to verify the product label and observe livestock carefully.

## Emergency response

Eddy can add guarded emergency guidance to active Emergency Response incidents:

- Help me respond
- What should I monitor next?
- Summarize incident

Emergency guidance is logged for review. It should not be treated as veterinary certainty, should not override saved plans automatically, and must not suggest unsafe electrical behavior around water.

## Remembered tank contents

Aquariums can carry additional content rows that are deliberately not full Inventory. Eddy includes enabled rows in aquarium context for tank summaries, compatibility checks, stocking suggestions, care recommendations, troubleshooting, cover concepts, and cover image prompts.

Eddy aquarium context also includes structured water-source and water-recipe data when configured. Saved recipe additive doses are treated as authoritative context; Eddy should not invent alternative dosing when a recipe exists unless the keeper explicitly asks to design or revise a recipe.

These rows are always treated as soft context. A row like “unknown small fish, rough count” should increase uncertainty rather than become a precise stocking input. Plant rows can nudge Eddy toward planted-tank language and modest nutrient-support caveats. Hardscape rows can shape cover, territory, line-of-sight, and cover-art prompts. Eddy must not auto-create inventory or silently treat these rows as structured species records.
