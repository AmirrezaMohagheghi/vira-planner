import { loadTasks, saveTasks } from "../../infrastructure/storage/local-task-storage.js";
import {
  createTaskForUI,
  updateTaskForUI
} from "./task-use-cases.js";

/**
 * Owns the in-memory task collection and coordinates persistence.
 * It deliberately has no dependency on the DOM or presentation layer.
 */
export function createTaskCollection(options = {}) {
  const readTasks = options.loadTasks ?? loadTasks;
  const writeTasks = options.saveTasks ?? saveTasks;
  const createTask = options.createTask ?? createTaskForUI;
  const updateTask = options.updateTask ?? updateTaskForUI;

  let tasks = [];
  let storageReady = true;
  let storageError = null;

  try {
    tasks = readTasks();
  } catch (error) {
    storageReady = false;
    storageError = error;
  }

  function persist() {
    try {
      writeTasks(tasks);
      return { ok: true };
    } catch (error) {
      try {
        tasks = readTasks();
      } catch (readError) {
        error = readError;
      }
      storageReady = false;
      storageError = error;
      return { ok: false, error };
    }
  }

  function rejectWhenUnavailable() {
    return storageReady ? null : { ok: false, error: storageError };
  }

  function updateById(id, changes) {
    const unavailable = rejectWhenUnavailable();
    if (unavailable) return unavailable;

    const currentTask = tasks.find((task) => task.id === id);
    if (!currentTask) return { ok: false, reason: "not-found" };

    const updatedTask = updateTask(currentTask, changes);
    tasks = tasks.map((task) => task.id === id ? updatedTask : task);
    return persist();
  }

  return {
    getTasks() {
      return tasks;
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

      tasks = [createTask(details), ...tasks];
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

      tasks = tasks.filter((task) => task.id !== id);
      return persist();
    }
  };
}
