const STATUSES = new Set(["planned", "in_progress", "completed", "cancelled"]);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

export function isUtcTimestamp(value) {
  if (typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return false;
  }

  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

export function validateWorkSession(session) {
  if (!session || typeof session !== "object" || Array.isArray(session)) {
    throw new TypeError("WorkSession must be an object.");
  }
  if (!isNonEmptyString(session.id)) {
    throw new TypeError("WorkSession id must be a non-empty string.");
  }
  if (!isNonEmptyString(session.taskId)) {
    throw new TypeError("WorkSession taskId must be a non-empty string.");
  }
  if (!STATUSES.has(session.status)) {
    throw new TypeError("WorkSession status is invalid.");
  }
  if (session.plannedDurationSeconds !== null &&
      (!Number.isInteger(session.plannedDurationSeconds) ||
       session.plannedDurationSeconds <= 0)) {
    throw new TypeError("WorkSession plannedDurationSeconds must be a positive integer or null.");
  }

  for (const field of ["startedAt", "completedAt", "cancelledAt"]) {
    if (session[field] !== null && !isUtcTimestamp(session[field])) {
      throw new TypeError(`WorkSession ${field} must be a canonical UTC timestamp or null.`);
    }
  }
  if (!isUtcTimestamp(session.createdAt) || !isUtcTimestamp(session.updatedAt)) {
    throw new TypeError("WorkSession createdAt and updatedAt must be canonical UTC timestamps.");
  }
  if (!Number.isInteger(session.version) || session.version < 1) {
    throw new TypeError("WorkSession version must be a positive integer.");
  }

  const { status, startedAt, completedAt, cancelledAt } = session;
  if (status === "planned" &&
      (startedAt !== null || completedAt !== null || cancelledAt !== null)) {
    throw new TypeError("A planned WorkSession cannot have lifecycle timestamps.");
  }
  if (status === "in_progress" &&
      (startedAt === null || completedAt !== null || cancelledAt !== null)) {
    throw new TypeError("An in-progress WorkSession requires startedAt and no end timestamp.");
  }
  if (status === "completed" &&
      (startedAt === null || completedAt === null || cancelledAt !== null)) {
    throw new TypeError("A completed WorkSession requires startedAt and completedAt only.");
  }
  if (status === "cancelled" && completedAt !== null) {
    throw new TypeError("A cancelled WorkSession cannot have completedAt.");
  }
  if (startedAt !== null && completedAt !== null &&
      Date.parse(completedAt) < Date.parse(startedAt)) {
    throw new TypeError("WorkSession completedAt cannot be before startedAt.");
  }
  if (startedAt !== null && cancelledAt !== null &&
      Date.parse(cancelledAt) < Date.parse(startedAt)) {
    throw new TypeError("WorkSession cancelledAt cannot be before startedAt.");
  }

  return session;
}

export function createWorkSession(input, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("WorkSession input must be an object.");
  }
  const now = options.now ?? new Date().toISOString();
  const session = {
    id: input.id ?? options.id,
    taskId: input.taskId,
    status: input.status ?? "planned",
    plannedDurationSeconds: input.plannedDurationSeconds ?? null,
    startedAt: input.startedAt ?? null,
    completedAt: input.completedAt ?? null,
    cancelledAt: input.cancelledAt ?? null,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    version: input.version ?? 1
  };

  return validateWorkSession(session);
}

export const workSessionModelOptions = Object.freeze({
  statuses: [...STATUSES]
});
