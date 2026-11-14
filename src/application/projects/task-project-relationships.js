import { updateTask, validateTask } from "../../domain/tasks/task.js";
import { validateProject } from "../../domain/projects/project.js";

const RELATIONSHIP_EVENT_TYPES = new Set(["attached", "detached", "moved"]);

function createId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `relationship-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function validateActor(actor) {
  if (!actor || typeof actor !== "object" || Array.isArray(actor)) {
    throw new TypeError("Relationship actor must be an object.");
  }
  if (!["user", "ai"].includes(actor.type)) {
    throw new TypeError("Relationship actor type must be user or ai.");
  }
  if (actor.id !== undefined && actor.id !== null &&
      (typeof actor.id !== "string" || actor.id.trim() === "")) {
    throw new TypeError("Relationship actor id must be a non-empty string or null.");
  }
  return Object.freeze({
    type: actor.type,
    id: actor.id ?? null
  });
}

function resolveMetadata(options = {}) {
  const occurredAt = options.now ?? new Date().toISOString();
  if (typeof occurredAt !== "string" || Number.isNaN(Date.parse(occurredAt))) {
    throw new TypeError("Relationship event timestamp must be a valid ISO timestamp.");
  }
  if (options.eventId !== undefined &&
      (typeof options.eventId !== "string" || options.eventId.trim() === "")) {
    throw new TypeError("Relationship event id must be a non-empty string.");
  }
  return {
    occurredAt,
    eventId: options.eventId ?? createId(),
    actor: validateActor(options.actor)
  };
}

function createEvent(taskId, type, fromProjectId, toProjectId, metadata) {
  if (!RELATIONSHIP_EVENT_TYPES.has(type)) {
    throw new TypeError("Relationship event type is invalid.");
  }

  return Object.freeze({
    id: metadata.eventId,
    occurredAt: metadata.occurredAt,
    taskId,
    type,
    fromProjectId,
    toProjectId,
    actor: metadata.actor
  });
}

function validateRelationshipInputs(task, project) {
  validateTask(task);
  validateProject(project);
  if (project.status !== "active") {
    throw new TypeError("A Task can only be attached to an active Project.");
  }
}

/**
 * Attaches an independent Task to one active Project.
 * Returns a new canonical Task and a lightweight history event.
 */
export function attachTaskToProject(task, project, options = {}) {
  validateRelationshipInputs(task, project);
  if (task.projectId !== null) {
    throw new TypeError("Task is already attached to a Project; use moveTaskToProject.");
  }

  const metadata = resolveMetadata(options);
  return {
    task: updateTask(task, { projectId: project.id }, { now: metadata.occurredAt }),
    event: createEvent(task.id, "attached", null, project.id, metadata)
  };
}

/**
 * Detaches a Task without requiring its current Project to be active.
 */
export function detachTaskFromProject(task, options = {}) {
  validateTask(task);
  if (task.projectId === null) {
    return { task, event: null };
  }

  const metadata = resolveMetadata(options);
  return {
    task: updateTask(task, { projectId: null }, { now: metadata.occurredAt }),
    event: createEvent(task.id, "detached", task.projectId, null, metadata)
  };
}

/**
 * Moves a Task to a different active Project. Moving to the current Project
 * is an idempotent no-op and does not create a history event.
 */
export function moveTaskToProject(task, destinationProject, options = {}) {
  validateRelationshipInputs(task, destinationProject);
  if (task.projectId === null) {
    throw new TypeError("An unattached Task must be attached, not moved.");
  }
  if (task.projectId === destinationProject.id) {
    return { task, event: null };
  }

  const metadata = resolveMetadata(options);
  return {
    task: updateTask(task, { projectId: destinationProject.id }, { now: metadata.occurredAt }),
    event: createEvent(
      task.id,
      "moved",
      task.projectId,
      destinationProject.id,
      metadata
    )
  };
}

export const taskProjectRelationshipOptions = Object.freeze({
  eventTypes: [...RELATIONSHIP_EVENT_TYPES],
  actorTypes: ["user", "ai"]
});
