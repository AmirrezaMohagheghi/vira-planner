import { validateProject } from "../../domain/projects/project.js";

/**
 * Collection-backed implementation of ProjectRepository.
 * Storage access is injected so the adapter does not choose a database or
 * introduce a new persistence format.
 */
export function createLocalProjectRepository(options = {}) {
  const readProjects = options.loadProjects;
  const writeProjects = options.saveProjects;

  if (typeof readProjects !== "function" || typeof writeProjects !== "function") {
    throw new TypeError(
      "LocalProjectRepository requires loadProjects and saveProjects functions."
    );
  }

  function readCollection() {
    const projects = readProjects();
    if (!Array.isArray(projects)) {
      throw new TypeError("Project storage must return an array.");
    }

    const ids = new Set();
    for (const project of projects) {
      validateProject(project);
      if (ids.has(project.id)) {
        throw new TypeError(`Duplicate project id: ${project.id}.`);
      }
      ids.add(project.id);
    }
    return projects;
  }

  function validateQuery(query) {
    if (query === undefined) return;
    if (!query || typeof query !== "object" || Array.isArray(query)) {
      throw new TypeError("ProjectRepository list query must be an object.");
    }

    for (const key of Object.keys(query)) {
      if (!["groupId", "status"].includes(key)) {
        throw new TypeError(`Unsupported ProjectRepository list filter: ${key}.`);
      }
    }
  }

  function matchesQuery(project, query) {
    if (query === undefined) return true;
    return Object.keys(query).every((key) => project[key] === query[key]);
  }

  return Object.freeze({
    async getById(id) {
      if (typeof id !== "string" || id.trim() === "") {
        throw new TypeError("ProjectRepository id must be a non-empty string.");
      }
      const project = readCollection().find((item) => item.id === id);
      return project ? structuredClone(project) : null;
    },

    async list(query) {
      validateQuery(query);
      return readCollection()
        .filter((project) => matchesQuery(project, query))
        .map((project) => structuredClone(project));
    },

    async listByGroupId(groupId) {
      if (typeof groupId !== "string" || groupId.trim() === "") {
        throw new TypeError(
          "ProjectRepository groupId must be a non-empty string."
        );
      }
      return readCollection()
        .filter((project) => project.groupId === groupId)
        .map((project) => structuredClone(project));
    },

    async save(project) {
      validateProject(project);
      const projects = readCollection();
      const index = projects.findIndex((item) => item.id === project.id);
      const savedProject = structuredClone(project);

      if (index === -1) {
        projects.push(savedProject);
      } else {
        projects[index] = savedProject;
      }

      writeProjects(projects);
      return structuredClone(savedProject);
    }
  });
}
