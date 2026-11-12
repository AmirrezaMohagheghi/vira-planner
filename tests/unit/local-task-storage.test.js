import test from "node:test";
import assert from "node:assert/strict";
import { createTask } from "../../src/domain/tasks/task.js";
import {
  loadTasks,
  saveTasks,
  migrateLegacyTasks,
  restoreTasksFromBackup,
  TaskStorageError,
  taskStorageKeys
} from "../../src/infrastructure/storage/local-task-storage.js";

const fixedNow = "2026-11-11T10:00:00.000Z";

class FakeStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial));
    this.failOnSet = null;
    this.corruptNextCurrentWrite = false;
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    if (this.failOnSet === key) throw new Error("write blocked");
    if (key === taskStorageKeys.current && this.corruptNextCurrentWrite) {
      this.corruptNextCurrentWrite = false;
      this.values.set(key, "{corrupt-after-write");
      return;
    }
    this.values.set(key, String(value));
  }
}

function canonicalTask(id, title = "عنوان") {
  return createTask({
    id,
    title,
    createdAt: fixedNow,
    updatedAt: fixedNow
  }, { now: fixedNow });
}

test("returns an empty list when no saved data exists", () => {
  assert.deepEqual(loadTasks(new FakeStorage()), []);
});

test("reads the version-one raw array without modifying it", () => {
  const legacy = [{ id: "legacy-1", title: "کار قدیمی", done: false }];
  const raw = JSON.stringify(legacy);
  const storage = new FakeStorage({ [taskStorageKeys.current]: raw });

  assert.deepEqual(loadTasks(storage), legacy);
  assert.equal(storage.getItem(taskStorageKeys.current), raw);
});

test("writes and reads canonical tasks inside the versioned envelope", () => {
  const tasks = [canonicalTask("task-1")];
  const storage = new FakeStorage();

  saveTasks(tasks, storage);

  assert.deepEqual(JSON.parse(storage.getItem(taskStorageKeys.current)), {
    schemaVersion: 2,
    tasks
  });
  assert.deepEqual(loadTasks(storage), tasks);
});

test("rejects corrupted JSON without changing the original value", () => {
  const storage = new FakeStorage({ [taskStorageKeys.current]: "{broken" });
  assert.throws(
    () => loadTasks(storage),
    (error) => error instanceof TaskStorageError && error.code === "CORRUPT_JSON"
  );
  assert.equal(storage.getItem(taskStorageKeys.current), "{broken");
});

test("rejects an invalid top-level structure instead of silently clearing it", () => {
  const original = JSON.stringify({ task: "not an array" });
  const storage = new FakeStorage({ [taskStorageKeys.current]: original });
  assert.throws(
    () => loadTasks(storage),
    (error) => error instanceof TaskStorageError && error.code === "INVALID_DATA"
  );
  assert.equal(storage.getItem(taskStorageKeys.current), original);
});

test("does not overwrite a schema version it does not understand", () => {
  const original = JSON.stringify({ schemaVersion: 99, tasks: [] });
  const storage = new FakeStorage({ [taskStorageKeys.current]: original });

  assert.throws(
    () => loadTasks(storage),
    (error) => error instanceof TaskStorageError &&
      error.code === "UNSUPPORTED_SCHEMA_VERSION"
  );
  assert.equal(storage.getItem(taskStorageKeys.current), original);
});

test("rejects incomplete canonical tasks before writing", () => {
  const storage = new FakeStorage();
  assert.throws(
    () => saveTasks([{ id: "partial", title: "ناقص" }], storage),
    (error) => error instanceof TaskStorageError && error.code === "INVALID_TASK"
  );
  assert.equal(storage.getItem(taskStorageKeys.current), null);
});

test("rejects duplicate task ids before writing", () => {
  const storage = new FakeStorage();
  assert.throws(
    () => saveTasks([
      canonicalTask("duplicate", "اول"),
      canonicalTask("duplicate", "دوم")
    ], storage),
    (error) => error instanceof TaskStorageError &&
      error.code === "DUPLICATE_TASK_ID"
  );
  assert.equal(storage.getItem(taskStorageKeys.current), null);
});

test("creates an exact backup before replacing previously saved tasks", () => {
  const oldRaw = JSON.stringify([{ id: "old-1", title: "کار قبلی" }]);
  const storage = new FakeStorage({ [taskStorageKeys.current]: oldRaw });

  saveTasks([canonicalTask("new-1", "کار تازه")], storage);

  assert.equal(storage.getItem(taskStorageKeys.backup), oldRaw);
  assert.deepEqual(loadTasks(storage), [canonicalTask("new-1", "کار تازه")]);
});

test("does not replace current data when backup creation fails", () => {
  const oldRaw = JSON.stringify([{ id: "old-1", title: "کار قبلی" }]);
  const storage = new FakeStorage({ [taskStorageKeys.current]: oldRaw });
  storage.failOnSet = taskStorageKeys.backup;

  assert.throws(
    () => saveTasks([canonicalTask("new-1")], storage),
    (error) => error instanceof TaskStorageError && error.code === "WRITE_FAILED"
  );
  assert.equal(storage.getItem(taskStorageKeys.current), oldRaw);
});

test("restores the previous raw value if read-back verification fails", () => {
  const oldRaw = JSON.stringify([{ id: "old-1", title: "نسخهٔ قبلی" }]);
  const storage = new FakeStorage({ [taskStorageKeys.current]: oldRaw });
  storage.corruptNextCurrentWrite = true;

  assert.throws(
    () => saveTasks([canonicalTask("new-1")], storage),
    (error) => error instanceof TaskStorageError && error.code === "VERIFY_FAILED"
  );
  assert.equal(storage.getItem(taskStorageKeys.current), oldRaw);
  assert.equal(storage.getItem(taskStorageKeys.backup), oldRaw);
});

test("migrates a legacy array only after the application supplies normalized tasks", () => {
  const oldTasks = [{ id: "legacy-1", title: "کار قدیمی", done: false }];
  const oldRaw = JSON.stringify(oldTasks);
  const storage = new FakeStorage({ [taskStorageKeys.current]: oldRaw });
  const migrated = [canonicalTask("legacy-1", "کار قدیمی")];

  assert.equal(migrateLegacyTasks(migrated, storage), true);
  assert.equal(storage.getItem(taskStorageKeys.backup), oldRaw);
  assert.deepEqual(loadTasks(storage), migrated);
  assert.equal(migrateLegacyTasks(migrated, storage), false);
});

test("restores a verified backup and keeps a separate pre-restore copy", () => {
  const original = [canonicalTask("original", "نسخهٔ اصلی")];
  const changed = [canonicalTask("changed", "نسخهٔ جدید")];
  const storage = new FakeStorage();

  saveTasks(original, storage);
  const originalEnvelope = storage.getItem(taskStorageKeys.current);
  saveTasks(changed, storage);

  assert.deepEqual(loadTasks(storage), changed);
  assert.deepEqual(restoreTasksFromBackup(storage), original);
  assert.equal(storage.getItem(taskStorageKeys.current), originalEnvelope);
  assert.notEqual(storage.getItem(taskStorageKeys.restoreRollback), null);
});

test("reports a missing backup without changing current data", () => {
  const current = JSON.stringify({ schemaVersion: 2, tasks: [] });
  const storage = new FakeStorage({ [taskStorageKeys.current]: current });

  assert.throws(
    () => restoreTasksFromBackup(storage),
    (error) => error instanceof TaskStorageError &&
      error.code === "BACKUP_NOT_FOUND"
  );
  assert.equal(storage.getItem(taskStorageKeys.current), current);
});
