import { validateProjectGroup } from "../../domain/projects/project-group.js";

/**
 * Collection-backed implementation of ProjectGroupRepository.
 * Storage access is injected; no database or storage schema is selected here.
 */
export function createLocalProjectGroupRepository(options = {}) {
  const readGroups = options.loadProjectGroups;
  const writeGroups = options.saveProjectGroups;

  if (typeof readGroups !== "function" || typeof writeGroups !== "function") {
    throw new TypeError(
      "LocalProjectGroupRepository requires loadProjectGroups and saveProjectGroups functions."
    );
  }

  function readCollection() {
    const groups = readGroups();
    if (!Array.isArray(groups)) {
      throw new TypeError("ProjectGroup storage must return an array.");
    }

    const ids = new Set();
    for (const group of groups) {
      validateProjectGroup(group);
      if (ids.has(group.id)) {
        throw new TypeError(`Duplicate project group id: ${group.id}.`);
      }
      ids.add(group.id);
    }
    return groups;
  }

  function validateQuery(query) {
    if (query === undefined) return;
    if (!query || typeof query !== "object" || Array.isArray(query)) {
      throw new TypeError("ProjectGroupRepository list query must be an object.");
    }

    for (const key of Object.keys(query)) {
      if (key !== "sortOrder") {
        throw new TypeError(
          `Unsupported ProjectGroupRepository list filter: ${key}.`
        );
      }
    }
    if (Object.hasOwn(query, "sortOrder") &&
        (!Number.isInteger(query.sortOrder) || query.sortOrder < 0)) {
      throw new TypeError("ProjectGroupRepository sortOrder filter must be a non-negative integer.");
    }
  }

  return Object.freeze({
    async getById(id) {
      if (typeof id !== "string" || id.trim() === "") {
        throw new TypeError(
          "ProjectGroupRepository id must be a non-empty string."
        );
      }
      const group = readCollection().find((item) => item.id === id);
      return group ? structuredClone(group) : null;
    },

    async list(query) {
      validateQuery(query);
      return readCollection()
        .filter((group) => query === undefined ||
          !Object.hasOwn(query, "sortOrder") ||
          group.sortOrder === query.sortOrder)
        .map((group) => structuredClone(group));
    },

    async save(group) {
      validateProjectGroup(group);
      const groups = readCollection();
      const index = groups.findIndex((item) => item.id === group.id);
      const savedGroup = structuredClone(group);

      if (index === -1) {
        groups.push(savedGroup);
      } else {
        groups[index] = savedGroup;
      }

      writeGroups(groups);
      return structuredClone(savedGroup);
    }
  });
}
