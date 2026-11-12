import { createTask, validateTask } from "../../domain/tasks/task.js";

const CANONICAL_REQUIRED_FIELDS = Object.freeze([
  "id",
  "title",
  "description",
  "plannedDate",
  "startTime",
  "endTime",
  "durationMinutes",
  "deadline",
  "priority",
  "categoryId",
  "status",
  "progress",
  "dependencyIds",
  "parentTaskId",
  "recurrenceRuleId",
  "reminderIds",
  "createdAt",
  "updatedAt",
  "source",
  "version"
]);

const CANONICAL_MARKERS = CANONICAL_REQUIRED_FIELDS.filter((field) =>
  !["id", "title", "description", "priority"].includes(field)
);

function emptyToNull(value) {
  return value === "" || value === undefined ? null : value;
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isCanonicalOrMixedTask(task) {
  return CANONICAL_MARKERS.some((field) => hasOwn(task, field));
}

/**
 * Converts the original prototype shape to the canonical domain model.
 * Once any canonical-only field exists, the record must be complete and valid;
 * defaults are reserved for genuinely legacy records.
 */
export function fromLegacyTask(legacyTask, options = {}) {
  if (!legacyTask || typeof legacyTask !== "object" || Array.isArray(legacyTask)) {
    throw new TypeError("Legacy task must be an object.");
  }

  if (isCanonicalOrMixedTask(legacyTask)) {
    const missingFields = CANONICAL_REQUIRED_FIELDS.filter((field) =>
      !hasOwn(legacyTask, field)
    );

    if (missingFields.length > 0) {
      throw new TypeError(
        `Canonical task is incomplete. Missing fields: ${missingFields.join(", ")}.`
      );
    }

    const canonical = { ...legacyTask };
    delete canonical.date;
    delete canonical.time;
    delete canonical.category;
    delete canonical.done;
    return validateTask(canonical);
  }

  const canonical = createTask({
    id: legacyTask.id,
    title: legacyTask.title,
    description: legacyTask.description ?? null,
    plannedDate: emptyToNull(legacyTask.date),
    startTime: emptyToNull(legacyTask.time),
    endTime: null,
    durationMinutes: null,
    deadline: null,
    priority: legacyTask.priority ?? "medium",
    categoryId: legacyTask.category ?? "personal",
    done: legacyTask.done === true,
    dependencyIds: [],
    parentTaskId: null,
    recurrenceRuleId: null,
    reminderIds: [],
    source: "user",
    version: 1
  }, options);

  // Keep unrecognized legacy metadata instead of silently discarding it.
  return { ...legacyTask, ...canonical };
}

/**
 * Exposes legacy aliases for the current UI while retaining every canonical
 * and unrecognized field during the transition.
 */
export function toLegacyTask(task) {
  validateTask(task);

  return {
    ...task,
    date: task.plannedDate ?? "",
    time: task.startTime ?? "",
    category: task.categoryId,
    done: task.status === "completed",
    dependencyIds: [...task.dependencyIds],
    reminderIds: [...task.reminderIds]
  };
}

export function fromLegacyTasks(tasks, options = {}) {
  if (!Array.isArray(tasks)) {
    throw new TypeError("Legacy tasks must be an array.");
  }

  const converted = tasks.map((task) => fromLegacyTask(task, options));
  const ids = new Set();

  for (const task of converted) {
    if (ids.has(task.id)) {
      throw new TypeError(`Duplicate task id: ${task.id}.`);
    }
    ids.add(task.id);
  }

  return converted;
}

export function toLegacyTasks(tasks) {
  if (!Array.isArray(tasks)) {
    throw new TypeError("Tasks must be an array.");
  }

  return tasks.map(toLegacyTask);
}
