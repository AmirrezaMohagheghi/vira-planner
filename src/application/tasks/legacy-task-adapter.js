import { createTask, validateTask } from "./task.js";

function emptyToNull(value) {
  return value === "" || value === undefined ? null : value;
}

/**
 * Maps the prototype's legacy task shape to and from the canonical domain model at the application boundary.
 * This mapper deliberately does not read from or write to storage.
 */
export function fromLegacyTask(legacyTask, options = {}) {
  if (!legacyTask || typeof legacyTask !== "object" || Array.isArray(legacyTask)) {
    throw new TypeError("Legacy task must be an object.");
  }

  return createTask({
    id: legacyTask.id,
    title: legacyTask.title,
    date: emptyToNull(legacyTask.date),
    time: emptyToNull(legacyTask.time),
    priority: legacyTask.priority ?? "medium",
    category: legacyTask.category ?? "personal",
    done: legacyTask.done === true
  }, options);
}

/**
 * Converts a canonical task back to the exact field names used by the current UI.
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
    done: task.status === "completed"
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
