import test from "node:test";
import assert from "node:assert/strict";
import {
  fromLegacyTask,
  toLegacyTask,
  fromLegacyTasks,
  toLegacyTasks
} from "../../src/domain/tasks/legacy-task-adapter.js";

const fixedNow = "2026-11-11T10:00:00.000Z";

test("maps a current prototype task to the canonical domain model", () => {
  const task = fromLegacyTask({
    id: "legacy-1",
    title: "مطالعه",
    date: "2026-11-12",
    time: "09:30",
    priority: "high",
    category: "study",
    done: false
  }, { now: fixedNow });

  assert.equal(task.id, "legacy-1");
  assert.equal(task.plannedDate, "2026-11-12");
  assert.equal(task.startTime, "09:30");
  assert.equal(task.categoryId, "study");
  assert.equal(task.status, "todo");
});

test("maps empty legacy date and time values to null", () => {
  const task = fromLegacyTask({
    id: "legacy-2",
    title: "بدون زمان",
    date: "",
    time: ""
  }, { now: fixedNow });

  assert.equal(task.plannedDate, null);
  assert.equal(task.startTime, null);
});

test("maps a completed legacy task to the canonical completed status", () => {
  const task = fromLegacyTask({
    id: "legacy-3",
    title: "تمام‌شده",
    done: true
  }, { now: fixedNow });

  assert.equal(task.status, "completed");
  assert.equal(task.progress, 100);
});

test("maps a canonical task back to the current UI field names", () => {
  const legacy = toLegacyTask(fromLegacyTask({
    id: "legacy-4",
    title: "دانشگاه",
    date: "2026-11-13",
    time: "08:00",
    priority: "medium",
    category: "university",
    done: true
  }, { now: fixedNow }));

  assert.deepEqual(legacy, {
    id: "legacy-4",
    title: "دانشگاه",
    date: "2026-11-13",
    time: "08:00",
    priority: "medium",
    category: "university",
    done: true
  });
});

test("keeps an empty date and time as empty strings in the legacy UI view", () => {
  const legacy = toLegacyTask(fromLegacyTask({
    id: "legacy-5",
    title: "بدون زمان"
  }, { now: fixedNow }));

  assert.equal(legacy.date, "");
  assert.equal(legacy.time, "");
});

test("converts task collections in both directions", () => {
  const legacyTasks = [
    { id: "legacy-6", title: "اول", done: false },
    { id: "legacy-7", title: "دوم", done: true }
  ];

  const canonical = fromLegacyTasks(legacyTasks, { now: fixedNow });
  const roundTrip = toLegacyTasks(canonical);

  assert.deepEqual(roundTrip, legacyTasks.map((task) => ({
    id: task.id,
    title: task.title,
    date: "",
    time: "",
    priority: "medium",
    category: "personal",
    done: task.done
  })));
});

test("rejects a non-array task collection", () => {
  assert.throws(() => fromLegacyTasks({}), /must be an array/);
  assert.throws(() => toLegacyTasks({}), /must be an array/);
});
