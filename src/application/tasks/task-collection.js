import {
  createTaskForUI,
  updateTaskForUI
} from "./task-use-cases.js";

/**
 * Owns the in-memory task collection and coordinates persistence.
 * It deliberately has no dependency on the DOM or presentation layer.
 */
export function createTaskCollection(options = {}) {
  const readTasks = options.loadTasks;
  const writeTasks = options.saveTasks;

  if (typeof readTasks !== "function" || typeof writeTasks !== "function") {
    throw new TypeError("Task collection requires loadTasks and saveTasks functions.");
  }
  const createTask = options.createTask ?? createTaskForUI;
  const updateTask = options.updateTask ?? updateTaskForUI;

  let tasks = [];
  let lastPersistedTasks = [];
  let storageReady = true;
  let storageError = null;

  try {
    tasks = readTasks();
    lastPersistedTasks = structuredClone(tasks);
  } catch (error) {
    storageReady = false;
    storageError = error;
  }

  function persist() {
    try {
      writeTasks(tasks);
      lastPersistedTasks = structuredClone(tasks);
      return { ok: true };
    } catch (writeError) {
      try {
        tasks = readTasks();
        lastPersistedTasks = structuredClone(tasks);
      } catch (readError) {
        tasks = structuredClone(lastPersistedTasks);
        writeError.recoveryError = readError;
      }
      storageReady = false;
      storageError = writeError;
      return { ok: false, kind: "storage", error: writeError };
    }
  }

  function rejectWhenUnavailable() {
    return storageReady
      ? null
      : { ok: false, kind: "storage", error: storageError };
  }

  function updateById(id, changes) {
    const unavailable = rejectWhenUnavailable();
    if (unavailable) return unavailable;

    const currentTask = tasks.find((task) => task.id === id);
    if (!currentTask) return { ok: false, kind: "not-found" };

    let updatedTask;
    try {
      updatedTask = updateTask(currentTask, changes);
    } catch (error) {
      return { ok: false, kind: "validation", error };
    }

    tasks = tasks.map((task) => task.id === id ? updatedTask : task);
    return persist();
  }

  return {
    getTasks() {
      return structuredClone(tasks);
    },

    isStorageReady() {
      return storageReady;
    },

    getStorageError() {
      return storageError;
    },

    create(details) {
      const unavailable = rejectWhenUnavailable();
      if (unavailable) return unavailable;

      let task;
      try {
        task = createTask(details);
      } catch (error) {
        return { ok: false, kind: "validation", error };
      }

      tasks = [task, ...tasks];
      return persist();
    },

    update(id, changes) {
      return updateById(id, changes);
    },

    toggle(id, done) {
      return updateById(id, { done });
    },

    remove(id) {
      const unavailable = rejectWhenUnavailable();
      if (unavailable) return unavailable;

      const taskExists = tasks.some((task) => task.id === id);
      if (!taskExists) return { ok: false, kind: "not-found" };

      tasks = tasks.filter((task) => task.id !== id);
      return persist();
    }
  };
}
