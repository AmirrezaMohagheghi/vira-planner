function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function isValidTimestamp(value) {
  return typeof value === "string" &&
    !Number.isNaN(Date.parse(value));
}

export function validateProjectGroup(group) {
  if (!group || typeof group !== "object" || Array.isArray(group)) {
    throw new TypeError("ProjectGroup must be an object.");
  }
  if (!isNonEmptyString(group.id)) {
    throw new TypeError("ProjectGroup id must be a non-empty string.");
  }
  if (!isNonEmptyString(group.name)) {
    throw new TypeError("ProjectGroup name must be a non-empty string.");
  }
  if (!Number.isInteger(group.sortOrder) || group.sortOrder < 0) {
    throw new TypeError("ProjectGroup sortOrder must be a non-negative integer.");
  }
  if (!isValidTimestamp(group.createdAt) || !isValidTimestamp(group.updatedAt)) {
    throw new TypeError("ProjectGroup timestamps must be valid ISO timestamps.");
  }
  if (!Number.isInteger(group.version) || group.version < 1) {
    throw new TypeError("ProjectGroup version must be a positive integer.");
  }
  return group;
}

export function createProjectGroup(input, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("ProjectGroup input must be an object.");
  }

  const now = options.now ?? new Date().toISOString();
  return validateProjectGroup({
    id: input.id ?? options.id ?? crypto.randomUUID(),
    name: input.name?.trim() ?? "",
    sortOrder: input.sortOrder ?? 0,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    version: input.version ?? 1
  });
}

export function renameProjectGroup(group, name, options = {}) {
  validateProjectGroup(group);
  if (typeof name !== "string" || name.trim() === "") {
    throw new TypeError("ProjectGroup name must be a non-empty string.");
  }

  return validateProjectGroup({
    ...group,
    name: name.trim(),
    updatedAt: options.now ?? new Date().toISOString(),
    version: group.version + 1
  });
}

export function reorderProjectGroup(group, sortOrder, options = {}) {
  validateProjectGroup(group);
  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    throw new TypeError("ProjectGroup sortOrder must be a non-negative integer.");
  }

  return validateProjectGroup({
    ...group,
    sortOrder,
    updatedAt: options.now ?? new Date().toISOString(),
    version: group.version + 1
  });
}
