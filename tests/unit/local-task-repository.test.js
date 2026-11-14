import test from "node:test";
import assert from "node:assert/strict";
import { createTask } from "../../src/domain/tasks/task.js";
import { createLocalTaskRepository } from "../../src/infrastructure/storage/local-task-repository.js";

const fixedNow = "2026-11-14T10:00:00.000Z";

function task(id, overrides = {}) {
  return createTask({
    id,
    title: `Task ${id}`,
    createdAt: fixedNow,
    updatedAt: fixedNow,
    ...overrides
  }, { now: fixedNow });
}

function createMemoryRepository(initialTasks = []) {
  let stored = structuredClone(initialTasks);
  const repository = createLocalTaskRepository({
    loadTasks: () => structuredClone(stored),
    saveTasks: (tasks) => {
      stored = structuredClone(tasks);
    }
  });
  return {
    repository,
    readStored: () => structuredClone(stored)
  };
}

test("returns null when a task id does not exist", async () => {
  const { repository } = createMemoryRepository();
  assert.equal(await repository.getById("missing"), null);
});

test("gets a task by id without exposing the stored object", async () => {
  const original = task("task-1");
  const { repository } = createMemoryRepository([original]);

  const result = await repository.getById("task-1");
  result.title = "Changed outside";

  assert.equal((await repository.getById("task-1")).title, original.title);
});

test("lists all tasks as independent copies", async () => {
  const { repository } = createMemoryRepository([task("task-1"), task("task-2")]);

  const result = await repository.list();
  assert.deepEqual(result.map((item) => item.id), ["task-1", "task-2"]);
  result[0].title = "Changed outside";
  assert.equal((await repository.getById("task-1")).title, "Task task-1");
});

test("filters tasks by supported query fields", async () => {
  const tasks = [
    task("task-1", { projectId: "project-1", status: "todo", priority: "high" }),
    task("task-2", { projectId: "project-2", status: "todo", priority: "low" }),
    task("task-3", { projectId: "project-1", status: "completed", progress: 100 })
  ];
  const { repository } = createMemoryRepository(tasks);

  const result = await repository.list({ projectId: "project-1", status: "todo" });
  assert.deepEqual(result.map((item) => item.id), ["task-1"]);
});

test("rejects unsupported list filters", async () => {
  const { repository } = createMemoryRepository();
  await assert.rejects(
    repository.list({ unknownField: "value" }),
    /Unsupported TaskRepository list filter/
  );
});

test("lists only tasks associated with the requested project", async () => {
  const tasks = [
    task("task-1", { projectId: "project-1" }),
    task("task-2", { projectId: "project-2" }),
    task("task-3")
  ];
  const { repository } = createMemoryRepository(tasks);

  assert.deepEqual(
    (await repository.listByProjectId("project-1")).map((item) => item.id),
    ["task-1"]
  );
});

test("inserts a new task and persists the complete collection", async () => {
  const existing = task("task-1");
  const added = task("task-2");
  const { repository, readStored } = createMemoryRepository([existing]);

  assert.deepEqual(await repository.save(added), added);
  assert.deepEqual(readStored(), [existing, added]);
});

test("updates an existing task instead of creating a duplicate", async () => {
  const original = task("task-1");
  const updated = { ...original, title: "Updated title" };
  const { repository, readStored } = createMemoryRepository([original]);

  await repository.save(updated);

  assert.equal(readStored().length, 1);
  assert.equal(readStored()[0].title, "Updated title");
});

test("rejects an invalid task without writing", async () => {
  let writeCount = 0;
  const repository = createLocalTaskRepository({
    loadTasks: () => [],
    saveTasks: () => { writeCount += 1; }
  });

  await assert.rejects(
    repository.save({ id: "broken", title: "Incomplete" }),
    /Task/
  );
  assert.equal(writeCount, 0);
});

test("rejects invalid ids and project ids", async () => {
  const { repository } = createMemoryRepository();

  await assert.rejects(repository.getById(" "), /id must be a non-empty string/);
  await assert.rejects(
    repository.listByProjectId(" "),
    /projectId must be a non-empty string/
  );
});

test("propagates storage read and write failures", async () => {
  const readFailure = createLocalTaskRepository({
    loadTasks: () => { throw new Error("read failed"); },
    saveTasks: () => {}
  });
  await assert.rejects(readFailure.list(), /read failed/);

  const writeFailure = createLocalTaskRepository({
    loadTasks: () => [],
    saveTasks: () => { throw new Error("write failed"); }
  });
  await assert.rejects(writeFailure.save(task("task-1")), /write failed/);
});
