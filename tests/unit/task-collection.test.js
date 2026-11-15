import test from "node:test";
import assert from "node:assert/strict";
import { createTask } from "../../src/domain/tasks/task.js";
import { createTaskCollection } from "../../src/application/tasks/task-collection.js";

function task(id, title = id) {
  return createTask({ id, title });
}

function memoryRepository(initialTasks = [], overrides = {}) {
  let stored = structuredClone(initialTasks);
  const calls = { list: 0, save: 0, delete: 0 };
  const repository = {
    async getById(id) {
      const found = stored.find((item) => item.id === id);
      return found ? structuredClone(found) : null;
    },
    async list() {
      calls.list += 1;
      return structuredClone(stored);
    },
    async listByProjectId(projectId) {
      return stored.filter((item) => item.projectId === projectId);
    },
    async save(value) {
      calls.save += 1;
      const index = stored.findIndex((item) => item.id === value.id);
      if (index < 0) stored.push(structuredClone(value));
      else stored[index] = structuredClone(value);
      return structuredClone(value);
    },
    async delete(id) {
      calls.delete += 1;
      const index = stored.findIndex((item) => item.id === id);
      if (index < 0) return false;
      stored.splice(index, 1);
      return true;
    }
  };
  return {
    repository: { ...repository, ...overrides },
    calls,
    read() { return structuredClone(stored); }
  };
}

function collection(store, overrides = {}) {
  return createTaskCollection({
    taskRepository: store.repository,
    createTask: (details) => ({ ...task("created-1", details.title), ...details, id: "created-1" }),
    ...overrides
  });
}

test("requires a valid TaskRepository", () => {
  assert.throws(() => createTaskCollection(), /TaskRepository must be an object/);
  assert.throws(
    () => createTaskCollection({ taskRepository: { list() {} } }),
    /TaskRepository requires a getById\(\) function/
  );
});

test("starts unavailable and initializes from the repository", async () => {
  const store = memoryRepository([task("task-1", "کار قبلی")]);
  const subject = collection(store);
  assert.equal(subject.isStorageReady(), false);
  assert.deepEqual(subject.getTasks(), []);
  assert.deepEqual(await subject.initialize(), { ok: true });
  assert.equal(subject.isStorageReady(), true);
  assert.equal(subject.getTasks()[0].title, "کار قبلی");
  assert.equal(subject.getTasks()[0].done, false);
  assert.equal(store.calls.list, 1);
});

test("shares one in-flight initialization request", async () => {
  let resolveList;
  let calls = 0;
  const store = memoryRepository();
  const repository = {
    ...store.repository,
    list() {
      calls += 1;
      return new Promise((resolve) => { resolveList = resolve; });
    }
  };
  const subject = createTaskCollection({ taskRepository: repository });
  const first = subject.initialize();
  const second = subject.initialize();
  assert.equal(calls, 1);
  resolveList([]);
  assert.deepEqual(await first, { ok: true });
  assert.deepEqual(await second, { ok: true });
});

test("locks mutations before initialization", async () => {
  const store = memoryRepository();
  const subject = collection(store);
  const result = await subject.create({ title: "نباید ساخته شود" });
  assert.equal(result.kind, "storage");
  assert.equal(store.calls.save, 0);
});

test("locks the collection when initial loading fails", async () => {
  const error = new Error("read blocked");
  const store = memoryRepository([], { async list() { throw error; } });
  const subject = collection(store);
  const result = await subject.initialize();
  assert.equal(result.kind, "storage");
  assert.equal(result.error, error);
  assert.equal(subject.getStorageError(), error);
  assert.equal(subject.isStorageReady(), false);
  assert.equal((await subject.create({ title: "کار" })).error, error);
});

test("rejects invalid list results and duplicate task ids", async () => {
  const invalid = collection(memoryRepository([], { async list() { return null; } }));
  assert.equal((await invalid.initialize()).kind, "storage");
  const duplicate = task("same");
  const repeated = collection(memoryRepository([duplicate, duplicate]));
  assert.match((await repeated.initialize()).error.message, /Duplicate task id/);
});

