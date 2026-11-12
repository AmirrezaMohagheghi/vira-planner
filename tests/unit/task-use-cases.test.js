import test from "node:test";
import assert from "node:assert/strict";
import {
  createTaskForUI,
  updateTaskForUI
} from "../../src/application/tasks/task-use-cases.js";

const fixedNow = "2026-11-11T10:00:00.000Z";

test("creates a UI-compatible task through the domain model", () => {
  const task = createTaskForUI({
    title: "مطالعه",
    date: "2026-11-12",
    time: "09:30",
    priority: "high",
    category: "study",
    durationMinutes: 90
  }, { id: "created-1", now: fixedNow });

  assert.equal(task.id, "created-1");
  assert.equal(task.title, "مطالعه");
  assert.equal(task.date, "2026-11-12");
  assert.equal(task.time, "09:30");
  assert.equal(task.priority, "high");
  assert.equal(task.category, "study");
  assert.equal(task.durationMinutes, 90);
  assert.equal(task.done, false);
  assert.equal(task.plannedDate, "2026-11-12");
  assert.equal(task.startTime, "09:30");
  assert.equal(task.status, "todo");
  assert.equal(task.progress, 0);
  assert.equal(task.version, 1);
});

test("updates UI fields through the canonical model without losing rich fields", () => {
  const original = {
    id: "updated-1",
    title: "عنوان قبلی",
    date: "2026-11-12",
    time: "09:30",
    priority: "medium",
    category: "personal",
    done: false,
    description: "شرح وظیفه",
    plannedDate: "2026-11-12",
    startTime: "09:30",
    endTime: "10:30",
    durationMinutes: 60,
    deadline: "2026-11-15T12:00:00.000Z",
    categoryId: "personal",
    status: "todo",
    progress: 0,
    dependencyIds: ["task-a"],
    parentTaskId: "parent-1",
    recurrenceRuleId: "weekly-1",
    reminderIds: ["reminder-1"],
    createdAt: fixedNow,
    updatedAt: fixedNow,
    source: "user",
    version: 2
  };

  const updated = updateTaskForUI(original, {
    title: "عنوان تازه",
    date: "",
    time: "10:15",
    priority: "high",
    category: "university",
    durationMinutes: 45
  }, { now: fixedNow });

  assert.equal(updated.title, "عنوان تازه");
  assert.equal(updated.date, "");
  assert.equal(updated.time, "10:15");
  assert.equal(updated.priority, "high");
  assert.equal(updated.category, "university");
  assert.equal(updated.durationMinutes, 45);
  assert.equal(updated.description, "شرح وظیفه");
  assert.equal(updated.endTime, "10:30");
  assert.equal(updated.deadline, "2026-11-15T12:00:00.000Z");
  assert.deepEqual(updated.dependencyIds, ["task-a"]);
  assert.equal(updated.parentTaskId, "parent-1");
  assert.equal(updated.recurrenceRuleId, "weekly-1");
  assert.deepEqual(updated.reminderIds, ["reminder-1"]);
  assert.equal(updated.version, 2);
  assert.equal(original.title, "عنوان قبلی");
});

test("marks a task complete and sets progress to 100 in the domain model", () => {
  const original = {
    id: "complete-1",
    title: "کار",
    date: "",
    time: "",
    priority: "medium",
    category: "personal",
    done: false
  };

  const completed = updateTaskForUI(original, { done: true }, { now: fixedNow });
  assert.equal(completed.done, true);
  assert.equal(completed.status, "completed");
  assert.equal(completed.progress, 100);
});

test("reopens a completed task and resets progress", () => {
  const original = {
    id: "reopen-1",
    title: "کار",
    date: "",
    time: "",
    priority: "medium",
    category: "personal",
    done: true
  };

  const reopened = updateTaskForUI(original, { done: false }, { now: fixedNow });
  assert.equal(reopened.done, false);
  assert.equal(reopened.status, "todo");
  assert.equal(reopened.progress, 0);
});

test("rejects invalid dates instead of returning an invalid UI task", () => {
  assert.throws(
    () => createTaskForUI({ title: "کار", date: "2026-02-30" }, { id: "invalid-1", now: fixedNow }),
    /valid ISO date/
  );
});
