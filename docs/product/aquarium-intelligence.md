# Aquarium Intelligence

Aquarium Intelligence turns saved tank records into durable, explainable analysis. It is deterministic first: health assessment, parameter drift, stability, and timeline insights are calculated locally from Fluxpoint records and remain usable when Eddy/OpenAI is unavailable.

## Health state and confidence

Health assessments use qualitative states: Excellent, Good, Needs watching, Concerning, Critical, or Not enough data. Fluxpoint may store an internal score for sorting and trend comparison, but it is not presented as a scientific percentage. Confidence is separate from health state. Sparse records lower confidence instead of implying that the tank is healthy.

Each assessment covers water quality, Stocking Pressure, maintenance, workflows, sensor stability, conditions, and mortality/loss context. Each domain stores evidence, favorable factors, attention factors, missing data, and recommended review items.

## Parameter drift and instability

Parameter analyses use saved water readings, source type, aquarium targets, water-change markers, minimum observation counts, and minimum time spans. They calculate latest value, baseline, mean, median, min/max, standard deviation, slope, relative change, threshold crossings, trend state, stability state, concern state, and an interpretation.

Fluxpoint does not treat two readings over one day as a long-term trend. Impossible readings are excluded from analysis evidence, and weak/sparse data returns insufficient rather than false certainty.

## Timeline insights

Timeline intelligence normalizes aquarium events, conditions, workflows, water changes, losses, and other tank records into reviewable temporal context. Insights use cautious language such as occurred before, coincided with, may be related, and worth reviewing. Temporal association is not proof of cause.

Insights can be dismissed. Historical assessments, analyses, and insights are preserved by input fingerprint and engine version so future logic changes do not erase earlier context.

## Refresh and worker behavior

Assessments do not recalculate on every page render. Keepers can manually refresh from the aquarium Overview or Intelligence tab. The `worker:intelligence` command refreshes stale active aquariums in the background and records worker status in `ServerWorkerRun`.

Fingerprints prevent duplicate saved assessments, analyses, and timeline insights when relevant inputs have not changed.

## Eddy boundary

Eddy may explain deterministic results and help investigate supplied evidence. Eddy must not invent health states, measurements, correlations, or causal claims. Any AI explanation should cite supplied dates and records, mention missing data, and keep disease or medication language cautious.

## Privacy

Aquarium Intelligence is private by default. Current health, conditions, mortality context, and timeline insights are not exposed on public browse pages.
