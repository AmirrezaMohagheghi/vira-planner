import test from "node:test";
import assert from "node:assert/strict";
import { createTask, updateTask, validateTask } from "../../src/domain/tasks/task.js";

const fixedNow = "2026-11-11T10:00:00.000Z";

test("creates a task with safe defaults", () => {
  const task = createTask(
    { id: "task-1", title: "مطالعه" },
    { now: fixedNow }
  );

  assert.equal(task.title, "مطالعه");
  assert.equal(task.status, "todo");
  assert.equal(task.progress, 0);
  assert.equal(task.priority, "medium");
  assert.equal(task.plannedDate, null);
  assert.equal(task.createdAt, fixedNow);
  assert.deepEqual(task.dependencyIds, []);
});

test("accepts the current prototype date and time fields as input aliases", () => {
  const task = createTask(
    { id: "task-2", title: "کلاس", date: "2026-11-12", time: "09:30", category: "university" },
    { now: fixedNow }
  );

  assert.equal(task.plannedDate, "2026-11-12");
  assert.equal(task.startTime, "09:30");
  assert.equal(task.categoryId, "university");
});

test("maps a completed legacy task to completed status", () => {
  const task = createTask(
    { id: "task-3", title: "تمام‌شده", done: true },
    { now: fixedNow }
  );

  assert.equal(task.status, "completed");
  assert.equal(task.progress, 100);
});

test("rejects invalid calendar dates", () => {
  assert.throws(
    () => createTask({ id: "task-4", title: "تاریخ نادرست", plannedDate: "2026-02-30" }, { now: fixedNow }),
    /valid ISO date/
  );
});

test("rejects an end time that is not after the start time", () => {
  assert.throws(
    () => createTask({ id: "task-5", title: "زمان نادرست", startTime: "12:00", endTime: "11:00" }, { now: fixedNow }),
    /later than startTime/
  );
});

test("rejects a non-positive duration", () => {
  assert.throws(
    () => createTask({ id: "task-6", title: "مدت نادرست", durationMinutes: 0 }, { now: fixedNow }),
    /positive integer/
  );
});

test("updates completion status and progress consistently", () => {
  const task = createTask({ id: "task-7", title: "کار" }, { now: fixedNow });
  const completed = updateTask(task, { status: "completed" }, { now: "2026-11-11T11:00:00.000Z" });

  assert.equal(completed.status, "completed");
  assert.equal(completed.progress, 100);
  assert.equal(completed.updatedAt, "2026-11-11T11:00:00.000Z");
});

test("updates progress and derives the matching status", () => {
  const task = createTask({ id: "task-8", title: "کار" }, { now: fixedNow });
  const inProgress = updateTask(task, { progress: 35 }, { now: fixedNow });

  assert.equal(inProgress.status, "in_progress");
  assert.equal(inProgress.progress, 35);
});

test("validates an already-created task", () => {
  const task = createTask({ id: "task-9", title: "کار" }, { now: fixedNow });
  assert.equal(validateTask(task), task);
});
