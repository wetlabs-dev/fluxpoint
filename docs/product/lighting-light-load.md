# Estimated Daily Light Load

Estimated Daily Light Load is Fluxpoint's comparative estimate of a fixture's integrated output across one schedule day. It combines an owned light's optional maximum lumen rating with the schedule's channel intensity, ramps, and plateaus. The result is shown in lumen-hours and may be shortened to Light Load in compact UI.

It is not PAR. Fluxpoint does not estimate light at the substrate or compensate for tank depth, light height, beam spread, lids, spectrum-to-PAR conversion, plant shading, water clarity, or attenuation.

## Required inputs

- A light equipment record with `maxLumens` for an absolute lumen-hour estimate.
- A compatible assigned lighting schedule with valid time points.
- A capability profile describing the fixture's channels.

Schedules without fixture lumens still show equivalent full-output hours, which is the integrated normalized intensity over 24 hours. For example, eight hours at 50% equals four equivalent full-output hours.

## Formula

For each schedule interval Fluxpoint integrates plateau area plus linear-ramp area:

- plateau: `intensity × duration hours`
- ramp: `average(start intensity, end intensity) × duration hours`
- estimated daily light load: `equivalent full-output hours × max lumens`

`rampMinutes` belongs to the destination point in the existing Fluxpoint schedule model. The transition ends at that point's time; the preceding output remains on a plateau until the ramp begins. Intervals wrap across midnight, including the last point to the first point on the following day.

On/off uses zero or full output. Dimmable uses its single channel. RGB, RGBW, and custom percent-channel profiles use the average normalized percentage across their luminous channels; RGBW includes white as a normal luminous channel. The schedule graph uses this same helper, keeping its vertical position consistent with the estimate.

## Multiple lights and comparison

Aquarium totals sum only assigned lights with both a schedule and maximum lumens. Incomplete lights remain visible with a reason and are excluded from the total. Schedule editing compares previous and new equivalent full-output hours. Assignment changes compare current and proposed lumen-hours when fixture lumens are available.

Use the estimate to compare schedules or detect meaningful changes in relative daily light pressure. Do not treat the displayed precision as a care prescription or physical measurement.
