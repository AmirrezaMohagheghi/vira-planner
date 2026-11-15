import {
  assertTaskRepository
} from "../ports/persistence-contracts.js";
import {
  fromLegacyTask,
  toLegacyTask
} from "./legacy-task-adapter.js";
import {
  createTaskForUI,
  updateTaskForUI
} from "./task-use-cases.js";

/**
 * Owns the in-memory task collection and coordinates asynchronous persistence.
 * The collection exposes the legacy task shape until the presentation layer
 * completes its separate migration to the canonical domain model.
 */
export function createTaskCollection(options = {}) {
  const repository = assertTaskRepository(options.taskRepository);
  const createTask = options.createTask ?? createTaskForUI;
  const updateTask = options.updateTask ?? updateTaskForUI;

  let tasks = [];
  let lastPersistedTasks = [];
  let storageReady = false;
  let storageError = null;
  let initializationAttempted = false;
  let initializationPromise = null;
  let mutationQueue = Promise.resolve();

  function storageFailure(error) {
    storageReady = false;
    storageError = error;
    return { ok: false, kind: "storage", error };
  }

  function rejectWhenUnavailable() {
    return storageReady
      ? null
      : { ok: false, kind: "storage", error: storageError };
  }

  function enqueueMutation(work) {
    const operation = mutationQueue.then(async () => {
      const unavailable = rejectWhenUnavailable();
      if (unavailable) return unavailable;
      return work();
    });

    // Keep the queue usable even if an unexpected error escapes one operation.
    mutationQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  async function saveLegacyTask(legacyTask, existingTaskId = null) {
    let canonicalTask;
    try {
      canonicalTask = fromLegacyTask(legacyTask);
    } catch (error) {
      return { ok: false, kind: "validation", error };
    }

    try {
      const savedTask = await repository.save(canonicalTask);
      const savedLegacyTask = toLegacyTask(savedTask);

      if (existingTaskId === null) {
        tasks = [savedLegacyTask, ...tasks];
      } else {
        tasks = tasks.map((task) =>
          task.id === existingTaskId ? savedLegacyTask : task
        );
      }

      lastPersistedTasks = structuredClone(tasks);
      return { ok: true };
    } catch (error) {
      // Keep the last confirmed in-memory snapshot; the repository may have
      // failed after an uncertain write, so block further mutations.
      tasks = structuredClone(lastPersistedTasks);
      return storageFailure(error);
    }
  }

  return {
    async initialize() {
      if (storageReady) return { ok: true };
      if (initializationPromise) return initializationPromise;
      if (initializationAttempted) {
        return rejectWhenUnavailable();
      }

      initializationAttempted = true;
      initializationPromise = (async () => {
        try {
          const storedTasks = await repository.list();
          if (!Array.isArray(storedTasks)) {
            throw new TypeError("TaskRepository list() must return an array.");
          }

          const loadedTasks = storedTasks.map(toLegacyTask);
          const ids = new Set();
          for (const task of loadedTasks) {
            if (ids.has(task.id)) {
              throw new TypeError(`Duplicate task id: ${task.id}.`);
            }
            ids.add(task.id);
          }

          tasks = loadedTasks;
          lastPersistedTasks = structuredClone(loadedTasks);
          storageError = null;
          storageReady = true;
          return { ok: true };
        } catch (error) {
          return storageFailure(error);
        }
      })();

      return initializationPromise;
    },

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
      return enqueueMutation(async () => {
        let task;
        try {
          task = createTask(details);
        } catch (error) {
          return { ok: false, kind: "validation", error };
        }
        return saveLegacyTask(task);
      });
    },

    update(id, changes) {
      return enqueueMutation(async () => {
        const currentTask = tasks.find((task) => task.id === id);
        if (!currentTask) return { ok: false, kind: "not-found" };

        let updatedTask;
        try {
          updatedTask = updateTask(currentTask, changes);
        } catch (error) {
          return { ok: false, kind: "validation", error };
        }
        return saveLegacyTask(updatedTask, id);
      });
    },

    toggle(id, done) {
      return this.update(id, { done });
    },

    remove(id) {
      return enqueueMutation(async () => {
        const taskExists = tasks.some((task) => task.id === id);
        if (!taskExists) return { ok: false, kind: "not-found" };

        try {
          const deleted = await repository.delete(id);
          if (!deleted) return { ok: false, kind: "not-found" };

          tasks = tasks.filter((task) => task.id !== id);
          lastPersistedTasks = structuredClone(tasks);
          return { ok: true };
        } catch (error) {
          tasks = structuredClone(lastPersistedTasks);
          return storageFailure(error);
        }
      });
    }
  };
}
