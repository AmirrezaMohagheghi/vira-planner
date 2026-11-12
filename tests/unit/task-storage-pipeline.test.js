import test from "node:test";
import assert from "node:assert/strict";
import { createTaskCollection } from "../../src/application/tasks/task-collection.js";
import {
  fromLegacyTasks,
  toLegacyTasks
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

test("migrates legacy storage and round-trips collection changes through the canonical model", () => {
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

  function loadForCollection() {
    const canonical = fromLegacyTasks(loadTasks(storage));
    migrateLegacyTasks(canonical, storage);
    return toLegacyTasks(canonical);
  }

  function saveFromCollection(tasks) {
    saveTasks(fromLegacyTasks(tasks), storage);
  }

  const collection = createTaskCollection({
    loadTasks: loadForCollection,
    saveTasks: saveFromCollection
  });

  assert.equal(collection.isStorageReady(), true);
  assert.equal(collection.getTasks()[0].plannedDate, "2026-11-12");
  assert.equal(collection.getTasks()[0].importedLabel, "preserve-me");
  assert.equal(storage.getItem(taskStorageKeys.backup), legacyRaw);

  const update = collection.update("legacy-1", { title: "عنوان به‌روزشده" });
  assert.deepEqual(update, { ok: true });

  const envelope = JSON.parse(storage.getItem(taskStorageKeys.current));
  assert.equal(envelope.schemaVersion, 2);
  assert.equal(envelope.tasks[0].title, "عنوان به‌روزشده");
  assert.equal(envelope.tasks[0].plannedDate, "2026-11-12");
  assert.equal(envelope.tasks[0].importedLabel, "preserve-me");
  assert.equal(Object.hasOwn(envelope.tasks[0], "date"), false);

  const reloadedCanonical = loadTasks(storage);
  assert.equal(reloadedCanonical[0].title, "عنوان به‌روزشده");
  assert.equal(reloadedCanonical[0].plannedDate, "2026-11-12");
  assert.equal(reloadedCanonical[0].importedLabel, "preserve-me");
});
