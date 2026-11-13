import { isUtcTimestamp } from "./work-session.js";

const KINDS = new Set(["timer_interval", "manual_interval", "manual_duration"]);
const STATUSES = new Set(["open", "confirmed", "rejected"]);
const SOURCES = new Set(["timer", "manual"]);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function isValidIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function isValidTimeZoneId(value) {
  if (!isNonEmptyString(value)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function validateExactInterval(entry) {
  if (!isUtcTimestamp(entry.startedAt)) {
    throw new TypeError("Exact TimeEntry startedAt must be a canonical UTC timestamp.");
  }
  if (entry.kind === "timer_interval" &&
      entry.status === "open" && entry.endedAt !== null) {
    throw new TypeError("An open timer interval must not have endedAt.");
  }
  if (entry.status === "confirmed" && !isUtcTimestamp(entry.endedAt)) {
    throw new TypeError("A confirmed exact TimeEntry requires a canonical UTC endedAt.");
  }
  if (entry.endedAt !== null && !isUtcTimestamp(entry.endedAt)) {
    throw new TypeError("TimeEntry endedAt must be a canonical UTC timestamp or null.");
  }
  if (entry.endedAt !== null && Date.parse(entry.endedAt) <= Date.parse(entry.startedAt)) {
    throw new TypeError("TimeEntry endedAt must be after startedAt.");
  }
  if (entry.durationSeconds !== null || entry.occurredOn !== null) {
    throw new TypeError("Exact TimeEntry cannot contain manual-duration fields.");
  }
}

export function validateTimeEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new TypeError("TimeEntry must be an object.");
  }
  if (!isNonEmptyString(entry.id) || !isNonEmptyString(entry.workSessionId)) {
    throw new TypeError("TimeEntry id and workSessionId must be non-empty strings.");
  }
  if (!KINDS.has(entry.kind)) {
    throw new TypeError("TimeEntry kind is invalid.");
  }
  if (!STATUSES.has(entry.status)) {
    throw new TypeError("TimeEntry status is invalid.");
  }
  if (!SOURCES.has(entry.source)) {
    throw new TypeError("TimeEntry source is invalid.");
  }
  if (!isValidTimeZoneId(entry.timeZoneId)) {
    throw new TypeError("TimeEntry timeZoneId must be a valid IANA time zone.");
  }
  if (!isUtcTimestamp(entry.createdAt) || !isUtcTimestamp(entry.updatedAt)) {
    throw new TypeError("TimeEntry createdAt and updatedAt must be canonical UTC timestamps.");
  }
  if (entry.note !== null && typeof entry.note !== "string") {
    throw new TypeError("TimeEntry note must be a string or null.");
  }

  if (entry.kind === "manual_duration") {
    if (entry.source !== "manual" || entry.status !== "confirmed") {
      throw new TypeError("Manual-duration entries must be confirmed and have manual source.");
    }
    if (!Number.isInteger(entry.durationSeconds) || entry.durationSeconds <= 0) {
      throw new TypeError("Manual-duration durationSeconds must be a positive integer.");
    }
    if (entry.startedAt !== null || entry.endedAt !== null) {
      throw new TypeError("Manual-duration entries cannot have exact timestamps.");
    }
    if (entry.occurredOn !== null && !isValidIsoDate(entry.occurredOn)) {
      throw new TypeError("Manual-duration occurredOn must be a valid ISO date or null.");
    }
  } else {
    if (entry.kind === "timer_interval" && entry.source !== "timer") {
      throw new TypeError("Timer intervals must have timer source.");
    }
    if (entry.kind === "manual_interval" &&
        (entry.source !== "manual" || entry.status !== "confirmed")) {
      throw new TypeError("Manual intervals must be confirmed and have manual source.");
    }
    validateExactInterval(entry);
  }

  return entry;
}

export function createTimeEntry(input, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("TimeEntry input must be an object.");
  }
  const now = options.now ?? new Date().toISOString();
  const entry = {
    id: input.id ?? options.id,
    workSessionId: input.workSessionId,
    kind: input.kind,
    startedAt: input.startedAt ?? null,
    endedAt: input.endedAt ?? null,
    durationSeconds: input.durationSeconds ?? null,
    occurredOn: input.occurredOn ?? null,
    timeZoneId: input.timeZoneId,
    status: input.status ?? (input.kind === "timer_interval" && input.endedAt == null
      ? "open"
      : "confirmed"),
    source: input.source ?? (input.kind === "timer_interval" ? "timer" : "manual"),
    note: input.note ?? null,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now
  };

  return validateTimeEntry(entry);
}

export function getExactDurationSeconds(entry) {
  validateTimeEntry(entry);
  if (entry.kind === "manual_duration" || entry.status !== "confirmed") return 0;
  return (Date.parse(entry.endedAt) - Date.parse(entry.startedAt)) / 1000;
}

export function intervalsOverlap(first, second) {
  validateTimeEntry(first);
  validateTimeEntry(second);
  if (first.kind === "manual_duration" || second.kind === "manual_duration") return false;
  if (first.status === "rejected" || second.status === "rejected") return false;

  const firstEnd = first.endedAt === null ? Number.POSITIVE_INFINITY : Date.parse(first.endedAt);
  const secondEnd = second.endedAt === null ? Number.POSITIVE_INFINITY : Date.parse(second.endedAt);
  return Date.parse(first.startedAt) < secondEnd &&
    Date.parse(second.startedAt) < firstEnd;
}

export function findTimeEntryOverlap(candidate, entries) {
  validateTimeEntry(candidate);
  if (!Array.isArray(entries)) {
    throw new TypeError("TimeEntry collection must be an array.");
  }
  return entries.find((entry) => entry.id !== candidate.id &&
    intervalsOverlap(candidate, entry)) ?? null;
}

export function summarizeTimeEntries(entries) {
  if (!Array.isArray(entries)) {
    throw new TypeError("TimeEntry collection must be an array.");
  }
  let exactDurationSeconds = 0;
  let manualDurationSeconds = 0;

  for (const entry of entries) {
    validateTimeEntry(entry);
    if (entry.kind === "manual_duration") {
      if (entry.status === "confirmed") manualDurationSeconds += entry.durationSeconds;
    } else {
      exactDurationSeconds += getExactDurationSeconds(entry);
    }
  }

  return { exactDurationSeconds, manualDurationSeconds };
}

export const timeEntryModelOptions = Object.freeze({
  kinds: [...KINDS],
  statuses: [...STATUSES],
  sources: [...SOURCES]
});
