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
    category: "study"
  }, { id: "created-1", now: fixedNow });

  assert.deepEqual(task, {
    id: "created-1",
    title: "مطالعه",
    date: "2026-11-12",
    time: "09:30",
    priority: "high",
    category: "study",
    done: false
  });
});

test("updates UI fields through the canonical model", () => {
  const original = {
    id: "updated-1",
    title: "عنوان قبلی",
    date: "2026-11-12",
    time: "09:30",
    priority: "medium",
    category: "personal",
    done: false
  };

  const updated = updateTaskForUI(original, {
    title: "عنوان تازه",
    date: "",
    time: "10:15",
    priority: "high",
    category: "university"
  }, { now: fixedNow });

  assert.deepEqual(updated, {
    ...original,
    title: "عنوان تازه",
    date: "",
    time: "10:15",
    priority: "high",
    category: "university"
  });
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
});

test("rejects invalid dates instead of returning an invalid UI task", () => {
  assert.throws(
    () => createTaskForUI({ title: "کار", date: "2026-02-30" }, { id: "invalid-1", now: fixedNow }),
    /valid ISO date/
  );
});
