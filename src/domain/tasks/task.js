const PRIORITIES = new Set(["low", "medium", "high"]);
const STATUSES = new Set(["todo", "in_progress", "completed", "cancelled"]);
const SOURCES = new Set(["user", "import", "ai", "system"]);

function isOptionalString(value) {
  return value === null || typeof value === "string";
}

function isValidDate(value) {
  if (value === null) return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function isValidTime(value) {
  if (value === null) return true;
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return false;
  return true;
}

function isValidTimestamp(value) {
  return value === null ||
    (typeof value === "string" && !Number.isNaN(Date.parse(value)));
}

export function validateTask(task) {
  if (!task || typeof task !== "object" || Array.isArray(task)) {
    throw new TypeError("Task must be an object.");
  }
  if (typeof task.id !== "string" || task.id.trim() === "") {
    throw new TypeError("Task id must be a non-empty string.");
  }
  if (typeof task.title !== "string" || task.title.trim() === "") {
    throw new TypeError("Task title must be a non-empty string.");
  }
  if (!isOptionalString(task.description)) {
    throw new TypeError("Task description must be a string or null.");
  }
  if (!isValidDate(task.plannedDate)) {
    throw new TypeError("Task plannedDate must be a valid ISO date or null.");
  }
  if (!isValidTime(task.startTime) || !isValidTime(task.endTime)) {
    throw new TypeError("Task times must use the HH:mm format or be null.");
  }
  if (task.startTime && task.endTime && task.endTime <= task.startTime) {
    throw new TypeError("Task endTime must be later than startTime.");
  }
  if (task.durationMinutes !== null &&
      (!Number.isInteger(task.durationMinutes) || task.durationMinutes <= 0)) {
    throw new TypeError("Task durationMinutes must be a positive integer or null.");
  }
  if (!isValidTimestamp(task.deadline)) {
    throw new TypeError("Task deadline must be a valid timestamp or null.");
  }
  if (!PRIORITIES.has(task.priority)) {
    throw new TypeError("Task priority is invalid.");
  }
  if (typeof task.categoryId !== "string" || task.categoryId.trim() === "") {
    throw new TypeError("Task categoryId must be a non-empty string.");
  }
  if (!STATUSES.has(task.status)) {
    throw new TypeError("Task status is invalid.");
  }
  if (!Number.isInteger(task.progress) || task.progress < 0 || task.progress > 100) {
    throw new TypeError("Task progress must be an integer between 0 and 100.");
  }
  if (
    (task.status === "todo" && task.progress !== 0) ||
    (task.status === "in_progress" && (task.progress < 1 || task.progress > 99)) ||
    (task.status === "completed" && task.progress !== 100)
  ) {
    throw new TypeError("Task status and progress are inconsistent.");
  }
  if (!Array.isArray(task.dependencyIds) ||
      !task.dependencyIds.every((id) => typeof id === "string")) {
    throw new TypeError("Task dependencyIds must be an array of strings.");
  }
  if (!isOptionalString(task.parentTaskId) ||
      !isOptionalString(task.recurrenceRuleId)) {
    throw new TypeError("Task parent and recurrence references must be strings or null.");
  }
  if (!Array.isArray(task.reminderIds) ||
      !task.reminderIds.every((id) => typeof id === "string")) {
    throw new TypeError("Task reminderIds must be an array of strings.");
  }
  if (!isValidTimestamp(task.createdAt) || !isValidTimestamp(task.updatedAt)) {
    throw new TypeError("Task timestamps must be valid ISO timestamps.");
  }
  if (!SOURCES.has(task.source)) {
    throw new TypeError("Task source is invalid.");
  }
  if (!Number.isInteger(task.version) || task.version < 1) {
    throw new TypeError("Task version must be a positive integer.");
  }
  return task;
}

export function createTask(input, options = {}) {
  const now = options.now ?? new Date().toISOString();
  const isLegacyDone = input.done === true;
  const status = input.status ?? (isLegacyDone ? "completed" : "todo");
  const defaultProgressByStatus = {
    todo: 0,
    in_progress: 1,
    completed: 100,
    cancelled: 0
  };
  const progress = input.progress ?? defaultProgressByStatus[status];

  const task = {
    id: input.id ?? options.id ?? crypto.randomUUID(),
    title: input.title?.trim() ?? "",
    description: input.description ?? null,
    plannedDate: input.plannedDate ?? input.date ?? null,
    startTime: input.startTime ?? input.time ?? null,
    endTime: input.endTime ?? null,
    durationMinutes: input.durationMinutes ?? null,
    deadline: input.deadline ?? null,
    priority: input.priority ?? "medium",
    categoryId: input.categoryId ?? input.category ?? "personal",
    status,
    progress,
    dependencyIds: [...(input.dependencyIds ?? [])],
    parentTaskId: input.parentTaskId ?? null,
    recurrenceRuleId: input.recurrenceRuleId ?? null,
    reminderIds: [...(input.reminderIds ?? [])],
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    source: input.source ?? "user",
    version: input.version ?? 1
  };

  return validateTask(task);
}

export function updateTask(task, changes, options = {}) {
  const now = options.now ?? new Date().toISOString();
  const updated = { ...task, ...changes, updatedAt: now };

  if (changes.status !== undefined && changes.progress === undefined) {
    if (changes.status === "todo") {
      updated.progress = 0;
    } else if (changes.status === "completed") {
      updated.progress = 100;
    } else if (changes.status === "in_progress" &&
        (task.progress === 0 || task.progress === 100)) {
      updated.progress = 1;
    }
  } else if (changes.progress !== undefined && changes.status === undefined) {
    updated.status = changes.progress === 0
      ? "todo"
      : changes.progress === 100
        ? "completed"
        : "in_progress";
  }

  return validateTask(updated);
}

export const taskModelOptions = Object.freeze({
  priorities: [...PRIORITIES],
  statuses: [...STATUSES],
  sources: [...SOURCES]
});