test("creates and persists a task through the repository", async () => {
  const store = memoryRepository();
  const subject = collection(store);
  await subject.initialize();
  assert.deepEqual(await subject.create({ title: "کار تازه" }), { ok: true });
  assert.equal(subject.getTasks()[0].title, "کار تازه");
  assert.equal(store.read()[0].title, "کار تازه");
  assert.equal(store.calls.save, 1);
});

test("updates and toggles tasks by id", async () => {
  const store = memoryRepository([task("task-1", "قدیمی")]);
  const subject = collection(store);
  await subject.initialize();
  assert.deepEqual(await subject.update("task-1", { title: "تازه" }), { ok: true });
  assert.equal(subject.getTasks()[0].title, "تازه");
  assert.deepEqual(await subject.toggle("task-1", true), { ok: true });
  assert.equal(subject.getTasks()[0].done, true);
  assert.equal(store.read()[0].status, "completed");
});

test("returns validation and not-found results without writing", async () => {
  const store = memoryRepository([task("task-1")]);
  const subject = collection(store, { updateTask() { throw new Error("invalid update"); } });
  await subject.initialize();
  assert.equal((await subject.update("task-1", {})).kind, "validation");
  assert.equal((await subject.update("missing", {})).kind, "not-found");
  assert.equal(store.calls.save, 0);
});

test("removes an existing task and handles a missing task", async () => {
  const store = memoryRepository([task("task-1")]);
  const subject = collection(store);
  await subject.initialize();
  assert.deepEqual(await subject.remove("task-1"), { ok: true });
  assert.deepEqual(subject.getTasks(), []);
  assert.equal(store.calls.delete, 1);
  assert.equal((await subject.remove("task-1")).kind, "not-found");
});

test("preserves the confirmed snapshot and locks after save failure", async () => {
  const error = new Error("write blocked");
  const store = memoryRepository([task("task-1", "مطمئن")], { async save() { throw error; } });
  const subject = collection(store);
  await subject.initialize();
  const result = await subject.create({ title: "ذخیره‌نشده" });
  assert.equal(result.kind, "storage");
  assert.equal(result.error, error);
  assert.equal(subject.getTasks()[0].title, "مطمئن");
  assert.equal(subject.isStorageReady(), false);
  assert.equal((await subject.remove("task-1")).kind, "storage");
});

test("preserves the confirmed snapshot and locks after delete failure", async () => {
  const error = new Error("delete blocked");
  const store = memoryRepository([task("task-1", "مطمئن")], { async delete() { throw error; } });
  const subject = collection(store);
  await subject.initialize();
  const result = await subject.remove("task-1");
  assert.equal(result.kind, "storage");
  assert.equal(result.error, error);
  assert.equal(subject.getTasks()[0].title, "مطمئن");
  assert.equal(subject.isStorageReady(), false);
});

test("serializes concurrent mutations without losing updates", async () => {
  const store = memoryRepository([task("task-1", "اول")]);
  const subject = collection(store);
  await subject.initialize();
  const first = subject.update("task-1", { title: "دوم" });
  const second = subject.update("task-1", { description: "توضیح" });
  assert.deepEqual(await Promise.all([first, second]), [{ ok: true }, { ok: true }]);
  assert.equal(subject.getTasks()[0].title, "دوم");
  assert.equal(subject.getTasks()[0].description, "توضیح");
  assert.equal(store.read()[0].description, "توضیح");
  assert.equal(store.calls.save, 2);
});

test("returns defensive task snapshots", async () => {
  const subject = collection(memoryRepository([task("task-1", "اصلی")]));
  await subject.initialize();
  const snapshot = subject.getTasks();
  snapshot[0].title = "دست‌کاری‌شده";
  assert.equal(subject.getTasks()[0].title, "اصلی");
});
