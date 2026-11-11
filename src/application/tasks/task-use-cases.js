import { createTask, updateTask } from "../../domain/tasks/task.js";
import {
  fromLegacyTask,
  toLegacyTask
} from "../../domain/tasks/legacy-task-adapter.js";

function emptyToNull(value) {
  return value === "" || value === undefined ? null : value;
}

function createId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Application boundary for creating a task while the prototype UI still uses
 * its original field names and local-storage format.
 */
export function createTaskForUI(input, options = {}) {
  const task = createTask({
    ...input,
    id: input.id ?? options.id ?? createId(),
    date: emptyToNull(input.date),
    time: emptyToNull(input.time)
  }, options);

  return toLegacyTask(task);
}

/**
 * Applies UI-shaped changes through the canonical domain model, then returns
 * the legacy view expected by the current UI and storage adapter.
 */
export function updateTaskForUI(legacyTask, changes, options = {}) {
  const current = fromLegacyTask(legacyTask, options);
  const domainChanges = {};

  if (Object.hasOwn(changes, "title")) domainChanges.title = changes.title;
  if (Object.hasOwn(changes, "date")) domainChanges.plannedDate = emptyToNull(changes.date);
  if (Object.hasOwn(changes, "time")) domainChanges.startTime = emptyToNull(changes.time);
  if (Object.hasOwn(changes, "priority")) domainChanges.priority = changes.priority;
  if (Object.hasOwn(changes, "category")) domainChanges.categoryId = changes.category;

  if (Object.hasOwn(changes, "done")) {
    domainChanges.status = changes.done ? "completed" : "todo";
    domainChanges.progress = changes.done ? 100 : 0;
  }

  return toLegacyTask(updateTask(current, domainChanges, options));
}
