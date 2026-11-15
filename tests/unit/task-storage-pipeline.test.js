import test from "node:test";
import assert from "node:assert/strict";
import { createTaskCollection } from "../../src/application/tasks/task-collection.js";
import {
  fromLegacyTasks
} from "../../src/application/tasks/legacy-task-adapter.js";
import {
  loadTasks,
  saveTasks,
  migrateLegacyTasks,
  taskStorageKeys
} from "../../src/infrastructure/storage/local-task-storage.js";

class FakeStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial));
  }
  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }
  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

test("migrates legacy storage and round-trips collection changes through the canonical model", async () => {
  const legacyTasks = [{
    id: "legacy-1",
    title: "کار قدیمی",
    date: "2026-11-12",
    time: "09:30",
    priority: "high",
    category: "study",
    done: false,
    importedLabel: "preserve-me"
  }];
  const legacyRaw = JSON.stringify(legacyTasks);
  const storage = new FakeStorage({
    [taskStorageKeys.current]: legacyRaw
  });

  function loadCanonicalTasks() {
    const canonical = fromLegacyTasks(loadTasks(storage));
    migrateLegacyTasks(canonical, storage);
    return canonical;
  }

  const taskRepository = {
    async getById(id) {
      return loadCanonicalTasks().find((task) => task.id === id) ?? null;
    },
    async list() {
      return loadCanonicalTasks();
    },
    async listByProjectId(projectId) {
      return loadCanonicalTasks().filter((task) => task.projectId === projectId);
    },
    async save(task) {
      const tasks = loadCanonicalTasks();
      const index = tasks.findIndex((item) => item.id === task.id);
      if (index < 0) tasks.push(task);
      else tasks[index] = task;
      saveTasks(tasks, storage);
      return task;
    },
    async delete(id) {
      const tasks = loadCanonicalTasks();
      const remaining = tasks.filter((task) => task.id !== id);
      if (remaining.length === tasks.length) return false;
      saveTasks(remaining, storage);
      return true;
    }
  };

  const collection = createTaskCollection({ taskRepository });
  assert.equal(collection.isStorageReady(), false);
  assert.deepEqual(await collection.initialize(), { ok: true });
  assert.equal(collection.isStorageReady(), true);
  assert.equal(collection.getTasks()[0].plannedDate, "2026-11-12");
  assert.equal(collection.getTasks()[0].importedLabel, "preserve-me");
  assert.equal(storage.getItem(taskStorageKeys.backup), legacyRaw);

  const update = await collection.update("legacy-1", { title: "عنوان به‌روزشده" });
  assert.deepEqual(update, { ok: true });

  const envelope = JSON.parse(storage.getItem(taskStorageKeys.current));
  assert.equal(envelope.schemaVersion, 3);
  assert.equal(envelope.tasks[0].title, "عنوان به‌روزشده");
  assert.equal(envelope.tasks[0].plannedDate, "2026-11-12");
  assert.equal(envelope.tasks[0].importedLabel, "preserve-me");
  assert.equal(Object.hasOwn(envelope.tasks[0], "date"), false);

  const reloadedCanonical = loadTasks(storage);
  assert.equal(reloadedCanonical[0].title, "عنوان به‌روزشده");
  assert.equal(reloadedCanonical[0].plannedDate, "2026-11-12");
  assert.equal(reloadedCanonical[0].importedLabel, "preserve-me");
});
