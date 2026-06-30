# Estimated Daily Light Load

Estimated Daily Light Load is Fluxpoint's comparative estimate of a fixture's integrated output across one schedule day. It combines each owned light's output estimate with its independent schedule intensity, ramps, plateaus, and final-to-first overnight segment. The result is shown in lumen-hours and may be shortened to Light Load in compact UI.

It is not PAR. Fluxpoint does not estimate light at the substrate or compensate for tank depth, light height, beam spread, lids, spectrum-to-PAR conversion, plant shading, water clarity, or attenuation.

## Required inputs

- Prefer a light equipment record with `maxLumens` for the highest-confidence estimate.
- If lumens are unavailable, record wattage. Fluxpoint uses the optional fixture efficacy or a conservative capability fallback (50 lm/W for basic on/off/unknown fixtures, 70 lm/W for controllable aquarium fixtures).
- A compatible assigned lighting schedule with valid time points.
- A capability profile describing the fixture's channels.

Schedules without fixture lumens still show equivalent full-output hours, which is the integrated normalized intensity over 24 hours. For example, eight hours at 50% equals four equivalent full-output hours.

## Formula

For each schedule interval Fluxpoint integrates plateau area plus linear-ramp area across the full 24-hour loop:

- plateau: `intensity × duration hours`
- ramp: `average(start intensity, end intensity) × duration hours`
- rated-lumen method: `equivalent full-output hours × max lumens`
- wattage fallback: `equivalent full-output hours × wattage × efficacy lumens per watt`

`rampMinutes` is a schedule-level value. The same ramp duration is applied to every transition; the preceding output remains on a plateau until the ramp begins, and the ramp ends at the next set point. Intervals wrap across midnight, including the last point to the first point on the following day.

On/off uses zero or full output. Dimmable uses its single channel. RGB, RGBW, and custom percent-channel profiles use the average normalized percentage across their luminous channels; RGBW includes white as a normal luminous channel. The schedule graph uses this same helper for vertical position, and its horizontal gradient is generated from sampled/interpolated channel values so zero-output spans render visually off.

## Multiple lights and comparison

Aquarium totals calculate every enabled fixture independently and sum eligible contributions. Lights with no schedule, no lumens or wattage, or a disabled assignment remain visible with an exclusion reason. Rated lumens are marked high confidence. Wattage with a keeper-supplied efficacy is medium confidence; wattage using Fluxpoint's conservative fallback is low confidence and always labeled “estimated from wattage.” Schedule editing compares previous and new equivalent full-output hours, while assignment changes compare current and proposed lumen-hours when an output estimate is available.

Use the estimate to compare schedules or detect meaningful changes in relative daily light pressure. Do not treat the displayed precision as a care prescription or physical measurement.
