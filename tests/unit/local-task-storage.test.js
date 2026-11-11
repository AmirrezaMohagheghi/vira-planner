import test from "node:test";
import assert from "node:assert/strict";
import {
  loadTasks,
  saveTasks,
  TaskStorageError,
  taskStorageKeys
} from "../../src/infrastructure/storage/local-task-storage.js";

class FakeStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial));
    this.failOnSet = null;
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    if (this.failOnSet === key) throw new Error("write blocked");
    this.values.set(key, String(value));
  }
}

test("returns an empty list when no saved data exists", () => {
  assert.deepEqual(loadTasks(new FakeStorage()), []);
});

test("rejects corrupted JSON without changing the original value", () => {
  const storage = new FakeStorage({ [taskStorageKeys.current]: "{broken" });
  assert.throws(
    () => loadTasks(storage),
    (error) => error instanceof TaskStorageError && error.code === "CORRUPT_JSON"
  );
  assert.equal(storage.getItem(taskStorageKeys.current), "{broken");
});

test("rejects an invalid data structure instead of silently clearing it", () => {
  const original = JSON.stringify({ task: "not an array" });
  const storage = new FakeStorage({ [taskStorageKeys.current]: original });
  assert.throws(
    () => loadTasks(storage),
    (error) => error instanceof TaskStorageError && error.code === "INVALID_DATA"
  );
  assert.equal(storage.getItem(taskStorageKeys.current), original);
});

test("creates a backup before replacing previously saved tasks", () => {
  const oldTasks = [{ id: "old-1", title: "کار قبلی" }];
  const newTasks = [{ id: "new-1", title: "کار تازه" }];
  const storage = new FakeStorage({
    [taskStorageKeys.current]: JSON.stringify(oldTasks)
  });

  saveTasks(newTasks, storage);

  assert.deepEqual(JSON.parse(storage.getItem(taskStorageKeys.backup)), oldTasks);
  assert.deepEqual(loadTasks(storage), newTasks);
});

test("does not replace current data when backup creation fails", () => {
  const oldRaw = JSON.stringify([{ id: "old-1", title: "کار قبلی" }]);
  const storage = new FakeStorage({ [taskStorageKeys.current]: oldRaw });
  storage.failOnSet = taskStorageKeys.backup;

  assert.throws(
    () => saveTasks([{ id: "new-1", title: "کار تازه" }], storage),
    (error) => error instanceof TaskStorageError && error.code === "WRITE_FAILED"
  );
  assert.equal(storage.getItem(taskStorageKeys.current), oldRaw);
});

test("rejects invalid task input before writing", () => {
  const storage = new FakeStorage();
  assert.throws(
    () => saveTasks([{ title: "بدون شناسه" }], storage),
    (error) => error instanceof TaskStorageError && error.code === "INVALID_TASK"
  );
  assert.equal(storage.getItem(taskStorageKeys.current), null);
});
