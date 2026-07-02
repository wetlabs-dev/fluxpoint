export const DEFAULT_TIME_ZONE = "America/New_York";

export const commonTimeZones = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "UTC"
] as const;

export function normalizeTimeZone(value?: string | null) {
  const candidate = value || DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format();
    return candidate;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

export function userTimeZone(user: { timezone?: string | null }) {
  return normalizeTimeZone(user.timezone);
}

export function formatDateInTimeZone(value: Date | string | number | null | undefined, timeZone = DEFAULT_TIME_ZONE) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone: normalizeTimeZone(timeZone), month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export function formatShortDateInTimeZone(value: Date | string | number | null | undefined, timeZone = DEFAULT_TIME_ZONE) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone: normalizeTimeZone(timeZone), month: "short", day: "numeric" }).format(new Date(value));
}

export function formatDateTimeInTimeZone(value: Date | string | number | null | undefined, timeZone = DEFAULT_TIME_ZONE) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone: normalizeTimeZone(timeZone), month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function formatShortDateTimeInTimeZone(value: Date | string | number | null | undefined, timeZone = DEFAULT_TIME_ZONE) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone: normalizeTimeZone(timeZone), month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function formatDateTimeLocalInput(value: Date | string | number | null | undefined, timeZone = DEFAULT_TIME_ZONE) {
  if (!value) return "";
  const date = new Date(value);
  const parts = partsInTimeZone(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function formatDateInput(value: Date | string | number | null | undefined, timeZone = DEFAULT_TIME_ZONE) {
  if (!value) return "";
  const parts = partsInTimeZone(new Date(value), timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function parseDateTimeInTimeZone(value: string | null | undefined, timeZone = DEFAULT_TIME_ZONE) {
  const input = value?.trim();
  if (!input) return null;
  if (/[zZ]|[+-]\d\d:?\d\d$/.test(input)) {
    const date = new Date(input);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const match = input.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) {
    const date = new Date(input);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const [, year, month, day, hour = "00", minute = "00", second = "00"] = match;
  const utcWallTime = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  let instant = new Date(utcWallTime - offsetMsAt(new Date(utcWallTime), timeZone));
  const refined = new Date(utcWallTime - offsetMsAt(instant, timeZone));
  if (!Number.isNaN(refined.getTime())) instant = refined;
  return instant;
}

function partsInTimeZone(date: Date, timeZone = DEFAULT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: normalizeTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "00";
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

function offsetMsAt(date: Date, timeZone = DEFAULT_TIME_ZONE) {
  const parts = partsInTimeZone(date, timeZone);
  const localAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return localAsUtc - date.getTime();
}
