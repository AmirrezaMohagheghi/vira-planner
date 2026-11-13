import test from "node:test";
import assert from "node:assert/strict";
import { createWorkSession, validateWorkSession } from "../../src/domain/work-sessions/work-session.js";

const now = "2026-11-13T10:00:00.000Z";

test("creates a planned WorkSession with safe defaults", () => {
  const session = createWorkSession(
    { id: "session-1", taskId: "task-1" },
    { now }
  );

  assert.equal(session.status, "planned");
  assert.equal(session.plannedDurationSeconds, null);
  assert.equal(session.startedAt, null);
  assert.equal(session.version, 1);
  assert.equal(validateWorkSession(session), session);
});

test("creates an in-progress WorkSession with its first start time", () => {
  const session = createWorkSession({
    id: "session-2",
    taskId: "task-1",
    status: "in_progress",
    startedAt: now
  }, { now });

  assert.equal(session.startedAt, now);
});

test("rejects a missing Task reference", () => {
  assert.throws(
    () => createWorkSession({ id: "session-3" }, { now }),
    /taskId/
  );
});

test("rejects a non-positive planned duration", () => {
  assert.throws(
    () => createWorkSession({
      id: "session-4",
      taskId: "task-1",
      plannedDurationSeconds: 0
    }, { now }),
    /positive integer/
  );
});

test("rejects inconsistent lifecycle timestamps", () => {
  assert.throws(
    () => createWorkSession({
      id: "session-5",
      taskId: "task-1",
      status: "planned",
      startedAt: now
    }, { now }),
    /planned WorkSession/
  );
});

test("rejects a completion before the start", () => {
  assert.throws(
    () => createWorkSession({
      id: "session-6",
      taskId: "task-1",
      status: "completed",
      startedAt: "2026-11-13T11:00:00.000Z",
      completedAt: now
    }, { now }),
    /before startedAt/
  );
});

test("requires a cancellation timestamp for a cancelled WorkSession", () => {
  assert.throws(
    () => createWorkSession({
      id: "session-7",
      taskId: "task-1",
      status: "cancelled"
    }, { now }),
    /requires cancelledAt/
  );
});
