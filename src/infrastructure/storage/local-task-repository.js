import { validateTask } from "../../domain/tasks/task.js";
import {
  loadTasks as loadStoredTasks,
  saveTasks as saveStoredTasks
} from "./local-task-storage.js";

/**
 * LocalStorage-backed implementation of the application TaskRepository port.
 * The storage functions are injectable so the repository can be tested without
 * browser globals. All public methods are async to satisfy the repository port.
 */
export function createLocalTaskRepository(options = {}) {
  const readTasks = options.loadTasks ?? loadStoredTasks;
  const writeTasks = options.saveTasks ?? saveStoredTasks;

  if (typeof readTasks !== "function" || typeof writeTasks !== "function") {
    throw new TypeError(
      "LocalTaskRepository requires loadTasks and saveTasks functions."
    );
  }

  function readCollection() {
    const tasks = readTasks();
    if (!Array.isArray(tasks)) {
      throw new TypeError("Task storage must return an array.");
    }

    const ids = new Set();
    for (const task of tasks) {
      validateTask(task);
      if (ids.has(task.id)) {
        throw new TypeError(`Duplicate task id: ${task.id}.`);
      }
      ids.add(task.id);
    }
    return tasks;
  }

  function matchesQuery(task, query) {
    if (query === undefined) return true;
    if (!query || typeof query !== "object" || Array.isArray(query)) {
      throw new TypeError("TaskRepository list query must be an object.");
    }

    const supportedFilters = ["projectId", "status", "priority", "plannedDate"];
    for (const key of Object.keys(query)) {
      if (!supportedFilters.includes(key)) {
        throw new TypeError(`Unsupported TaskRepository list filter: ${key}.`);
      }
      if (task[key] !== query[key]) return false;
    }
    return true;
  }

  return Object.freeze({
    async getById(id) {
      if (typeof id !== "string" || id.trim() === "") {
        throw new TypeError("TaskRepository id must be a non-empty string.");
      }
      const task = readCollection().find((item) => item.id === id);
      return task ? structuredClone(task) : null;
    },

    async list(query) {
      return readCollection()
        .filter((task) => matchesQuery(task, query))
        .map((task) => structuredClone(task));
    },

    async listByProjectId(projectId) {
      if (typeof projectId !== "string" || projectId.trim() === "") {
        throw new TypeError(
          "TaskRepository projectId must be a non-empty string."
        );
      }
      return readCollection()
        .filter((task) => task.projectId === projectId)
        .map((task) => structuredClone(task));
    },

    async save(task) {
      validateTask(task);
      const tasks = readCollection();
      const index = tasks.findIndex((item) => item.id === task.id);
      const savedTask = structuredClone(task);

      if (index === -1) {
        tasks.push(savedTask);
      } else {
        tasks[index] = savedTask;
      }

      writeTasks(tasks);
      return structuredClone(savedTask);
    }
  });
}
