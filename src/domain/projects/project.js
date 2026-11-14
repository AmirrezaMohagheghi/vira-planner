const PROJECT_STATUSES = new Set(["active", "archived", "trashed"]);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function isOptionalString(value) {
  return value === null || typeof value === "string";
}

function isValidTimestamp(value) {
  return typeof value === "string" &&
    !Number.isNaN(Date.parse(value));
}

export function validateProject(project) {
  if (!project || typeof project !== "object" || Array.isArray(project)) {
    throw new TypeError("Project must be an object.");
  }
  if (!isNonEmptyString(project.id)) {
    throw new TypeError("Project id must be a non-empty string.");
  }
  if (!isNonEmptyString(project.name)) {
    throw new TypeError("Project name must be a non-empty string.");
  }
  if (!isOptionalString(project.description)) {
    throw new TypeError("Project description must be a string or null.");
  }
  if (!isOptionalString(project.groupId)) {
    throw new TypeError("Project groupId must be a string or null.");
  }
  if (!PROJECT_STATUSES.has(project.status)) {
    throw new TypeError("Project status is invalid.");
  }
  if (!isValidTimestamp(project.createdAt) || !isValidTimestamp(project.updatedAt)) {
    throw new TypeError("Project timestamps must be valid ISO timestamps.");
  }
  if (!Number.isInteger(project.version) || project.version < 1) {
    throw new TypeError("Project version must be a positive integer.");
  }
  return project;
}

export function createProject(input, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Project input must be an object.");
  }

  const now = options.now ?? new Date().toISOString();
  return validateProject({
    id: input.id ?? options.id ?? crypto.randomUUID(),
    name: input.name?.trim() ?? "",
    description: input.description ?? null,
    groupId: input.groupId ?? null,
    status: input.status ?? "active",
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    version: input.version ?? 1
  });
}

export function updateProject(project, changes, options = {}) {
  validateProject(project);
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    throw new TypeError("Project changes must be an object.");
  }

  const allowedChanges = {};
  for (const field of ["name", "description", "groupId"]) {
    if (Object.hasOwn(changes, field)) {
      allowedChanges[field] = field === "name" && typeof changes[field] === "string"
        ? changes[field].trim()
        : changes[field];
    }
  }

  return validateProject({
    ...project,
    ...allowedChanges,
    updatedAt: options.now ?? new Date().toISOString(),
    version: project.version + 1
  });
}

function transitionProject(project, nextStatus, options = {}) {
  validateProject(project);
  return validateProject({
    ...project,
    status: nextStatus,
    updatedAt: options.now ?? new Date().toISOString(),
    version: project.version + 1
  });
}

export function archiveProject(project, options = {}) {
  if (project.status !== "active") {
    throw new TypeError("Only an active Project can be archived.");
  }
  return transitionProject(project, "archived", options);
}

export function restoreProject(project, options = {}) {
  if (project.status !== "archived") {
    throw new TypeError("Only an archived Project can be restored.");
  }
  return transitionProject(project, "active", options);
}

export function trashProject(project, options = {}) {
  if (project.status === "trashed") {
    throw new TypeError("Project is already in the trash.");
  }
  return transitionProject(project, "trashed", options);
}

export function restoreProjectFromTrash(project, options = {}) {
  if (project.status !== "trashed") {
    throw new TypeError("Only a trashed Project can be restored from the trash.");
  }
  return transitionProject(project, "active", options);
}

export const projectModelOptions = Object.freeze({
  statuses: [...PROJECT_STATUSES]
});
