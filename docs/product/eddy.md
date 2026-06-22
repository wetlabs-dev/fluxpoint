# Eddy

## Condition reviews

Condition detail pages provide a rate-limited Eddy review. The request contains only the condition, recent observations, open follow-ups, aquarium context, and user-entered medication context. The Responses API uses strict JSON Schema output for a summary, observation checklist, causes to investigate, follow-up cadence, and safety note. Mock-provider mode returns the same shape without claiming external research.

Eddy must not diagnose, prescribe, or claim certainty. It respects medication labels and doses exactly as entered, recommends professional help for severe distress, rapid losses, or breathing difficulty, and reinforces that aquarium organisms must never be released into the wild. Every request creates an AI request log and condition-scoped audit event and consumes the `CONDITION_REVIEW` rate limit.

Eddy is Fluxpoint's structured aquarium assistant, not a general chatbot. Each entry point launches a focused tool that is tied to the current aquarium, species, collection care queue, or tank identity workflow.

Supported tools include tank summaries, compatibility checks, stocking suggestions, care recommendations and digests, name and cover concepts, moderated cover image generation, troubleshooting questions, husbandry drafts, Species Magic Fill, and species care summaries.

Species Magic Fill produces a structured draft of canonical names, aquarium care ranges, and useful aliases. The keeper reviews confidence, warnings, and each proposed value before applying it to the form; applying a draft never saves the species automatically.

Eddy uses the canonical inline icon for compact controls. Larger assistant callouts use the full character artwork, with the left or right version chosen so Eddy faces inward toward the content.

All tools require authentication and collection-scoped authorization. Results remain advisory: missing records are called out, disease is not presented as definitively diagnosed, and medication guidance reminds keepers to verify the product label and observe livestock carefully.
