import test from "node:test";
import assert from "node:assert/strict";
import { createTaskCollection } from "../../src/application/tasks/task-collection.js";

function createMemoryStore(initialTasks = []) {
  let storedTasks = structuredClone(initialTasks);
  return {
    loadTasks() {
      return structuredClone(storedTasks);
    },
    saveTasks(tasks) {
      storedTasks = structuredClone(tasks);
    },
    readStoredTasks() {
      return structuredClone(storedTasks);
    }
  };
}

function createCollection(store, overrides = {}) {
  return createTaskCollection({
    loadTasks: store.loadTasks,
    saveTasks: store.saveTasks,
    createTask: (details) => ({ id: "created-1", ...details }),
    updateTask: (task, changes) => ({ ...task, ...changes }),
    ...overrides
  });
}

test("requires explicit storage dependencies", () => {
  assert.throws(
    () => createTaskCollection(),
    {
      name: "TypeError",
      message: "Task collection requires loadTasks and saveTasks functions."
    }
  );

  assert.throws(
    () => createTaskCollection({ loadTasks() { return []; } }),
    /requires loadTasks and saveTasks functions/
  );
});

test("loads the initial task collection", () => {
  const initial = [{ id: "task-1", title: "کار قبلی" }];
  const store = createMemoryStore(initial);
  const collection = createCollection(store);

  assert.deepEqual(collection.getTasks(), initial);
  assert.equal(collection.isStorageReady(), true);
});

test("creates a task and persists it at the beginning of the collection", () => {
  const initial = [{ id: "task-1", title: "کار قبلی" }];
  const store = createMemoryStore(initial);
  const collection = createCollection(store);

  const result = collection.create({ title: "کار تازه" });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(collection.getTasks(), [
    { id: "created-1", title: "کار تازه" },
    ...initial
  ]);
  assert.deepEqual(store.readStoredTasks(), collection.getTasks());
});

test("updates and toggles tasks by id", () => {
  const initial = [{ id: "task-1", title: "عنوان قبلی", done: false }];
  const store = createMemoryStore(initial);
  const collection = createCollection(store);

  assert.deepEqual(collection.update("task-1", { title: "عنوان تازه" }), { ok: true });
  assert.equal(collection.getTasks()[0].title, "عنوان تازه");

  assert.deepEqual(collection.toggle("task-1", true), { ok: true });
  assert.equal(collection.getTasks()[0].done, true);
  assert.deepEqual(store.readStoredTasks(), collection.getTasks());
});

test("removes a task and persists the remaining collection", () => {
  const initial = [
    { id: "task-1", title: "حذف‌شدنی" },
    { id: "task-2", title: "باقی‌مانده" }
  ];
  const store = createMemoryStore(initial);
  const collection = createCollection(store);

  assert.deepEqual(collection.remove("task-1"), { ok: true });
  assert.deepEqual(collection.getTasks(), [initial[1]]);
  assert.deepEqual(store.readStoredTasks(), [initial[1]]);
});

test("restores saved tasks and locks further changes after a persistence failure", () => {
  const initial = [{ id: "task-1", title: "نسخهٔ ذخیره‌شده" }];
  const store = createMemoryStore(initial);
  const collection = createCollection(store, {
    saveTasks() {
      throw new Error("write blocked");
    }
  });

  const result = collection.create({ title: "ذخیره‌نشده" });

  assert.equal(result.ok, false);
  assert.equal(result.kind, "storage");
  assert.match(result.error.message, /write blocked/);
  assert.deepEqual(collection.getTasks(), initial);
  assert.equal(collection.isStorageReady(), false);
  assert.equal(collection.create({ title: "کار دیگر" }).ok, false);
});

test("locks changes when the initial task data cannot be loaded", () => {
  const error = new Error("read blocked");
  const collection = createTaskCollection({
    loadTasks() {
      throw error;
    },
    saveTasks() {
      assert.fail("storage must not be written when loading failed");
    }
  });

  assert.deepEqual(collection.getTasks(), []);
  assert.equal(collection.isStorageReady(), false);
  assert.equal(collection.getStorageError(), error);
  assert.equal(collection.create({ title: "کار تازه" }).error, error);
});

test("does not change the collection when task validation fails", () => {
  const initial = [{ id: "task-1", title: "کار قبلی" }];
  const store = createMemoryStore(initial);
  const collection = createCollection(store, {
    createTask() {
      throw new Error("invalid task");
    }
  });

  const result = collection.create({ title: "" });

  assert.equal(result.ok, false);
  assert.equal(result.kind, "validation");
  assert.match(result.error.message, /invalid task/);
  assert.deepEqual(collection.getTasks(), initial);
  assert.deepEqual(store.readStoredTasks(), initial);
});

test("returns a validation failure when updating a task is invalid", () => {
  const initial = [{ id: "task-1", title: "کار قبلی" }];
  const store = createMemoryStore(initial);
  const collection = createCollection(store, {
    updateTask() {
      throw new Error("invalid update");
    }
  });

  const result = collection.update("task-1", { title: "" });

  assert.equal(result.ok, false);
  assert.equal(result.kind, "validation");
  assert.match(result.error.message, /invalid update/);
  assert.deepEqual(collection.getTasks(), initial);
  assert.deepEqual(store.readStoredTasks(), initial);
});

test("returns a not-found result when updating an unknown task", () => {
  const store = createMemoryStore();
  const collection = createCollection(store);

  assert.deepEqual(collection.update("missing", { title: "عنوان" }), {
    ok: false,
    kind: "not-found"
  });
});

test("returns a snapshot that cannot mutate the internal collection", () => {
  const initial = [{ id: "task-1", title: "عنوان اصلی" }];
  const store = createMemoryStore(initial);
  const collection = createCollection(store);

  const snapshot = collection.getTasks();
  snapshot[0].title = "عنوان دست‌کاری‌شده";
  snapshot.push({ id: "task-2", title: "وظیفهٔ جعلی" });

  assert.deepEqual(collection.getTasks(), initial);
  assert.deepEqual(store.readStoredTasks(), initial);
});


test("returns a not-found result when removing an unknown task", () => {
  const initial = [{ id: "task-1", title: "کار موجود" }];
  const store = createMemoryStore(initial);
  const collection = createCollection(store);

  const result = collection.remove("missing");

  assert.deepEqual(result, { ok: false, kind: "not-found" });
  assert.deepEqual(collection.getTasks(), initial);
  assert.deepEqual(store.readStoredTasks(), initial);
});

test("restores the collection when removing a task cannot be persisted", () => {
  const initial = [{ id: "task-1", title: "کار موجود" }];
  const store = createMemoryStore(initial);
  const collection = createCollection(store, {
    saveTasks() {
      throw new Error("delete write blocked");
    }
  });

  const result = collection.remove("task-1");

  assert.equal(result.ok, false);
  assert.equal(result.kind, "storage");
  assert.match(result.error.message, /delete write blocked/);
  assert.deepEqual(collection.getTasks(), initial);
  assert.deepEqual(store.readStoredTasks(), initial);
  assert.equal(collection.isStorageReady(), false);
});
