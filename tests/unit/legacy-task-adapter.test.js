import test from "node:test";
import assert from "node:assert/strict";
import {
  fromLegacyTask,
  toLegacyTask,
  fromLegacyTasks,
  toLegacyTasks
} from "../../src/application/tasks/legacy-task-adapter.js";

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

test("preserves all canonical fields when converting through the legacy shape", () => {
  const canonical = fromLegacyTask({
    id: "rich-1",
    title: "پروژه",
    description: "توضیحات کامل",
    plannedDate: "2026-11-12",
    startTime: "09:00",
    endTime: "10:30",
    durationMinutes: 90,
    deadline: "2026-11-15T12:00:00.000Z",
    priority: "high",
    categoryId: "study",
    status: "in_progress",
    progress: 45,
    dependencyIds: ["task-a"],
    parentTaskId: "parent-1",
    recurrenceRuleId: "weekly-1",
    reminderIds: ["reminder-1"],
    createdAt: fixedNow,
    updatedAt: fixedNow,
    source: "ai",
    version: 3
  }, { now: fixedNow });

  const storedShape = toLegacyTask(canonical);
  const restored = fromLegacyTask(storedShape, { now: fixedNow });

  assert.deepEqual(restored, canonical);
  assert.equal(storedShape.date, "2026-11-12");
  assert.equal(storedShape.time, "09:00");
  assert.equal(storedShape.done, false);
});

test("canonical fields take precedence over legacy aliases", () => {
  const task = fromLegacyTask({
    id: "mixed-1",
    title: "ترکیبی",
    date: "2026-11-12",
    plannedDate: "2026-11-13",
    time: "09:00",
    startTime: "10:00",
    category: "old-category",
    categoryId: "new-category",
    done: false,
    status: "completed",
    progress: 100
  }, { now: fixedNow });

  assert.equal(task.plannedDate, "2026-11-13");
  assert.equal(task.startTime, "10:00");
  assert.equal(task.categoryId, "new-category");
  assert.equal(task.status, "completed");
});

test("maps a canonical task back to legacy UI aliases", () => {
  const legacy = toLegacyTask(fromLegacyTask({
    id: "legacy-4",
    title: "دانشگاه",
    date: "2026-11-13",
    time: "08:00",
    priority: "medium",
    category: "university",
    done: true
  }, { now: fixedNow }));

  assert.equal(legacy.id, "legacy-4");
  assert.equal(legacy.date, "2026-11-13");
  assert.equal(legacy.time, "08:00");
  assert.equal(legacy.category, "university");
  assert.equal(legacy.done, true);
  assert.equal(legacy.status, "completed");
  assert.equal(legacy.progress, 100);
  assert.equal(legacy.version, 1);
});

test("keeps an empty date and time as empty strings in the legacy UI view", () => {
  const legacy = toLegacyTask(fromLegacyTask({
    id: "legacy-5",
    title: "بدون زمان"
  }, { now: fixedNow }));

  assert.equal(legacy.date, "");
  assert.equal(legacy.time, "");
  assert.equal(legacy.plannedDate, null);
  assert.equal(legacy.startTime, null);
});

test("converts task collections in both directions without losing canonical fields", () => {
  const legacyTasks = [
    { id: "legacy-6", title: "اول", done: false },
    { id: "legacy-7", title: "دوم", done: true }
  ];

  const canonical = fromLegacyTasks(legacyTasks, { now: fixedNow });
  const roundTrip = toLegacyTasks(canonical);

  assert.deepEqual(
    roundTrip.map((task) => ({
      id: task.id,
      title: task.title,
      date: task.date,
      time: task.time,
      priority: task.priority,
      category: task.category,
      done: task.done
    })),
    legacyTasks.map((task) => ({
      id: task.id,
      title: task.title,
      date: "",
      time: "",
      priority: "medium",
      category: "personal",
      done: task.done
    }))
  );
  assert.ok(roundTrip.every((task) => Number.isInteger(task.version)));
});

test("rejects a non-array task collection", () => {
  assert.throws(() => fromLegacyTasks({}), /must be an array/);
  assert.throws(() => toLegacyTasks({}), /must be an array/);
});
