import test from "node:test";
import assert from "node:assert/strict";
import { createTask, updateTask, validateTask } from "../../src/domain/tasks/task.js";

const fixedNow = "2026-11-11T10:00:00.000Z";

function makeTask(overrides = {}) {
  return createTask({
    id: "task-1",
    title: "کار آزمایشی",
    ...overrides
  }, { now: fixedNow });
}

test("uses consistent default progress for every status", () => {
  assert.deepEqual(
    ["todo", "in_progress", "completed", "cancelled"].map((status) =>
      makeTask({ status }).progress
    ),
    [0, 1, 100, 0]
  );
});

test("rejects inconsistent todo, in-progress, and completed values", () => {
  assert.throws(() => makeTask({ status: "todo", progress: 25 }), /inconsistent/);
  assert.throws(() => makeTask({ status: "in_progress", progress: 0 }), /inconsistent/);
  assert.throws(() => makeTask({ status: "in_progress", progress: 100 }), /inconsistent/);
  assert.throws(() => makeTask({ status: "completed", progress: 50 }), /inconsistent/);
});

test("accepts cancelled tasks while preserving their progress", () => {
  assert.equal(makeTask({ status: "cancelled", progress: 65 }).progress, 65);
});

test("changing status updates progress to a compatible value", () => {
  const task = makeTask();
  assert.equal(updateTask(task, { status: "in_progress" }).progress, 1);
  assert.equal(updateTask(task, { status: "completed" }).progress, 100);
  assert.equal(updateTask(task, { status: "todo" }).progress, 0);
});

test("changing progress derives the matching active status", () => {
  const task = makeTask();
  assert.equal(updateTask(task, { progress: 0 }).status, "todo");
  assert.equal(updateTask(task, { progress: 45 }).status, "in_progress");
  assert.equal(updateTask(task, { progress: 100 }).status, "completed");
});

test("rejects inconsistent task objects at validation boundary", () => {
  const task = makeTask();
  assert.throws(
    () => validateTask({ ...task, status: "completed", progress: 99 }),
    /inconsistent/
  );
});

test("legacy done defaults remain compatible", () => {
  assert.equal(makeTask({ done: true }).status, "completed");
  assert.equal(makeTask({ done: true }).progress, 100);
  assert.equal(makeTask({ done: false }).status, "todo");
  assert.equal(makeTask({ done: false }).progress, 0);
});
