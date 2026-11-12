import { createTask, validateTask } from "../../domain/tasks/task.js";

function emptyToNull(value) {
  return value === "" || value === undefined ? null : value;
}

/**
 * Maps both the original prototype shape and the canonical task fields
 * to the domain model. Legacy aliases remain supported during the transition.
 */
export function fromLegacyTask(legacyTask, options = {}) {
  if (!legacyTask || typeof legacyTask !== "object" || Array.isArray(legacyTask)) {
    throw new TypeError("Legacy task must be an object.");
  }

  return createTask({
    id: legacyTask.id,
    title: legacyTask.title,
    description: legacyTask.description ?? null,
    plannedDate: legacyTask.plannedDate ?? emptyToNull(legacyTask.date),
    startTime: legacyTask.startTime ?? emptyToNull(legacyTask.time),
    endTime: legacyTask.endTime ?? null,
    durationMinutes: legacyTask.durationMinutes ?? null,
    deadline: legacyTask.deadline ?? null,
    priority: legacyTask.priority ?? "medium",
    categoryId: legacyTask.categoryId ?? legacyTask.category ?? "personal",
    status: legacyTask.status,
    progress: legacyTask.progress,
    done: legacyTask.done === true,
    dependencyIds: legacyTask.dependencyIds ?? [],
    parentTaskId: legacyTask.parentTaskId ?? null,
    recurrenceRuleId: legacyTask.recurrenceRuleId ?? null,
    reminderIds: legacyTask.reminderIds ?? [],
    createdAt: legacyTask.createdAt,
    updatedAt: legacyTask.updatedAt,
    source: legacyTask.source ?? "user",
    version: legacyTask.version ?? 1
  }, options);
}

/**
 * Exposes legacy aliases for the current UI while retaining every canonical
 * domain field in storage. This makes the transition additive and lossless.
 */
export function toLegacyTask(task) {
  validateTask(task);

  return {
    id: task.id,
    title: task.title,
    date: task.plannedDate ?? "",
    time: task.startTime ?? "",
    priority: task.priority,
    category: task.categoryId,
    done: task.status === "completed",
    description: task.description,
    plannedDate: task.plannedDate,
    startTime: task.startTime,
    endTime: task.endTime,
    durationMinutes: task.durationMinutes,
    deadline: task.deadline,
    categoryId: task.categoryId,
    status: task.status,
    progress: task.progress,
    dependencyIds: [...task.dependencyIds],
    parentTaskId: task.parentTaskId,
    recurrenceRuleId: task.recurrenceRuleId,
    reminderIds: [...task.reminderIds],
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    source: task.source,
    version: task.version
  };
}

export function fromLegacyTasks(tasks, options = {}) {
  if (!Array.isArray(tasks)) {
    throw new TypeError("Legacy tasks must be an array.");
  }
  return tasks.map((task) => fromLegacyTask(task, options));
}

export function toLegacyTasks(tasks) {
  if (!Array.isArray(tasks)) {
    throw new TypeError("Tasks must be an array.");
  }
  return tasks.map(toLegacyTask);
}
